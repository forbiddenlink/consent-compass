"use client";

import { useState } from "react";
import type { ScanResult } from "@/lib/types";
import {
  ScanForm,
  ScanResults,
  ResultsSidebar,
  LoadingSkeleton,
  EmptyState,
  ClickLedger,
} from "@/components";

// Sample fixture (FrictionAnalysis.acceptPath / rejectPath shape) on a reserved
// RFC 2606 host. Illustrative, not a live scan result.
const SAMPLE_ACCEPT_PATH = ["Accept all"];
const SAMPLE_REJECT_PATH = [
  "Manage preferences",
  "Turn off analytics and marketing",
  "Save choices",
];

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
    <div className="min-h-screen bg-canvas text-ink">
      {/* Hero */}
      <div className="on-cobalt bg-cobalt text-white">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-6 md:pb-20">
          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-white/40 pb-4 font-mono text-xs uppercase tracking-widest">
            <span className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-3 w-3 bg-signal" aria-hidden="true" />
              Consent Compass
            </span>
            <span>v0 — evidence-first consent scan</span>
          </header>

          <h1 className="display mt-12 max-w-5xl text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
            Count the clicks it takes to say no.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white">
            Enter a URL. We&apos;ll detect consent banners and generate an
            evidence-based compliance report.
          </p>

          {/* Input Section */}
          <ScanForm
            url={url}
            onUrlChange={setUrl}
            onScan={onScan}
            loading={loading}
            error={error}
          />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-12">
        {/* Signature object: the click path a scan measures, on a sample fixture */}
        <div className="-mt-8 md:-mt-10">
          <ClickLedger
            acceptPath={SAMPLE_ACCEPT_PATH}
            rejectPath={SAMPLE_REJECT_PATH}
            host="example.com"
            sample
          />
        </div>

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
        <footer className="mt-12 border-t-2 border-ink pt-4 font-mono text-xs text-ink-soft">
          v0 — Heuristic scan. Next: interaction replay, click-friction
          symmetry, pre-consent evidence deep-dive.
        </footer>
      </main>
    </div>
  );
}
