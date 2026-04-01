"use client";

import type { CookieScanResult } from "@/lib/cookies/scanner";
import { generateComplianceReport, type ComplianceReport as ComplianceReportType } from "@/lib/cookies/scanner";
import type { CookieCategory } from "@/lib/types";

interface ComplianceReportProps {
  scanResult: CookieScanResult;
}

const STATUS_COLORS = {
  compliant: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  issues: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  "non-compliant": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
};

const SEVERITY_COLORS = {
  fail: { bg: "bg-red-500/10", text: "text-red-400", icon: "X" },
  warn: { bg: "bg-amber-500/10", text: "text-amber-400", icon: "!" },
  info: { bg: "bg-blue-500/10", text: "text-blue-400", icon: "i" },
};

const CATEGORY_LABELS: Record<CookieCategory, string> = {
  necessary: "Necessary",
  functional: "Functional",
  analytics: "Analytics",
  marketing: "Marketing",
  unknown: "Unknown",
};

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = "text-red-400";
  if (score >= 80) color = "text-emerald-400";
  else if (score >= 50) color = "text-amber-400";

  return (
    <div className="relative h-24 w-24">
      <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-white/10"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
      </div>
    </div>
  );
}

export function ComplianceReport({ scanResult }: ComplianceReportProps) {
  const report = generateComplianceReport(scanResult);

  const statusColors = STATUS_COLORS[report.overallStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Compliance Report</h3>
          <p className="mt-1 text-sm text-white/50">{report.url}</p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
            >
              {report.overallStatus === "compliant"
                ? "Compliant"
                : report.overallStatus === "issues"
                  ? "Issues Found"
                  : "Non-Compliant"}
            </span>
            <span className="text-xs text-white/40">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>
        <ScoreCircle score={report.score} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
          <div className="text-2xl font-semibold text-white">{report.summary.totalCookies}</div>
          <div className="text-xs text-white/50">Total Cookies</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
          <div className="text-2xl font-semibold text-emerald-400">
            {report.summary.categorizedCookies}
          </div>
          <div className="text-xs text-white/50">Categorized</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
          <div className="text-2xl font-semibold text-amber-400">
            {report.summary.unknownCookies}
          </div>
          <div className="text-xs text-white/50">Unknown</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
          <div className="text-2xl font-semibold text-blue-400">
            {report.summary.consentRequired}
          </div>
          <div className="text-xs text-white/50">Consent Required</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
          <div className="text-2xl font-semibold text-purple-400">
            {report.summary.thirdParty}
          </div>
          <div className="text-xs text-white/50">Third-party</div>
        </div>
      </div>

      {/* Issues */}
      {report.issues.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/50">
            Issues ({report.issues.length})
          </h4>
          <div className="space-y-2">
            {report.issues.map((issue, idx) => {
              const colors = SEVERITY_COLORS[issue.severity];
              return (
                <div
                  key={idx}
                  className={`rounded-lg border border-white/10 p-4 ${colors.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${colors.bg} ${colors.text}`}
                    >
                      <span className="text-xs font-bold">{colors.icon}</span>
                    </div>
                    <div>
                      <p className={`font-medium ${colors.text}`}>{issue.message}</p>
                      {issue.cookies && issue.cookies.length > 0 && (
                        <p className="mt-1 font-mono text-xs text-white/50">
                          {issue.cookies.slice(0, 5).join(", ")}
                          {issue.cookies.length > 5 && ` +${issue.cookies.length - 5} more`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/50">
            Recommendations
          </h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-1 text-emerald-400">+</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cookies by Category */}
      <div>
        <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/50">
          Cookies by Category
        </h4>
        <div className="space-y-3">
          {report.byCategory
            .filter((cat) => cat.count > 0)
            .map((cat) => (
              <div
                key={cat.category}
                className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-white">{cat.count}</span>
                    <span className="text-sm text-white/70">
                      {CATEGORY_LABELS[cat.category]}
                    </span>
                  </div>
                  <span
                    className={`text-xs ${
                      cat.requiresConsent ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {cat.requiresConsent ? "Consent required" : "No consent required"}
                  </span>
                </div>
                {cat.cookies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cat.cookies.slice(0, 8).map((cookie) => (
                      <span
                        key={cookie.name}
                        className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white/60"
                        title={cookie.description ?? cookie.vendor ?? undefined}
                      >
                        {cookie.name}
                      </span>
                    ))}
                    {cat.cookies.length > 8 && (
                      <span className="px-2 py-1 text-xs text-white/40">
                        +{cat.cookies.length - 8} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
