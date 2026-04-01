"use client";

import { useState } from "react";
import type { CookieScanResult } from "@/lib/cookies/scanner";
import { CookieTable } from "./CookieTable";
import { ComplianceReport } from "./ComplianceReport";

interface CookieScannerProps {
  initialUrl?: string;
  onScanComplete?: (result: CookieScanResult) => void;
}

type TabType = "cookies" | "compliance" | "raw";

export function CookieScanner({ initialUrl, onScanComplete }: CookieScannerProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CookieScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("cookies");

  const handleScan = async () => {
    if (!url.trim()) {
      setError("Please enter a URL to scan");
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Scan failed");
      }

      const scanData = await response.json();

      // Extract cookies from scan result and create CookieScanResult
      if (scanData.preConsent?.cookies) {
        const mockScanResult: CookieScanResult = {
          url,
          scannedAt: scanData.scannedAt ?? new Date().toISOString(),
          cookies: scanData.preConsent.cookies.map((c: {
            name: string;
            domain?: string;
            path?: string;
            value?: string;
            expires?: string;
            category: string;
            vendor?: string;
            description?: string;
          }) => ({
            ...c,
            categorizationSource: "ocd-exact" as const,
            confidence: 1,
            tcfPurposes: [],
            requiresConsent: c.category !== "necessary",
            isThirdParty: false,
          })),
          summary: {
            total: scanData.preConsent.cookies.length,
            byCategory: scanData.preConsent.cookiesByCategory ?? {
              necessary: 0,
              functional: 0,
              analytics: 0,
              marketing: 0,
              unknown: 0,
            },
            bySource: {
              "ocd-exact": scanData.preConsent.cookies.length,
              "ocd-prefix": 0,
              "local-pattern": 0,
              "domain-heuristic": 0,
              unknown: 0,
            },
            thirdPartyCount: 0,
            unknownCount: scanData.preConsent.cookiesByCategory?.unknown ?? 0,
            requiresConsentCount: scanData.preConsent.cookies.filter(
              (c: { category: string }) => c.category !== "necessary"
            ).length,
          },
          confidence: {
            average: 1,
            highConfidence: scanData.preConsent.cookies.length,
            lowConfidence: 0,
            unknown: 0,
          },
          compliance: {
            hasPreConsentTracking:
              (scanData.preConsent.cookiesByCategory?.analytics ?? 0) > 0 ||
              (scanData.preConsent.cookiesByCategory?.marketing ?? 0) > 0,
            trackingCookieCount:
              (scanData.preConsent.cookiesByCategory?.analytics ?? 0) +
              (scanData.preConsent.cookiesByCategory?.marketing ?? 0),
            severity:
              (scanData.preConsent.cookiesByCategory?.marketing ?? 0) > 0
                ? "fail"
                : (scanData.preConsent.cookiesByCategory?.analytics ?? 0) > 0
                  ? "warn"
                  : "none",
            issues: [],
          },
        };

        setResult(mockScanResult);
        onScanComplete?.(mockScanResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setScanning(false);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "cookies", label: "Cookies" },
    { id: "compliance", label: "Compliance" },
    { id: "raw", label: "Raw Data" },
  ];

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white placeholder:text-white/40 focus:border-blue-500 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
        />
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Scan Cookies"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-white/10 bg-[#121212]">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-500 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "cookies" && (
              <CookieTable cookies={result.cookies} summary={result.summary} />
            )}
            {activeTab === "compliance" && (
              <ComplianceReport scanResult={result} />
            )}
            {activeTab === "raw" && (
              <pre className="max-h-96 overflow-auto rounded-lg bg-[#1a1a1a] p-4 text-xs text-white/70">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
