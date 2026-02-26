import { NextResponse } from "next/server";
import { getScansByDomain, getAllDomains, initDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/history
 *
 * Query parameters:
 * - domain (optional): Filter scans by domain
 * - limit (optional): Maximum number of results (default: 50)
 *
 * If domain is provided, returns list of scans for that domain.
 * If domain is not provided, returns list of all domains with scan counts.
 */
export async function GET(req: Request) {
  try {
    // Ensure database is initialized
    initDb();

    const url = new URL(req.url);
    const domain = url.searchParams.get("domain");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        {
          error: "Invalid limit parameter. Must be between 1 and 1000.",
        },
        { status: 400 }
      );
    }

    if (domain) {
      // Return scans for specific domain
      const scans = getScansByDomain(domain, limit);
      return NextResponse.json({
        domain,
        scans: scans.map((scan) => ({
          id: scan.id,
          url: scan.url,
          scannedAt: scan.scannedAt,
          score: scan.score,
          status: scan.status,
        })),
        total: scans.length,
      });
    }

    // Return all domains with counts
    const domains = getAllDomains();
    return NextResponse.json({
      domains: domains.map((d) => ({
        domain: d.domain,
        scanCount: d.scanCount,
        latestScan: d.latestScan,
      })),
      total: domains.length,
    });
  } catch (err) {
    console.error("[History API Error]", err);
    return NextResponse.json(
      {
        error: "Failed to retrieve scan history",
      },
      { status: 500 }
    );
  }
}
