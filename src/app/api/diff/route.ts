import { NextResponse } from "next/server";
import { getScanById, initDb } from "@/lib/db";
import { diffScans } from "@/lib/diff";

export const runtime = "nodejs";

/**
 * GET /api/diff
 *
 * Query parameters:
 * - id1 (required): ID of the first (older/baseline) scan
 * - id2 (required): ID of the second (newer) scan
 *
 * Returns a diff object comparing the two scans.
 */
export async function GET(req: Request) {
  try {
    // Ensure database is initialized
    initDb();

    const url = new URL(req.url);
    const id1Param = url.searchParams.get("id1");
    const id2Param = url.searchParams.get("id2");

    // Validate parameters
    if (!id1Param || !id2Param) {
      return NextResponse.json(
        {
          error: "Missing required parameters: id1 and id2",
        },
        { status: 400 }
      );
    }

    const id1 = parseInt(id1Param, 10);
    const id2 = parseInt(id2Param, 10);

    if (isNaN(id1) || id1 < 1) {
      return NextResponse.json(
        {
          error: "Invalid id1 parameter. Must be a positive integer.",
        },
        { status: 400 }
      );
    }

    if (isNaN(id2) || id2 < 1) {
      return NextResponse.json(
        {
          error: "Invalid id2 parameter. Must be a positive integer.",
        },
        { status: 400 }
      );
    }

    if (id1 === id2) {
      return NextResponse.json(
        {
          error: "Cannot compare a scan with itself. id1 and id2 must be different.",
        },
        { status: 400 }
      );
    }

    // Fetch both scans
    const scan1 = getScanById(id1);
    const scan2 = getScanById(id2);

    if (!scan1) {
      return NextResponse.json(
        {
          error: `Scan with id ${id1} not found`,
        },
        { status: 404 }
      );
    }

    if (!scan2) {
      return NextResponse.json(
        {
          error: `Scan with id ${id2} not found`,
        },
        { status: 404 }
      );
    }

    // Generate diff
    const diff = diffScans(scan1, scan2, id1, id2);

    return NextResponse.json(diff);
  } catch (err) {
    console.error("[Diff API Error]", err);
    return NextResponse.json(
      {
        error: "Failed to generate diff",
      },
      { status: 500 }
    );
  }
}
