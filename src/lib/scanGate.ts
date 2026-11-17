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

/** Client rate limit, then concurrency cap. Run before any other work. */
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

  if (activeScans >= MAX_CONCURRENT_SCANS) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          status: "error",
          error: "Server is busy. Please try again in a moment.",
          code: "SERVER_BUSY",
          retryAfter: 10,
        },
        {
          status: 503,
          headers: {
            ...rateLimitHeaders,
            "Retry-After": "10",
          },
        },
      ),
    };
  }

  return { ok: true, rateLimitHeaders };
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

/** Take a concurrency slot. Call the returned function in a finally block. */
export function acquireScanSlot(): () => void {
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
