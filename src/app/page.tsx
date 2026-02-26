"use client";

import { useMemo, useState } from "react";
import type { ScanResult, ConsentFinding } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────
   Design System Components
   ───────────────────────────────────────────────────────────── */

function ScorePill({ label, value }: { label: string; value: number }) {
  const styles = useMemo(() => {
    if (value >= 80) return {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20"
    };
    if (value >= 60) return {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20"
    };
    return {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20"
    };
  }, [value]);

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${styles.border} ${styles.bg}`}>
      <span className="text-white/60">{label}</span>
      <span className={`font-semibold tabular-nums ${styles.text}`}>{value}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: ConsentFinding["severity"] }) {
  const styles = {
    fail: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20"
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[severity]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

function ScoreHero({ score }: { score: number }) {
  const styles = useMemo(() => {
    if (score >= 80) return {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-400"
    };
    if (score >= 60) return {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      text: "text-amber-400"
    };
    return {
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      text: "text-rose-400"
    };
  }, [score]);

  return (
    <div className={`inline-flex h-20 w-20 items-center justify-center rounded-lg border ${styles.bg} ${styles.border}`}>
      <span className={`text-4xl font-semibold tabular-nums ${styles.text}`}>{score}</span>
    </div>
  );
}

function SignalSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-mono text-sm text-white/70">{children}</div>
    </div>
  );
}

function EmptyData() {
  return <span className="text-white/30">—</span>;
}

function LoadingSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-4">
      <div className="h-32 rounded-lg bg-white/[3%]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-64 rounded-lg bg-white/[3%] md:col-span-2" />
        <div className="h-64 rounded-lg bg-white/[3%]" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[2%] py-16 text-center">
      <svg className="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <p className="mt-4 text-sm text-white/50">Enter a URL above to scan for consent patterns</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────────────────────── */

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
        <section className="mt-10 rounded-lg border border-white/[8%] bg-white/[3%] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="flex-1">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">Target URL</div>
              <input
                className="w-full rounded-md border border-white/[8%] bg-[rgba(0,0,0,0.3)] px-4 py-3 text-sm outline-none transition placeholder:text-white/30 focus:border-white/[15%] focus:ring-2 focus:ring-white/10 focus:ring-offset-2 focus:ring-offset-[#05060a]"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                inputMode="url"
              />
            </label>

            <button
              className="inline-flex h-11 items-center justify-center rounded-md bg-white px-6 text-sm font-medium text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#05060a] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onScan}
              disabled={loading}
            >
              {loading ? "Scanning…" : "Run scan"}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}
        </section>

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Empty State */}
        {!loading && !result && !error && <EmptyState />}

        {/* Results */}
        {result && (
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {/* Main Findings Panel */}
            <div className="rounded-lg border border-white/[8%] bg-white/[3%] p-6 md:col-span-2">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-white/50">Overall Score</div>
                  <div className="mt-3">
                    <ScoreHero score={result.score.overall} />
                  </div>
                  <div className="mt-3 text-xs text-white/40">
                    Scanned {new Date(result.scannedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right text-xs text-white/50">
                  <div className="space-y-1">
                    <div>Banner: <span className="text-white/70">{result.banner.detected ? "Detected" : "Not found"}</span></div>
                    <div>Confidence: <span className="text-white/70">{(result.banner.confidence * 100).toFixed(0)}%</span></div>
                  </div>
                  <div className="mt-3 rounded-md border border-white/[8%] bg-white/[3%] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-white/40">Friction (clicks)</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <span className="text-emerald-400">Accept: {result.friction.acceptClicks ?? "—"}</span>
                      <span className="text-rose-400">Reject: {result.friction.rejectClicks ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Pills */}
              <div className="mt-6 flex flex-wrap gap-2">
                <ScorePill label="Choice Symmetry" value={result.score.choiceSymmetry} />
                <ScorePill label="Pre-consent" value={result.score.preConsentSignals} />
                <ScorePill label="Accessibility" value={result.score.accessibility} />
                <ScorePill label="Transparency" value={result.score.transparency} />
              </div>

              {/* Findings List */}
              <div className="mt-8">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/50">Findings</span>
                  <span className="rounded-full bg-white/[6%] px-2 py-0.5 text-[11px] font-medium text-white/50">
                    {result.findings.length}
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  {result.findings.map((f) => (
                    <li key={f.id} className="rounded-lg border border-white/[8%] bg-white/[3%] p-4 transition hover:border-white/[12%]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-white/90">{f.title}</div>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/60">{f.detail}</p>
                      {f.evidence && (
                        <div className="mt-3 rounded-md border-l-2 border-white/20 bg-black/40 px-3 py-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">{f.evidence.kind}</span>
                          <div className="mt-1 font-mono text-xs text-white/60 break-all">{f.evidence.value}</div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sidebar: Artifacts & Signals */}
            <div className="rounded-lg border border-white/[8%] bg-white/[3%] p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-white/50">Artifacts</div>
              <div className="mt-3">
                <SignalSection label="Screenshot">
                  {result.artifacts.screenshotPath || <EmptyData />}
                </SignalSection>
              </div>

              <hr className="my-6 border-white/[6%]" />

              <div className="text-xs font-medium uppercase tracking-wide text-white/50">Signal Summary</div>
              <div className="mt-4 space-y-5">
                <SignalSection label="Accept buttons">
                  {result.banner.acceptButtons.length ? result.banner.acceptButtons.join(" · ") : <EmptyData />}
                </SignalSection>

                <SignalSection label="Reject buttons">
                  {result.banner.rejectButtons.length ? result.banner.rejectButtons.join(" · ") : <EmptyData />}
                </SignalSection>

                <SignalSection label="Manage preferences">
                  {result.banner.managePrefsButtons.length ? result.banner.managePrefsButtons.join(" · ") : <EmptyData />}
                </SignalSection>

                <SignalSection label="Matched selectors">
                  {result.banner.selectors.length ? result.banner.selectors.join(" · ") : <EmptyData />}
                </SignalSection>

                <hr className="border-white/[6%]" />

                {/* Cookie Categories */}
                {result.preConsent.cookiesByCategory && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">Cookies by Category</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-1">
                        <span className="text-emerald-400">Necessary</span>
                        <span className="font-mono text-emerald-300">{result.preConsent.cookiesByCategory.necessary}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-sky-500/10 px-2 py-1">
                        <span className="text-sky-400">Functional</span>
                        <span className="font-mono text-sky-300">{result.preConsent.cookiesByCategory.functional}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1">
                        <span className="text-amber-400">Analytics</span>
                        <span className="font-mono text-amber-300">{result.preConsent.cookiesByCategory.analytics}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-rose-500/10 px-2 py-1">
                        <span className="text-rose-400">Marketing</span>
                        <span className="font-mono text-rose-300">{result.preConsent.cookiesByCategory.marketing}</span>
                      </div>
                    </div>
                    {result.preConsent.cookiesByCategory.unknown > 0 && (
                      <div className="text-[11px] text-white/40">
                        + {result.preConsent.cookiesByCategory.unknown} unclassified
                      </div>
                    )}
                  </div>
                )}

                {/* Google Consent Mode */}
                {result.googleConsentMode?.detected && (
                  <>
                    <hr className="border-white/[6%]" />
                    <div className="space-y-2">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">Google Consent Mode</div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          result.googleConsentMode.version === "v2"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {result.googleConsentMode.version?.toUpperCase() || "Detected"}
                        </span>
                        {result.googleConsentMode.issues && result.googleConsentMode.issues.length > 0 && (
                          <span className="text-[11px] text-rose-400">
                            {result.googleConsentMode.issues.length} issue(s)
                          </span>
                        )}
                      </div>
                      {result.googleConsentMode.signals && (
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          {Object.entries(result.googleConsentMode.signals).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                value === "granted" ? "bg-emerald-400" : value === "denied" ? "bg-rose-400" : "bg-white/20"
                              }`} />
                              <span className="text-white/50">{key.replace(/_/g, " ")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <hr className="border-white/[6%]" />

                <SignalSection label="Pre-consent cookies">
                  {result.preConsent.cookies.length
                    ? result.preConsent.cookies.slice(0, 10).map((c) => c.name).join(" · ")
                    : <EmptyData />}
                </SignalSection>

                <SignalSection label="Pre-consent requests">
                  {result.preConsent.requests.length
                    ? result.preConsent.requests.slice(0, 6).map((r) => {
                        try {
                          return `${r.resourceType}: ${r.domain}`;
                        } catch {
                          return r.resourceType;
                        }
                      }).join(" · ")
                    : <EmptyData />}
                </SignalSection>
              </div>
            </div>
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
