import { NextResponse } from "next/server";
import { getScanById, initDb } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/history/[id]
 *
 * Returns the full ScanResult for the given scan ID.
 */
export async function GET(req: Request, context: RouteContext) {
  try {
    // Ensure database is initialized
    initDb();

    const { id: idParam } = await context.params;
    const id = parseInt(idParam, 10);

    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        {
          error: "Invalid scan ID. Must be a positive integer.",
        },
        { status: 400 }
      );
    }

    const scan = getScanById(id);

    if (!scan) {
      return NextResponse.json(
        {
          error: "Scan not found",
        },
        { status: 404 }
      );
    }

    // Add the scan ID to the response
    return NextResponse.json({
      id,
      ...scan,
    });
  } catch (err) {
    console.error("[History API Error]", err);
    return NextResponse.json(
      {
        error: "Failed to retrieve scan",
      },
      { status: 500 }
    );
  }
}
