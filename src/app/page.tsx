"use client";

import { useState } from "react";
import type { ScanResult } from "@/lib/types";
import { ScanForm, ScanResults, ResultsSidebar, LoadingSkeleton, EmptyState } from "@/components";

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function onScan() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Scan failed");
      setResult(json as ScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[8%] bg-white/[3%] px-4 py-2 text-xs text-white/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Consent Compass v0 — evidence-first consent scan
          </div>

          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Consent Compass</h1>
          <p className="max-w-xl text-white/60">
            Enter a URL. We&apos;ll detect consent banners and generate an evidence-based compliance report.
          </p>
        </header>

        {/* Input Section */}
        <ScanForm
          url={url}
          onUrlChange={setUrl}
          onScan={onScan}
          loading={loading}
          error={error}
        />

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Empty State */}
        {!loading && !result && !error && <EmptyState />}

        {/* Results */}
        {result && (
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <ScanResults result={result} />
            <ResultsSidebar result={result} />
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 text-xs text-white/30">
          v0 — Heuristic scan. Next: interaction replay, click-friction symmetry, pre-consent evidence deep-dive.
        </footer>
      </div>
    </div>
  );
}
