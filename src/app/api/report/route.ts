import { NextResponse } from "next/server";
import { validateAndResolveUrl } from "@/lib/validation";
import { generateReport } from "@/lib/pdf-report";
import {
  checkClientGate,
  checkDomainGate,
  tryAcquireScanSlot,
  serverBusyResponse,
} from "@/lib/scanGate";
import {
  RUN_ID_RE,
  ForeignRunError,
  getScanRun,
  mapRunError,
  triggerScan,
  waitForScan,
  type ScanRunState,
} from "@/lib/scan-runs";
import type { ScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/report?runId=... renders from a finished scan run, no new scan.
 * GET /api/report?url=...   triggers a scan on Trigger.dev and waits for it
 *                           inside this function (202 with runId if it is
 *                           still running when the wait budget ends).
 */
export async function GET(req: Request) {
  // Same client rate limit as /api/scan.
  const gate = checkClientGate(req);
  if (!gate.ok) return gate.response;
  const rateLimitHeaders = gate.rateLimitHeaders;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const runIdParam = searchParams.get("runId");
  const format = searchParams.get("format") || "pdf";

  if (!url && !runIdParam) {
    return NextResponse.json(
      { error: "Provide a 'url' or 'runId' query parameter" },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  if (!["pdf", "json", "csv"].includes(format)) {
    return NextResponse.json(
      { error: "Invalid format. Use: pdf, json, or csv" },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  try {
    let runId: string;
    let run: ScanRunState;
    let release: (() => void) | null = null;

    try {
      if (runIdParam) {
        if (!RUN_ID_RE.test(runIdParam)) {
          return NextResponse.json(
            { error: "Invalid runId" },
            { status: 400, headers: rateLimitHeaders }
          );
        }
        runId = runIdParam;
        run = await getScanRun(runId);
      } else {
        const validation = await validateAndResolveUrl(url as string);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error },
            { status: 400, headers: rateLimitHeaders }
          );
        }
        const cooldown = checkDomainGate(
          new URL(validation.url).hostname,
          rateLimitHeaders
        );
        if (cooldown) return cooldown;

        // This function now polls for up to the wait budget, so cap how many
        // requests can hold a slot at once.
        release = tryAcquireScanSlot();
        if (!release) return serverBusyResponse(rateLimitHeaders);

        runId = await triggerScan(validation.url);
        run = await waitForScan(runId, { timeoutMs: 270_000 });
      }
    } catch (err) {
      if (err instanceof ForeignRunError || (err as { status?: number })?.status === 404) {
        return NextResponse.json(
          { error: "Scan run not found" },
          { status: 404, headers: rateLimitHeaders }
        );
      }
      throw err;
    } finally {
      release?.();
    }

    if (run.state === "pending") {
      return NextResponse.json(
        { status: "pending", runId },
        { status: 202, headers: rateLimitHeaders }
      );
    }
    if (run.state === "error") {
      const mapped = mapRunError(run.message);
      return NextResponse.json(mapped.body, {
        status: mapped.status,
        headers: rateLimitHeaders,
      });
    }

    const result = run.result;
    if (result.status !== "ok") {
      return NextResponse.json(
        { error: `Scan failed: ${result.status}` },
        { status: 500, headers: rateLimitHeaders }
      );
    }

    const hostname = new URL(result.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const timestamp = Date.now();

    if (format === "json") {
      return new NextResponse(JSON.stringify(result, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="consent-report-${hostname}-${timestamp}.json"`,
        },
      });
    }

    if (format === "csv") {
      return new NextResponse(generateCookieCsv(result), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cookies-${hostname}-${timestamp}.csv"`,
        },
      });
    }

    const pdfBuffer = await generateReport(result);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="consent-report-${hostname}-${timestamp}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("[Report Error]", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function generateCookieCsv(result: ScanResult): string {
  const headers = ["Name", "Domain", "Category", "Vendor", "Phase"];
  const rows: string[][] = [];

  // Pre-consent cookies
  for (const cookie of result.preConsent.cookies) {
    rows.push([
      escapeCsvField(cookie.name),
      escapeCsvField(cookie.domain || ""),
      cookie.category,
      escapeCsvField(cookie.vendor || ""),
      "pre-consent",
    ]);
  }

  // Post-consent new cookies
  if (result.postConsent?.newCookies) {
    for (const cookie of result.postConsent.newCookies) {
      rows.push([
        escapeCsvField(cookie.name),
        escapeCsvField(cookie.domain || ""),
        cookie.category,
        escapeCsvField(cookie.vendor || ""),
        "post-consent",
      ]);
    }
  }

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
