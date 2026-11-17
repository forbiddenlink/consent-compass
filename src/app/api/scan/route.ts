import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { scanUrl } from "@/lib/scan";
import { scanUrl as triggerScanUrl } from "@/trigger/compliance-scan";
import {
  ScanRequestSchema,
  validateAndResolveUrl,
  ValidationError,
  TimeoutError,
  RateLimitError,
} from "@/lib/validation";
import {
  checkClientGate,
  checkDomainGate,
  acquireScanSlot,
} from "@/lib/scanGate";
import { DbInitError, initDb, saveScan } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = checkClientGate(req);
  if (!gate.ok) return gate.response;
  const rateLimitHeaders = gate.rateLimitHeaders;

  try {
    // Parse and validate request body
    const body = ScanRequestSchema.parse(await req.json());

    // Validate and normalize URL
    const urlResult = await validateAndResolveUrl(body.url);
    if (!urlResult.valid) {
      return NextResponse.json(
        {
          status: "error",
          error: urlResult.error,
          code: "INVALID_URL",
        },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    // Check domain-specific rate limit
    const domain = new URL(urlResult.url).hostname;
    const cooldown = checkDomainGate(domain, rateLimitHeaders);
    if (cooldown) return cooldown;

    // Execute scan
    const release = acquireScanSlot();
    try {
      const result = await scanUrl(urlResult.url);

      // Save successful scans to database
      let scanId: number | undefined;
      if (result.status === "ok") {
        try {
          initDb();
          scanId = saveScan(result);
        } catch (dbError) {
          // Don't fail the request if DB save fails. DbInitError is already
          // logged once with context by initDb; log anything else here.
          if (!(dbError instanceof DbInitError)) {
            console.error("[Scan DB Error]", dbError);
          }
        }
      }

      // Trigger async background job (fire-and-forget)
      if (result.status === "ok" && scanId !== undefined) {
        triggerScanUrl
          .trigger({ url: urlResult.url, reportId: String(scanId) })
          .catch((err) => {
            console.error("[Trigger Job Error]", err);
            // Don't fail the response if trigger fails
          });
      }

      // Add scanId to response if available
      const response = scanId !== undefined ? { ...result, scanId } : result;
      return NextResponse.json(response, { headers: rateLimitHeaders });
    } finally {
      release();
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
        { status: 400, headers: rateLimitHeaders },
      );
    }

    if (err instanceof ValidationError) {
      return NextResponse.json(
        {
          status: "error",
          error: err.message,
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    if (err instanceof TimeoutError) {
      return NextResponse.json(
        {
          status: "timeout",
          error: "Scan timed out. The target site may be slow or unresponsive.",
          code: "TIMEOUT",
        },
        { status: 504, headers: rateLimitHeaders },
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
        },
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
        { status: 400, headers: rateLimitHeaders },
      );
    }

    if (errorMessage.includes("net::ERR_CONNECTION_REFUSED")) {
      return NextResponse.json(
        {
          status: "error",
          error: "Connection refused by the target server.",
          code: "CONNECTION_REFUSED",
        },
        { status: 502, headers: rateLimitHeaders },
      );
    }

    if (errorMessage.includes("Timeout")) {
      return NextResponse.json(
        {
          status: "timeout",
          error: "Scan timed out. The target site may be slow or unresponsive.",
          code: "TIMEOUT",
        },
        { status: 504, headers: rateLimitHeaders },
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
      { status: 500, headers: rateLimitHeaders },
    );
  }
}
