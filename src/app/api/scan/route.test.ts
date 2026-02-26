import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from './route'
import { resetAllRateLimits } from '@/lib/rateLimit'

// Mock the scan module
vi.mock('@/lib/scan', () => ({
  scanUrl: vi.fn(),
}))

import { scanUrl } from '@/lib/scan'

const mockScanUrl = vi.mocked(scanUrl)

function createRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function createMockScanResult() {
  return {
    status: 'ok' as const,
    url: 'https://example.com/',
    scannedAt: new Date().toISOString(),
    score: {
      overall: 75,
      choiceSymmetry: 80,
      preConsentSignals: 70,
      accessibility: 75,
      transparency: 75,
    },
    banner: {
      detected: true,
      confidence: 0.9,
      selectors: ['#cookie-banner'],
      acceptButtons: ['Accept'],
      rejectButtons: ['Reject'],
      managePrefsButtons: [],
    },
    friction: {
      acceptClicks: 1,
      rejectClicks: 1,
    },
    preConsent: {
      cookies: [],
      requests: [],
    },
    artifacts: {},
    findings: [],
    meta: {
      userAgent: 'test',
      tookMs: 1000,
      scannerVersion: '0.1.0',
    },
  }
}

describe('POST /api/scan', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.clearAllMocks()
    mockScanUrl.mockResolvedValue(createMockScanResult())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('request validation', () => {
    it('returns 400 for missing URL', async () => {
      const req = createRequest({})
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for empty URL', async () => {
      const req = createRequest({ url: '' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for invalid URL format', async () => {
      const req = createRequest({ url: 'not a url' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('INVALID_URL')
    })

    it('returns 400 for localhost', async () => {
      const req = createRequest({ url: 'http://localhost:3000' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('INVALID_URL')
      expect(json.error).toContain('private')
    })

    it('returns 400 for private IPs', async () => {
      const req = createRequest({ url: 'http://192.168.1.1' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('INVALID_URL')
    })

    it('returns 400 for invalid timeout option', async () => {
      const req = createRequest({ url: 'https://example.com', options: { timeout: 1000 } })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('successful scans', () => {
    it('returns scan result for valid URL', async () => {
      const req = createRequest({ url: 'https://example.com' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.status).toBe('ok')
      expect(json.score).toBeDefined()
      expect(mockScanUrl).toHaveBeenCalledWith('https://example.com/')
    })

    it('normalizes HTTP to HTTPS', async () => {
      const req = createRequest({ url: 'http://example.com' })
      await POST(req)

      expect(mockScanUrl).toHaveBeenCalledWith('https://example.com/')
    })

    it('adds https:// if protocol missing', async () => {
      const req = createRequest({ url: 'example.com' })
      await POST(req)

      expect(mockScanUrl).toHaveBeenCalledWith('https://example.com/')
    })

    it('includes rate limit headers', async () => {
      const req = createRequest({ url: 'https://example.com' })
      const res = await POST(req)

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
    })
  })

  describe('rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      // Exhaust rate limit (default is 10 tokens)
      for (let i = 0; i < 10; i++) {
        const req = createRequest({ url: `https://example${i}.com` })
        await POST(req)
      }

      // 11th request should be rate limited
      const req = createRequest({ url: 'https://example11.com' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(429)
      expect(json.code).toBe('RATE_LIMITED')
      expect(json.retryAfter).toBeDefined()
      expect(res.headers.get('Retry-After')).toBeDefined()
    })

    it('respects x-forwarded-for header for client ID', async () => {
      // First client exhausts their limit
      for (let i = 0; i < 10; i++) {
        const req = createRequest(
          { url: `https://example${i}.com` },
          { 'x-forwarded-for': '1.2.3.4' }
        )
        await POST(req)
      }

      // Same IP should be rate limited
      const req1 = createRequest(
        { url: 'https://newsite.com' },
        { 'x-forwarded-for': '1.2.3.4' }
      )
      const res1 = await POST(req1)
      expect(res1.status).toBe(429)

      // Different IP should not be rate limited
      const req2 = createRequest(
        { url: 'https://newsite.com' },
        { 'x-forwarded-for': '5.6.7.8' }
      )
      const res2 = await POST(req2)
      expect(res2.status).toBe(200)
    })
  })

  describe('domain cooldown', () => {
    it('returns 429 for same domain scanned recently', async () => {
      // First scan
      const req1 = createRequest({ url: 'https://example.com' })
      const res1 = await POST(req1)
      expect(res1.status).toBe(200)

      // Second scan to same domain
      const req2 = createRequest({ url: 'https://example.com/page2' })
      const res2 = await POST(req2)
      const json = await res2.json()

      expect(res2.status).toBe(429)
      expect(json.code).toBe('DOMAIN_COOLDOWN')
      expect(json.retryAfter).toBeDefined()
    })

    it('allows scans to different domains', async () => {
      const req1 = createRequest({ url: 'https://example.com' })
      await POST(req1)

      const req2 = createRequest({ url: 'https://different.com' })
      const res2 = await POST(req2)

      expect(res2.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('returns 504 for timeout errors', async () => {
      mockScanUrl.mockRejectedValue(new Error('Timeout exceeded'))

      const req = createRequest({ url: 'https://slow-site.com' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(504)
      expect(json.code).toBe('TIMEOUT')
    })

    it('returns 400 for DNS errors', async () => {
      mockScanUrl.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'))

      const req = createRequest({ url: 'https://nonexistent-domain.invalid' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.code).toBe('DNS_ERROR')
    })

    it('returns 502 for connection refused', async () => {
      mockScanUrl.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'))

      const req = createRequest({ url: 'https://closed-port.com' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(502)
      expect(json.code).toBe('CONNECTION_REFUSED')
    })

    it('returns 500 for unknown errors', async () => {
      mockScanUrl.mockRejectedValue(new Error('Something unexpected'))

      const req = createRequest({ url: 'https://error-site.com' })
      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.code).toBe('INTERNAL_ERROR')
    })
  })
})
