import { describe, it, expect, vi } from 'vitest'
import {
  validateAndNormalizeUrl,
  validateAndResolveUrl,
  ScanRequestSchema,
  ValidationError,
  TimeoutError,
  RateLimitError,
  BlockedError,
} from './validation'

describe('validateAndNormalizeUrl', () => {
  describe('valid URLs', () => {
    it('accepts valid HTTPS URLs', () => {
      const result = validateAndNormalizeUrl('https://example.com')
      expect(result).toEqual({ valid: true, url: 'https://example.com/' })
    })

    it('accepts valid HTTP URLs and upgrades to HTTPS', () => {
      const result = validateAndNormalizeUrl('http://example.com')
      expect(result).toEqual({ valid: true, url: 'https://example.com/' })
    })

    it('adds https:// protocol if missing', () => {
      const result = validateAndNormalizeUrl('example.com')
      expect(result).toEqual({ valid: true, url: 'https://example.com/' })
    })

    it('preserves path and query parameters', () => {
      const result = validateAndNormalizeUrl('https://example.com/page?foo=bar')
      expect(result).toEqual({ valid: true, url: 'https://example.com/page?foo=bar' })
    })

    it('strips hash fragments', () => {
      const result = validateAndNormalizeUrl('https://example.com/page#section')
      expect(result).toEqual({ valid: true, url: 'https://example.com/page' })
    })

    it('handles URLs with ports', () => {
      const result = validateAndNormalizeUrl('https://example.com:8080/path')
      expect(result).toEqual({ valid: true, url: 'https://example.com:8080/path' })
    })

    it('handles subdomains', () => {
      const result = validateAndNormalizeUrl('www.example.com')
      expect(result).toEqual({ valid: true, url: 'https://www.example.com/' })
    })
  })

  describe('invalid URL format', () => {
    it('rejects empty strings', () => {
      const result = validateAndNormalizeUrl('')
      expect(result).toEqual({ valid: false, error: 'Invalid URL format' })
    })

    it('rejects malformed URLs', () => {
      const result = validateAndNormalizeUrl('not a url at all')
      expect(result).toEqual({ valid: false, error: 'Invalid URL format' })
    })

    it('rejects URLs with invalid characters', () => {
      const result = validateAndNormalizeUrl('https://example<>.com')
      expect(result).toEqual({ valid: false, error: 'Invalid URL format' })
    })
  })

  describe('protocol restrictions', () => {
    it('rejects file:// URLs', () => {
      const result = validateAndNormalizeUrl('file:///etc/passwd')
      expect(result).toEqual({ valid: false, error: 'Only HTTP and HTTPS URLs are allowed' })
    })

    it('rejects ftp:// URLs', () => {
      const result = validateAndNormalizeUrl('ftp://example.com')
      expect(result).toEqual({ valid: false, error: 'Only HTTP and HTTPS URLs are allowed' })
    })

    it('rejects javascript: URLs', () => {
      const result = validateAndNormalizeUrl('javascript:alert(1)')
      expect(result.valid).toBe(false)
      // Caught by protocol check as non-http(s)
    })
  })

  describe('private/internal IP blocking', () => {
    it('blocks localhost', () => {
      const result = validateAndNormalizeUrl('http://localhost')
      expect(result).toEqual({ valid: false, error: 'Scanning private/internal addresses is not allowed' })
    })

    it('blocks localhost.localdomain', () => {
      const result = validateAndNormalizeUrl('http://localhost.localdomain')
      expect(result).toEqual({ valid: false, error: 'Scanning private/internal addresses is not allowed' })
    })

    it('blocks 127.x.x.x', () => {
      expect(validateAndNormalizeUrl('http://127.0.0.1')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('http://127.1.2.3')).toMatchObject({ valid: false })
    })

    it('blocks 10.x.x.x (Class A private)', () => {
      expect(validateAndNormalizeUrl('http://10.0.0.1')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('http://10.255.255.255')).toMatchObject({ valid: false })
    })

    it('blocks 172.16-31.x.x (Class B private)', () => {
      expect(validateAndNormalizeUrl('http://172.16.0.1')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('http://172.31.255.255')).toMatchObject({ valid: false })
      // 172.15 and 172.32 should be allowed
    })

    it('blocks 192.168.x.x (Class C private)', () => {
      expect(validateAndNormalizeUrl('http://192.168.0.1')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('http://192.168.1.100')).toMatchObject({ valid: false })
    })

    it('blocks 169.254.x.x (link-local)', () => {
      expect(validateAndNormalizeUrl('http://169.254.1.1')).toMatchObject({ valid: false })
    })

    it('blocks 0.x.x.x', () => {
      expect(validateAndNormalizeUrl('http://0.0.0.0')).toMatchObject({ valid: false })
    })

    it('blocks IPv6 localhost', () => {
      expect(validateAndNormalizeUrl('http://[::1]')).toMatchObject({ valid: false })
    })

    it('blocks reserved hostnames', () => {
      expect(validateAndNormalizeUrl('http://local')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('http://internal')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('http://intranet')).toMatchObject({ valid: false })
    })
  })

  describe('extended SSRF address forms (static)', () => {
    it.each([
      'http://[fe80::1]', 'http://[fd00::1]', 'http://[fc00::1]',
      'http://[::ffff:127.0.0.1]', 'http://[::ffff:169.254.169.254]',
      'http://100.64.0.1', 'http://100.127.0.1', 'http://224.0.0.1',
      'http://[ff02::1]', 'http://169.254.169.254', 'http://metadata.google.internal',
      'http://2130706433', 'http://0x7f.1', 'http://[::]',
    ])('blocks %s', (u) => {
      expect(validateAndNormalizeUrl(u)).toMatchObject({ valid: false })
    })

    it('still allows public hosts and 100.63 / 100.128 neighbours', () => {
      expect(validateAndNormalizeUrl('http://100.63.0.1')).toMatchObject({ valid: true })
      expect(validateAndNormalizeUrl('http://100.128.0.1')).toMatchObject({ valid: true })
      expect(validateAndNormalizeUrl('https://example.com')).toMatchObject({ valid: true })
    })
  })

  describe('SSRF prevention', () => {
    it('blocks consent-compass domain', () => {
      expect(validateAndNormalizeUrl('https://consent-compass.com')).toMatchObject({ valid: false })
      expect(validateAndNormalizeUrl('https://api.consent-compass.com')).toMatchObject({ valid: false })
    })

    it('blocks consentcompass domain', () => {
      expect(validateAndNormalizeUrl('https://consentcompass.io')).toMatchObject({ valid: false })
    })
  })
})

