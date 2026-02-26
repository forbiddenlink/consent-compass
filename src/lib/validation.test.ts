import { describe, it, expect } from 'vitest'
import {
  validateAndNormalizeUrl,
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
