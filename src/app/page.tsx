"use client";

import { useMemo, useState } from "react";
import type { ScanResult } from "@/lib/types";

function ScorePill({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? "bg-emerald-500/15 text-emerald-300" : value >= 60 ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300";
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs">
      <span className="text-white/70">{label}</span>
      <span className={`rounded-full px-2 py-0.5 font-medium ${tone}`}>{value}</span>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const overallTone = useMemo(() => {
    const v = result?.score.overall ?? 0;
    if (v >= 80) return "text-emerald-300";
    if (v >= 60) return "text-amber-300";
    return "text-rose-300";
  }, [result?.score.overall]);

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
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Consent Compass v0 — evidence-first consent scan
          </div>

          <h1 className="text-4xl font-semibold tracking-tight">Consent Compass</h1>
          <p className="max-w-2xl text-white/70">
            Enter a URL. We’ll attempt to detect a consent banner/CMP and generate a first-pass evidence report.
            (Heuristic v0 — we’re optimizing for a sick demo first.)
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex-1">
              <div className="mb-2 text-xs font-medium text-white/70">Target URL</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none ring-0 placeholder:text-white/30 focus:border-white/20"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                inputMode="url"
              />
            </label>

            <button
              className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 md:mt-7"
              onClick={onScan}
              disabled={loading}
            >
              {loading ? "Scanning…" : "Run scan"}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-white/60">Overall score</div>
                  <div className={`mt-1 text-4xl font-semibold ${overallTone}`}>{result.score.overall}</div>
                  <div className="mt-2 text-xs text-white/50">Scanned {new Date(result.scannedAt).toLocaleString()}</div>
                </div>
                <div className="text-right text-xs text-white/60">
                  <div>Banner detected: {result.banner.detected ? "yes" : "no"}</div>
                  <div>Confidence: {(result.banner.confidence * 100).toFixed(0)}%</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <ScorePill label="Choice symmetry" value={result.score.choiceSymmetry} />
                <ScorePill label="Pre-consent" value={result.score.preConsentSignals} />
                <ScorePill label="A11y" value={result.score.accessibility} />
                <ScorePill label="Transparency" value={result.score.transparency} />
              </div>

              <div className="mt-6">
                <div className="text-xs font-medium text-white/70">Findings</div>
                <ul className="mt-3 space-y-2">
                  {result.findings.map((f) => (
                    <li key={f.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{f.title}</div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                          {f.severity}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-white/70">{f.detail}</div>
                      {f.evidence ? (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white/70">
                          {f.evidence.kind}: {f.evidence.value}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-medium text-white/70">Artifacts</div>
              <div className="mt-3 text-sm text-white/70">
                <div className="flex items-center justify-between gap-2">
                  <span>Screenshot</span>
                  <span className="font-mono text-xs text-white/60">{result.artifacts.screenshotPath ?? "—"}</span>
                </div>
              </div>

              <div className="mt-6 text-xs font-medium text-white/70">Signal summary</div>
              <div className="mt-3 space-y-2 text-sm text-white/70">
                <div>
                  <div className="text-xs text-white/60">Accept buttons (heuristic)</div>
                  <div className="mt-1 font-mono text-xs text-white/70">
                    {result.banner.acceptButtons.length ? result.banner.acceptButtons.join(" · ") : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/60">Reject buttons (heuristic)</div>
                  <div className="mt-1 font-mono text-xs text-white/70">
                    {result.banner.rejectButtons.length ? result.banner.rejectButtons.join(" · ") : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/60">Matched selectors</div>
                  <div className="mt-1 font-mono text-xs text-white/70">
                    {result.banner.selectors.length ? result.banner.selectors.join(" · ") : "—"}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="mt-12 text-xs text-white/40">
          v0 note: this scan is heuristic. Next: interaction replay, click-friction symmetry, and pre-consent cookie/network evidence.
        </footer>
      </div>
    </div>
  );
}
