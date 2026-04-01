"use client";

import { useState } from "react";
import type { ScannedCookie, CookieScanResult } from "@/lib/cookies/scanner";
import type { CookieCategory } from "@/lib/types";

interface CookieTableProps {
  cookies: ScannedCookie[];
  summary: CookieScanResult["summary"];
}

const CATEGORY_COLORS: Record<CookieCategory, { bg: string; text: string; border: string }> = {
  necessary: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  functional: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  analytics: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  marketing: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  unknown: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30" },
};

const CATEGORY_LABELS: Record<CookieCategory, string> = {
  necessary: "Necessary",
  functional: "Functional",
  analytics: "Analytics",
  marketing: "Marketing",
  unknown: "Unknown",
};

function CategoryBadge({ category }: { category: CookieCategory }) {
  const colors = CATEGORY_COLORS[category];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let color = "text-gray-400";
  if (confidence >= 0.8) color = "text-emerald-400";
  else if (confidence >= 0.5) color = "text-amber-400";
  else if (confidence > 0) color = "text-red-400";

  return (
    <span className={`text-xs ${color}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

export function CookieTable({ cookies, summary }: CookieTableProps) {
  const [filter, setFilter] = useState<CookieCategory | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "category" | "confidence">("category");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filteredCookies = cookies.filter(
    (c) => filter === "all" || c.category === filter
  );

  const sortedCookies = [...filteredCookies].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "category") return a.category.localeCompare(b.category);
    if (sortBy === "confidence") return b.confidence - a.confidence;
    return 0;
  });

  const categories: CookieCategory[] = ["necessary", "functional", "analytics", "marketing", "unknown"];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {categories.map((cat) => {
          const count = summary.byCategory[cat];
          const colors = CATEGORY_COLORS[cat];
          return (
            <button
              type="button"
              key={cat}
              onClick={() => setFilter(filter === cat ? "all" : cat)}
              className={`rounded-lg border p-3 text-left transition-all ${
                filter === cat
                  ? `${colors.border} ${colors.bg}`
                  : "border-white/10 bg-[#1a1a1a] hover:border-white/20"
              }`}
            >
              <div className={`text-2xl font-semibold ${colors.text}`}>{count}</div>
              <div className="text-xs text-white/50">{CATEGORY_LABELS[cat]}</div>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/50">
          Showing {sortedCookies.length} of {cookies.length} cookies
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded border border-white/10 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
          >
            <option value="category">Category</option>
            <option value="name">Name</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-[#1a1a1a]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                Cookie
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                Consent
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedCookies.map((cookie) => (
              <>
                <tr
                  key={cookie.name}
                  className="cursor-pointer transition-colors hover:bg-white/5"
                  onClick={() => setExpanded(expanded === cookie.name ? null : cookie.name)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm text-white">{cookie.name}</div>
                    {cookie.domain && (
                      <div className="text-xs text-white/40">{cookie.domain}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={cookie.category} />
                  </td>
                  <td className="px-4 py-3 text-sm text-white/70">
                    {cookie.vendor ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge confidence={cookie.confidence} />
                  </td>
                  <td className="px-4 py-3">
                    {cookie.requiresConsent ? (
                      <span className="text-xs text-amber-400">Required</span>
                    ) : (
                      <span className="text-xs text-emerald-400">Not required</span>
                    )}
                  </td>
                </tr>
                {expanded === cookie.name && (
                  <tr key={`${cookie.name}-details`} className="bg-white/5">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-white/40">
                            Description
                          </div>
                          <div className="mt-1 text-white/70">
                            {cookie.description ?? "No description available"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-white/40">
                            Source
                          </div>
                          <div className="mt-1 text-white/70">
                            {cookie.categorizationSource}
                          </div>
                        </div>
                        {cookie.tcfPurposes.length > 0 && (
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-white/40">
                              TCF Purposes
                            </div>
                            <div className="mt-1 text-white/70">
                              {cookie.tcfPurposes.join(", ")}
                            </div>
                          </div>
                        )}
                        {cookie.lifespan && (
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-white/40">
                              Lifespan
                            </div>
                            <div className="mt-1 text-white/70">
                              {cookie.lifespan === "session"
                                ? "Session"
                                : `${cookie.lifespanDays} days`}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-white/40">
                            Third-party
                          </div>
                          <div className="mt-1 text-white/70">
                            {cookie.isThirdParty ? "Yes" : "No"}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {sortedCookies.length === 0 && (
          <div className="px-4 py-8 text-center text-white/40">
            No cookies found matching the current filter
          </div>
        )}
      </div>
    </div>
  );
}
