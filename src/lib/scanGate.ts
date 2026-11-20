/**
 * Shared admission gate for every route that launches a browser: per-client
 * rate limit, per-domain cooldown and a concurrency cap. State is in memory,
 * so it is per server instance.
 */

import { NextResponse } from "next/server";
import {
  checkRateLimit,
  checkDomainLimit,
  getRateLimitHeaders,
} from "@/lib/rateLimit";

// Maximum concurrent browser runs (simple semaphore), shared by all routes.
let activeScans = 0;
export const MAX_CONCURRENT_SCANS = 3;

export function getClientId(req: Request): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  // Fallback to a hash of user-agent + some request properties
  return "anonymous";
}

export type GateResult =
  | { ok: true; rateLimitHeaders: Record<string, string> }
  | { ok: false; response: NextResponse };

/** Client rate limit. Run before any other work. */
export function checkClientGate(req: Request): GateResult {
  const clientId = getClientId(req);
  const rateLimit = checkRateLimit(clientId);
  const rateLimitHeaders = getRateLimitHeaders(clientId);

  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          status: "error",
          error:
            "Rate limit exceeded. Please wait before making another request.",
          code: "RATE_LIMITED",
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      ),
    };
  }

  return { ok: true, rateLimitHeaders };
}

// Status polling has its own, lenient budget so it never eats the submit
// budget. 120 burst, refilling 2/s (120 per minute sustained). The UI polls
// every 2s (30 per minute), so a normal poll uses a quarter of the sustained
// rate, and several tabs from one client still fit.
const POLL_CONFIG = { maxTokens: 120, refillRate: 2, tokensPerRequest: 1 };

/** Per-client limit for GET /api/scan/{runId}. Same 429 headers shape as the submit gate. */
export function checkPollGate(req: Request): GateResult {
  const key = `poll:${getClientId(req)}`;
  const limit = checkRateLimit(key, POLL_CONFIG);
  const rateLimitHeaders = getRateLimitHeaders(key, POLL_CONFIG);
  if (limit.allowed) return { ok: true, rateLimitHeaders };
  return {
    ok: false,
    response: NextResponse.json(
      {
        status: "error",
        error: "Too many status requests. Please slow down.",
        code: "RATE_LIMITED",
        retryAfter: limit.retryAfter,
      },
      {
        status: 429,
        headers: { ...rateLimitHeaders, "Retry-After": String(limit.retryAfter) },
      },
    ),
  };
}

/** Per-domain cooldown. Returns a 429 response, or null when allowed. */
export function checkDomainGate(
  domain: string,
  rateLimitHeaders: Record<string, string>,
): NextResponse | null {
  const domainLimit = checkDomainLimit(domain);
  if (domainLimit.allowed) return null;
  return NextResponse.json(
    {
      status: "error",
      error: `This domain was recently scanned. Please wait ${domainLimit.retryAfter} seconds.`,
      code: "DOMAIN_COOLDOWN",
      retryAfter: domainLimit.retryAfter,
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders,
        "Retry-After": String(domainLimit.retryAfter),
      },
    },
  );
}

/** The 503 returned when no concurrency slot is free. */
export function serverBusyResponse(
  rateLimitHeaders: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      status: "error",
      error: "Server is busy. Please try again in a moment.",
      code: "SERVER_BUSY",
      retryAfter: 10,
    },
    {
      status: 503,
      headers: { ...rateLimitHeaders, "Retry-After": "10" },
    },
  );
}

/**
 * Check the concurrency cap and take a slot in one synchronous step, so
 * concurrent requests cannot all pass a check before any of them increments.
 * Call it immediately before the guarded work, with no await in between.
 * Returns an idempotent release function (call it in a finally block), or
 * null when the cap is reached.
 */
export function tryAcquireScanSlot(): (() => void) | null {
  if (activeScans >= MAX_CONCURRENT_SCANS) return null;
  activeScans++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeScans--;
  };
}

/** Test helper: clear the module-level counter. */
export function resetScanSlots(): void {
  activeScans = 0;
}
