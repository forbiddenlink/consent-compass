import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  getRateLimitHeaders,
  checkDomainLimit,
  resetRateLimit,
  resetAllRateLimits,
} from './rateLimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request with full tokens', () => {
    const result = checkRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9) // 10 - 1 = 9
  })

  it('allows multiple requests up to max tokens', () => {
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit('burst-test')
      expect(result.allowed).toBe(true)
    }
    // 11th request should be denied
    const result = checkRateLimit('burst-test')
    expect(result.allowed).toBe(false)
  })

  it('returns remaining tokens count', () => {
    checkRateLimit('count-test')
    checkRateLimit('count-test')
    const result = checkRateLimit('count-test')
    expect(result.remaining).toBe(7) // 10 - 3 = 7
  })

  it('returns retryAfter when rate limited', () => {
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      checkRateLimit('retry-test')
    }
    const result = checkRateLimit('retry-test')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeDefined()
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('refills tokens over time', () => {
    // Use 5 tokens
    for (let i = 0; i < 5; i++) {
      checkRateLimit('refill-test')
    }
    expect(checkRateLimit('refill-test').remaining).toBe(4)

    // Advance time by 10 seconds (refill rate 0.2/sec = 2 tokens)
    vi.advanceTimersByTime(10000)

    const result = checkRateLimit('refill-test')
    expect(result.allowed).toBe(true)
    // Should have refilled ~2 tokens, then used 1
    expect(result.remaining).toBeGreaterThanOrEqual(5)
  })

  it('caps tokens at max', () => {
    // Wait for a long time (tokens shouldn't exceed max)
    vi.advanceTimersByTime(100000)
    const result = checkRateLimit('cap-test')
    expect(result.remaining).toBeLessThanOrEqual(9) // max 10 - 1 = 9
  })

  it('uses custom config', () => {
    const customConfig = {
      maxTokens: 5,
      refillRate: 1,
      tokensPerRequest: 2,
    }

    const result = checkRateLimit('custom-test', customConfig)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3) // 5 - 2 = 3
  })

  it('tracks different IPs separately', () => {
    // Exhaust IP1
    for (let i = 0; i < 10; i++) {
      checkRateLimit('ip-1')
    }
    expect(checkRateLimit('ip-1').allowed).toBe(false)

    // IP2 should still have tokens
    expect(checkRateLimit('ip-2').allowed).toBe(true)
  })
})

describe('getRateLimitHeaders', () => {
  beforeEach(() => {
    resetAllRateLimits()
  })

  it('returns correct headers for new client', () => {
    const headers = getRateLimitHeaders('new-client')
    expect(headers['X-RateLimit-Limit']).toBe('10')
    expect(headers['X-RateLimit-Remaining']).toBe('10')
    expect(headers['X-RateLimit-Reset']).toBeDefined()
  })

  it('returns updated remaining after requests', () => {
    checkRateLimit('header-test')
    checkRateLimit('header-test')
    const headers = getRateLimitHeaders('header-test')
    expect(headers['X-RateLimit-Remaining']).toBe('8')
  })
})

describe('checkDomainLimit', () => {
  beforeEach(() => {
    resetAllRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request to a domain', () => {
    const result = checkDomainLimit('example.com')
    expect(result.allowed).toBe(true)
  })

  it('blocks rapid requests to same domain', () => {
    checkDomainLimit('rapid.com')
    const result = checkDomainLimit('rapid.com')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeDefined()
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('allows requests to different domains', () => {
    checkDomainLimit('domain1.com')
    const result = checkDomainLimit('domain2.com')
    expect(result.allowed).toBe(true)
  })

  it('allows request after cooldown period', () => {
    checkDomainLimit('cooldown.com')
    expect(checkDomainLimit('cooldown.com').allowed).toBe(false)

    // Advance past 30 second cooldown
    vi.advanceTimersByTime(31000)

    expect(checkDomainLimit('cooldown.com').allowed).toBe(true)
  })

  it('returns correct retryAfter value', () => {
    checkDomainLimit('retry-domain.com')
    vi.advanceTimersByTime(10000) // 10 seconds in

    const result = checkDomainLimit('retry-domain.com')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBe(20) // 30 - 10 = 20 seconds remaining
  })
})

describe('resetRateLimit', () => {
  it('resets rate limit for specific identifier', () => {
    // Use up tokens
    for (let i = 0; i < 10; i++) {
      checkRateLimit('reset-test')
    }
    expect(checkRateLimit('reset-test').allowed).toBe(false)

    // Reset
    resetRateLimit('reset-test')

    // Should have full tokens again
    const result = checkRateLimit('reset-test')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })
})

describe('resetAllRateLimits', () => {
  it('resets all rate limits', () => {
    checkRateLimit('client-a')
    checkRateLimit('client-b')
    checkDomainLimit('domain-a.com')

    resetAllRateLimits()

    // All should be fresh
    expect(checkRateLimit('client-a').remaining).toBe(9) // fresh start
    expect(checkRateLimit('client-b').remaining).toBe(9)
    expect(checkDomainLimit('domain-a.com').allowed).toBe(true)
  })
})
