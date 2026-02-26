/**
 * HTML template for PDF report generation.
 * This is rendered server-side and converted to PDF via Playwright.
 */

import type { ScanResult, ConsentFinding } from "@/lib/types";

interface ReportTemplateProps {
  result: ScanResult;
  generatedAt: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#eab308"; // yellow
  if (score >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "fail": return "#ef4444";
    case "warn": return "#f97316";
    default: return "#6b7280";
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case "fail": return "FAIL";
    case "warn": return "WARN";
    default: return "INFO";
  }
}

export function renderReportHtml(props: ReportTemplateProps): string {
  const { result, generatedAt } = props;
  const scoreColor = getScoreColor(result.score.overall);

  // Filter to fail/warn findings only
  const importantFindings = result.findings.filter(
    (f) => f.severity === "fail" || f.severity === "warn"
  );

  // Cookie summary
  const cookiesByCategory = result.preConsent.cookiesByCategory || {
    necessary: 0,
    functional: 0,
    analytics: 0,
    marketing: 0,
    unknown: 0,
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Consent Compass Report - ${result.url}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }
    .logo span { color: #6366f1; }
    .meta {
      text-align: right;
      color: #6b7280;
      font-size: 10px;
    }
    .url {
      font-size: 14px;
      color: #374151;
      margin-top: 4px;
      word-break: break-all;
    }
    .score-section {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
    }
    .score-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
    }
    .score-value { font-size: 32px; }
    .score-label { font-size: 10px; opacity: 0.9; }
    .score-breakdown {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .score-item {
      background: #f9fafb;
      padding: 8px 12px;
      border-radius: 6px;
    }
    .score-item-label { font-size: 10px; color: #6b7280; }
    .score-item-value { font-size: 18px; font-weight: 600; }
    h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #111827;
    }
    .findings {
      margin-bottom: 24px;
    }
    .finding {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 4px solid;
    }
    .finding-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .finding-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      color: white;
    }
    .finding-title { font-weight: 600; }
    .finding-detail { color: #4b5563; font-size: 11px; }
    .cookies-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .cookies-table th,
    .cookies-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .cookies-table th {
      background: #f9fafb;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      color: #6b7280;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Consent<span>Compass</span></div>
      <div class="url">${escapeHtml(result.url)}</div>
    </div>
    <div class="meta">
      <div>Scanned: ${new Date(result.scannedAt).toLocaleString()}</div>
      <div>Report generated: ${generatedAt}</div>
      <div>Scanner v${result.meta?.scannerVersion || "unknown"}</div>
    </div>
  </div>

  <div class="score-section">
    <div class="score-circle" style="background: ${scoreColor}">
      <div class="score-value">${result.score.overall}</div>
      <div class="score-label">OVERALL</div>
    </div>
    <div class="score-breakdown">
      <div class="score-item">
        <div class="score-item-label">Choice Symmetry</div>
        <div class="score-item-value" style="color: ${getScoreColor(result.score.choiceSymmetry)}">${result.score.choiceSymmetry}</div>
      </div>
      <div class="score-item">
        <div class="score-item-label">Pre-Consent Signals</div>
        <div class="score-item-value" style="color: ${getScoreColor(result.score.preConsentSignals)}">${result.score.preConsentSignals}</div>
      </div>
      <div class="score-item">
        <div class="score-item-label">Accessibility</div>
        <div class="score-item-value" style="color: ${getScoreColor(result.score.accessibility)}">${result.score.accessibility}</div>
      </div>
      <div class="score-item">
        <div class="score-item-label">Transparency</div>
        <div class="score-item-value" style="color: ${getScoreColor(result.score.transparency)}">${result.score.transparency}</div>
      </div>
    </div>
  </div>

  ${importantFindings.length > 0 ? `
  <div class="findings">
    <h2>Key Findings (${importantFindings.length})</h2>
    ${importantFindings.map((f) => `
      <div class="finding" style="border-color: ${getSeverityColor(f.severity)}; background: ${f.severity === "fail" ? "#fef2f2" : "#fffbeb"}">
        <div class="finding-header">
          <span class="finding-badge" style="background: ${getSeverityColor(f.severity)}">${getSeverityLabel(f.severity)}</span>
          <span class="finding-title">${escapeHtml(f.title)}</span>
        </div>
        <div class="finding-detail">${escapeHtml(f.detail)}</div>
      </div>
    `).join("")}
  </div>
  ` : `
  <div class="findings">
    <h2>Key Findings</h2>
    <p style="color: #22c55e; font-weight: 600;">No critical issues found.</p>
  </div>
  `}

  <h2>Pre-Consent Cookies (${result.preConsent.cookies.length})</h2>
  <table class="cookies-table">
    <thead>
      <tr>
        <th>Category</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Necessary</td><td>${cookiesByCategory.necessary}</td></tr>
      <tr><td>Functional</td><td>${cookiesByCategory.functional}</td></tr>
      <tr><td>Analytics</td><td>${cookiesByCategory.analytics}</td></tr>
      <tr><td>Marketing</td><td>${cookiesByCategory.marketing}</td></tr>
      <tr><td>Unknown</td><td>${cookiesByCategory.unknown}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    Generated by Consent Compass | https://consentcompass.io
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
