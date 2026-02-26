/**
 * Simple in-memory rate limiter using token bucket algorithm
 *
 * For production, consider using Redis or a distributed rate limiter
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxTokens: number;      // Max tokens in bucket
  refillRate: number;     // Tokens added per second
  tokensPerRequest: number; // Tokens consumed per request
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokens: 10,          // Max 10 requests in burst
  refillRate: 0.2,        // 1 token per 5 seconds = 12/minute sustained
  tokensPerRequest: 1,
};

// In-memory storage (per IP)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const ENTRY_TTL = 10 * 60 * 1000; // Remove entries after 10 minutes of inactivity

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.lastRefill > ENTRY_TTL) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);

  // Don't prevent Node.js from exiting
  cleanupTimer.unref();
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (usually IP address)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
} {
  startCleanup();

  const now = Date.now();
  let entry = rateLimitStore.get(identifier);

  if (!entry) {
    // New client, give them full tokens
    entry = {
      tokens: config.maxTokens,
      lastRefill: now,
    };
    rateLimitStore.set(identifier, entry);
  } else {
    // Refill tokens based on time elapsed
    const elapsed = (now - entry.lastRefill) / 1000; // seconds
    const refill = elapsed * config.refillRate;
    entry.tokens = Math.min(config.maxTokens, entry.tokens + refill);
    entry.lastRefill = now;
  }

  // Check if we have enough tokens
  if (entry.tokens >= config.tokensPerRequest) {
    entry.tokens -= config.tokensPerRequest;
    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
    };
  }

  // Not enough tokens - calculate retry time
  const tokensNeeded = config.tokensPerRequest - entry.tokens;
  const retryAfter = Math.ceil(tokensNeeded / config.refillRate);

  return {
    allowed: false,
    remaining: 0,
    retryAfter,
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Record<string, string> {
  const entry = rateLimitStore.get(identifier);
  const remaining = entry ? Math.floor(entry.tokens) : config.maxTokens;

  return {
    "X-RateLimit-Limit": String(config.maxTokens),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + Math.ceil(config.maxTokens / config.refillRate)),
  };
}

/**
 * Domain-specific rate limiting (prevent hammering a single target)
 */
const domainLimitStore = new Map<string, number>(); // domain -> last scan timestamp
const DOMAIN_COOLDOWN = 30_000; // 30 seconds between scans of same domain

export function checkDomainLimit(domain: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const lastScan = domainLimitStore.get(domain);
  const now = Date.now();

  if (lastScan && now - lastScan < DOMAIN_COOLDOWN) {
    return {
      allowed: false,
      retryAfter: Math.ceil((DOMAIN_COOLDOWN - (now - lastScan)) / 1000),
    };
  }

  domainLimitStore.set(domain, now);
  return { allowed: true };
}

/**
 * Reset rate limit for testing purposes
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

export function resetAllRateLimits(): void {
  rateLimitStore.clear();
  domainLimitStore.clear();
}
