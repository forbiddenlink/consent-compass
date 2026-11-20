import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  ScanRequestSchema,
  validateAndResolveUrl,
  ValidationError,
  RateLimitError,
} from "@/lib/validation";
import { checkClientGate, checkDomainGate } from "@/lib/scanGate";
import { triggerScan } from "@/lib/scan-runs";

export const runtime = "nodejs";

/**
 * POST /api/scan: validate, then hand the scan to Trigger.dev and return the
 * run id. No browser runs in this function. Poll GET /api/scan/{runId}.
 */
export async function POST(req: Request) {
  const gate = checkClientGate(req);
  if (!gate.ok) return gate.response;
  const rateLimitHeaders = gate.rateLimitHeaders;

  try {
    const body = ScanRequestSchema.parse(await req.json());

    const urlResult = await validateAndResolveUrl(body.url);
    if (!urlResult.valid) {
      return NextResponse.json(
        { status: "error", error: urlResult.error, code: "INVALID_URL" },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    const domain = new URL(urlResult.url).hostname;
    const cooldown = checkDomainGate(domain, rateLimitHeaders);
    if (cooldown) return cooldown;

    const runId = await triggerScan(urlResult.url);
    return NextResponse.json({ runId }, { status: 202, headers: rateLimitHeaders });
  } catch (err) {
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
        { status: "error", error: err.message, code: "VALIDATION_ERROR" },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { status: "error", error: err.message, code: "RATE_LIMITED", retryAfter: err.retryAfter },
        {
          status: 429,
          headers: { ...rateLimitHeaders, "Retry-After": String(err.retryAfter) },
        },
      );
    }

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
