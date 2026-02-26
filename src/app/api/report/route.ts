import { NextResponse } from "next/server";
import { scanUrl } from "@/lib/scan";
import { validateAndNormalizeUrl } from "@/lib/validation";
import { generatePdfFromHtml } from "@/lib/pdf";
import { renderReportHtml } from "@/components/ReportTemplate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
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

  try {
    // Run scan
    const result = await scanUrl(normalizedUrl);

    if (result.status !== "ok") {
      return NextResponse.json(
        { error: `Scan failed: ${result.status}` },
        { status: 500 }
      );
    }

    // Generate HTML report
    const html = renderReportHtml({
      result,
      generatedAt: new Date().toLocaleString(),
    });

    // Convert to PDF
    const pdfBuffer = await generatePdfFromHtml(html);

    // Return PDF
    const hostname = new URL(normalizedUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const filename = `consent-report-${hostname}-${Date.now()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
