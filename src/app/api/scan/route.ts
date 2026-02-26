import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { scanUrl } from "@/lib/scan";
import {
  ScanRequestSchema,
  validateAndNormalizeUrl,
  ValidationError,
  TimeoutError,
  RateLimitError,
} from "@/lib/validation";
import {
  checkRateLimit,
  checkDomainLimit,
  getRateLimitHeaders,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

// Maximum concurrent scans (simple semaphore)
let activeScans = 0;
const MAX_CONCURRENT_SCANS = 3;

function getClientId(req: Request): string {
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

export async function POST(req: Request) {
  const clientId = getClientId(req);

  // Check rate limit
  const rateLimit = checkRateLimit(clientId);
  const rateLimitHeaders = getRateLimitHeaders(clientId);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        status: "error",
        error: "Rate limit exceeded. Please wait before making another request.",
        code: "RATE_LIMITED",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  // Check concurrent scan limit
  if (activeScans >= MAX_CONCURRENT_SCANS) {
    return NextResponse.json(
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
      }
    );
  }

  try {
    // Parse and validate request body
    const body = ScanRequestSchema.parse(await req.json());

    // Validate and normalize URL
    const urlResult = validateAndNormalizeUrl(body.url);
    if (!urlResult.valid) {
      return NextResponse.json(
        {
          status: "error",
          error: urlResult.error,
          code: "INVALID_URL",
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Check domain-specific rate limit
    const domain = new URL(urlResult.url).hostname;
    const domainLimit = checkDomainLimit(domain);
    if (!domainLimit.allowed) {
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
        }
      );
    }

    // Execute scan
    activeScans++;
    try {
      const result = await scanUrl(urlResult.url);
      return NextResponse.json(result, { headers: rateLimitHeaders });
    } finally {
      activeScans--;
    }
  } catch (err) {
    // Handle specific error types
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          status: "error",
          error: "Invalid request format",
          code: "VALIDATION_ERROR",
          details: err.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    if (err instanceof ValidationError) {
      return NextResponse.json(
        {
          status: "error",
          error: err.message,
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    if (err instanceof TimeoutError) {
      return NextResponse.json(
        {
          status: "timeout",
          error: "Scan timed out. The target site may be slow or unresponsive.",
          code: "TIMEOUT",
        },
        { status: 504, headers: rateLimitHeaders }
      );
    }

    if (err instanceof RateLimitError) {
      return NextResponse.json(
        {
          status: "error",
          error: err.message,
          code: "RATE_LIMITED",
          retryAfter: err.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            "Retry-After": String(err.retryAfter),
          },
        }
      );
    }

    // Check for Playwright-specific errors
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (errorMessage.includes("net::ERR_NAME_NOT_RESOLVED")) {
      return NextResponse.json(
        {
          status: "error",
          error: "Could not resolve domain. Please check the URL.",
          code: "DNS_ERROR",
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    if (errorMessage.includes("net::ERR_CONNECTION_REFUSED")) {
      return NextResponse.json(
        {
          status: "error",
          error: "Connection refused by the target server.",
          code: "CONNECTION_REFUSED",
        },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    if (errorMessage.includes("Timeout")) {
      return NextResponse.json(
        {
          status: "timeout",
          error: "Scan timed out. The target site may be slow or unresponsive.",
          code: "TIMEOUT",
        },
        { status: 504, headers: rateLimitHeaders }
      );
    }

    // Generic server error
    console.error("[Scan Error]", err);
    return NextResponse.json(
      {
        status: "error",
        error: "An unexpected error occurred during the scan.",
        code: "INTERNAL_ERROR",
      },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
