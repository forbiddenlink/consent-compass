import { NextResponse } from "next/server";
import { scanUrl } from "@/lib/scan";
import { validateAndNormalizeUrl } from "@/lib/validation";
import { generatePdfFromHtml } from "@/lib/pdf";
import { renderReportHtml } from "@/components/ReportTemplate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format") || "pdf";

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  if (!["pdf", "json", "csv"].includes(format)) {
    return NextResponse.json(
      { error: "Invalid format. Use: pdf, json, or csv" },
      { status: 400 }
    );
  }

  // Validate URL
  const validation = validateAndNormalizeUrl(url);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const normalizedUrl = validation.url;
  const hostname = new URL(normalizedUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
  const timestamp = Date.now();

  try {
    // Run scan
    const result = await scanUrl(normalizedUrl);

    if (result.status !== "ok") {
      return NextResponse.json(
        { error: `Scan failed: ${result.status}` },
        { status: 500 }
      );
    }

    // JSON export
    if (format === "json") {
      const jsonContent = JSON.stringify(result, null, 2);
      return new NextResponse(jsonContent, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="consent-report-${hostname}-${timestamp}.json"`,
        },
      });
    }

    // CSV export (cookie inventory)
    if (format === "csv") {
      const csvContent = generateCookieCsv(result);
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cookies-${hostname}-${timestamp}.csv"`,
        },
      });
    }

    // PDF export (default)
    const html = renderReportHtml({
      result,
      generatedAt: new Date().toLocaleString(),
    });
    const pdfBuffer = await generatePdfFromHtml(html);

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

function generateCookieCsv(result: Awaited<ReturnType<typeof scanUrl>>): string {
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
