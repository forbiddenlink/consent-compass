import { NextResponse } from "next/server";
import { rescanDomain, rescanDomains } from "@/lib/rescan";

export const runtime = "nodejs";

// Allow longer timeout for batch re-scans (up to 5 minutes)
export const maxDuration = 300;

/**
 * Validate the API key from Authorization header.
 * Returns true if valid, false if missing or invalid.
 */
function validateApiKey(req: Request): boolean {
  const apiKey = process.env.RESCAN_API_KEY;

  // If no API key is configured, allow access (for development)
  if (!apiKey) {
    return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return false;
  }

  // Expected format: "Bearer <api-key>"
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }

  return match[1] === apiKey;
}

/**
 * POST /api/rescan
 *
 * Re-scans domains that have previous scans.
 *
 * Query params:
 *   - limit: max domains to rescan (default 10, max 50)
 *   - domain: specific domain to rescan (optional)
 *
 * Headers:
 *   - Authorization: Bearer <RESCAN_API_KEY> (required if RESCAN_API_KEY env var is set)
 *
 * Returns:
 * {
 *   scanned: number,
 *   results: Array<{
 *     domain: string,
 *     url: string,
 *     scanId: number,
 *     previousScanId: number,
 *     previousScore: number | null,
 *     newScore: number,
 *     regression: boolean,
 *     regressionAmount?: number
 *   }>
 * }
 */
export async function POST(req: Request) {
  // Validate API key
  if (!validateApiKey(req)) {
    return NextResponse.json(
      {
        status: "error",
        error: "Unauthorized. Provide a valid API key in the Authorization header.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const domainParam = url.searchParams.get("domain");
    const limitParam = url.searchParams.get("limit");

    // Parse and validate limit
    let limit = 10;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          {
            status: "error",
            error: "Invalid limit parameter. Must be a positive integer.",
            code: "INVALID_LIMIT",
          },
          { status: 400 }
        );
      }
      limit = Math.min(parsed, 50); // Cap at 50
    }

    // Single domain re-scan
    if (domainParam) {
      const result = await rescanDomain(domainParam);

      if (!result) {
        return NextResponse.json(
          {
            status: "error",
            error: `No previous scans found for domain: ${domainParam}`,
            code: "DOMAIN_NOT_FOUND",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        status: "ok",
        scanned: 1,
        results: [result],
        regressions: result.regression ? 1 : 0,
      });
    }

    // Batch re-scan
    const results = await rescanDomains(limit);

    const regressions = results.filter((r) => r.regression).length;

    return NextResponse.json({
      status: "ok",
      scanned: results.length,
      results,
      regressions,
    });
  } catch (err) {
    console.error("[Rescan Error]", err);
    return NextResponse.json(
      {
        status: "error",
        error: "An unexpected error occurred during re-scan.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
