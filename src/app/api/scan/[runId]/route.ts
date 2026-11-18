import { NextResponse } from "next/server";
import {
  RUN_ID_RE,
  ForeignRunError,
  getScanRun,
  mapRunError,
} from "@/lib/scan-runs";
import { DbInitError, initDb, saveScanForRun } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/scan/{runId}: poll a scan run.
 *   202 {status:"pending"}   queued or executing
 *   200 ScanResult (+scanId) finished, same shape POST /api/scan used to return
 *   4xx/5xx {status:"error"|"timeout", error, code}
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  if (!RUN_ID_RE.test(runId)) {
    return NextResponse.json(
      { status: "error", error: "Invalid run id", code: "INVALID_RUN_ID" },
      { status: 400 },
    );
  }

  try {
    const run = await getScanRun(runId);

    if (run.state === "pending") {
      return NextResponse.json({ status: "pending", runId }, { status: 202 });
    }

    if (run.state === "error") {
      const mapped = mapRunError(run.message);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    let scanId: number | undefined;
    if (run.result.status === "ok") {
      try {
        initDb();
        scanId = saveScanForRun(runId, run.result);
      } catch (dbError) {
        // Don't fail the request if the DB save fails.
        if (!(dbError instanceof DbInitError)) {
          console.error("[Scan DB Error]", dbError);
        }
      }
    }
    return NextResponse.json(scanId !== undefined ? { ...run.result, scanId } : run.result);
  } catch (err) {
    if (err instanceof ForeignRunError || (err as { status?: number })?.status === 404) {
      return NextResponse.json(
        { status: "error", error: "Scan run not found", code: "RUN_NOT_FOUND" },
        { status: 404 },
      );
    }
    console.error("[Scan Status Error]", err);
    return NextResponse.json(
      { status: "error", error: "Could not read scan status", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
