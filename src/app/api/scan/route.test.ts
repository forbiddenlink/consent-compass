import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { resetAllRateLimits } from '@/lib/rateLimit'

// Keep route tests offline: DNS resolution is covered in ssrf.test.ts.
vi.mock('@/lib/ssrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ssrf')>()
  return {
    ...actual,
    assertPublicHost: (host: string) =>
      actual.assertPublicHost(host, async () => [{ address: '93.184.216.34', family: 4 }]),
  }
})

vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: vi.fn() },
  runs: { retrieve: vi.fn() },
}))
// The browser must never be loaded by this route.
vi.mock('@/lib/scan', () => {
  throw new Error('/api/scan must not import the scanner')
})

import { tasks } from '@trigger.dev/sdk/v3'
const mockTrigger = vi.mocked(tasks.trigger)

function createRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/scan', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.clearAllMocks()
    mockTrigger.mockResolvedValue({ id: 'run_abc12345xyz' } as never)
  })

  describe('request validation', () => {
    it('returns 400 for missing URL', async () => {
      const res = await POST(createRequest({}))
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for empty URL', async () => {
      const res = await POST(createRequest({ url: '' }))
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for invalid URL format', async () => {
      const res = await POST(createRequest({ url: 'not a url' }))
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('INVALID_URL')
    })

    it('returns 400 for localhost and private IPs', async () => {
      for (const url of ['http://localhost:3000', 'http://192.168.1.1']) {
        const res = await POST(createRequest({ url }))
        expect(res.status).toBe(400)
        expect((await res.json()).code).toBe('INVALID_URL')
      }
      expect(mockTrigger).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid timeout option', async () => {
      const res = await POST(createRequest({ url: 'https://example.com', options: { timeout: 1000 } }))
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('submit', () => {
    it('returns 202 with the run id and triggers the task with the normalized URL', async () => {
      const res = await POST(createRequest({ url: 'http://example.com' }))
      expect(res.status).toBe(202)
      expect(await res.json()).toEqual({ runId: 'run_abc12345xyz' })
      expect(mockTrigger).toHaveBeenCalledWith('scan-url-compliance', { url: 'https://example.com/' }, { ttl: '10m' })
    })

    it('adds https:// if protocol missing', async () => {
      await POST(createRequest({ url: 'example.com' }))
      expect(mockTrigger).toHaveBeenCalledWith('scan-url-compliance', { url: 'https://example.com/' }, { ttl: '10m' })
    })

    it('includes rate limit headers', async () => {
      const res = await POST(createRequest({ url: 'https://example.com' }))
      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
    })

    it('returns 500 when Trigger.dev is unreachable', async () => {
      mockTrigger.mockRejectedValue(new Error('network'))
      const res = await POST(createRequest({ url: 'https://example.com' }))
      expect(res.status).toBe(500)
      expect((await res.json()).code).toBe('INTERNAL_ERROR')
    })
  })

  describe('rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      for (let i = 0; i < 10; i++) {
        await POST(createRequest({ url: `https://example${i}.com` }))
      }
      const res = await POST(createRequest({ url: 'https://example11.com' }))
      expect(res.status).toBe(429)
      expect((await res.json()).code).toBe('RATE_LIMITED')
      expect(res.headers.get('Retry-After')).toBeDefined()
    })

    it('respects x-forwarded-for header for client ID', async () => {
      for (let i = 0; i < 10; i++) {
        await POST(createRequest({ url: `https://example${i}.com` }, { 'x-forwarded-for': '1.2.3.4' }))
      }
      const limited = await POST(createRequest({ url: 'https://newsite.com' }, { 'x-forwarded-for': '1.2.3.4' }))
      expect(limited.status).toBe(429)
      const other = await POST(createRequest({ url: 'https://newsite.com' }, { 'x-forwarded-for': '5.6.7.8' }))
      expect(other.status).toBe(202)
    })
  })

  describe('domain cooldown', () => {
    it('returns 429 for same domain scanned recently', async () => {
      expect((await POST(createRequest({ url: 'https://example.com' }))).status).toBe(202)
      const res = await POST(createRequest({ url: 'https://example.com/page2' }))
      expect(res.status).toBe(429)
      expect((await res.json()).code).toBe('DOMAIN_COOLDOWN')
    })

    it('allows scans to different domains', async () => {
      await POST(createRequest({ url: 'https://example.com' }))
      expect((await POST(createRequest({ url: 'https://different.com' }))).status).toBe(202)
    })
  })
})