describe('ScanRequestSchema', () => {
  it('validates minimal request', () => {
    const result = ScanRequestSchema.safeParse({ url: 'https://example.com' })
    expect(result.success).toBe(true)
  })

  it('validates request with options', () => {
    const result = ScanRequestSchema.safeParse({
      url: 'https://example.com',
      options: {
        timeout: 30000,
        screenshot: true,
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty URL', () => {
    const result = ScanRequestSchema.safeParse({ url: '' })
    expect(result.success).toBe(false)
  })

  it('rejects URL over 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2040)
    const result = ScanRequestSchema.safeParse({ url: longUrl })
    expect(result.success).toBe(false)
  })

  it('rejects timeout below 5000ms', () => {
    const result = ScanRequestSchema.safeParse({
      url: 'https://example.com',
      options: { timeout: 1000 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects timeout above 60000ms', () => {
    const result = ScanRequestSchema.safeParse({
      url: 'https://example.com',
      options: { timeout: 120000 },
    })
    expect(result.success).toBe(false)
  })
})

describe('Custom error types', () => {
  it('creates ValidationError with correct name', () => {
    const error = new ValidationError('Invalid input')
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('Invalid input')
    expect(error instanceof Error).toBe(true)
  })

  it('creates TimeoutError with default message', () => {
    const error = new TimeoutError()
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toBe('Scan timed out')
  })

  it('creates TimeoutError with custom message', () => {
    const error = new TimeoutError('Custom timeout')
    expect(error.message).toBe('Custom timeout')
  })

  it('creates RateLimitError with retryAfter', () => {
    const error = new RateLimitError(120)
    expect(error.name).toBe('RateLimitError')
    expect(error.message).toBe('Rate limit exceeded')
    expect(error.retryAfter).toBe(120)
  })

  it('creates RateLimitError with default retryAfter', () => {
    const error = new RateLimitError()
    expect(error.retryAfter).toBe(60)
  })

  it('creates BlockedError with default message', () => {
    const error = new BlockedError()
    expect(error.name).toBe('BlockedError')
    expect(error.message).toBe('Request blocked')
  })
})

describe('validateAndResolveUrl (DNS)', () => {
  it('rejects a public-looking hostname that resolves to a private IP', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '10.1.2.3', family: 4 }])
    const r = await validateAndResolveUrl('https://rebind.example.com', lookup)
    expect(r).toMatchObject({ valid: false })
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('rejects statically-blocked input without doing DNS', async () => {
    const lookup = vi.fn()
    expect(await validateAndResolveUrl('http://[::ffff:127.0.0.1]', lookup)).toMatchObject({ valid: false })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('accepts a hostname resolving only to public addresses', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    expect(await validateAndResolveUrl('example.com', lookup)).toEqual({ valid: true, url: 'https://example.com/' })
  })
})
