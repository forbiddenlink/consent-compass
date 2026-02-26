import type { ScanResult } from "@/lib/types";
import { ScoreHero, ScorePill, SeverityBadge } from "./ui";

interface ScanResultsProps {
  result: ScanResult;
}

export function ScanResults({ result }: ScanResultsProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121212] p-6 shadow-sm md:col-span-2 md:p-8">
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
          <div className="mt-3 rounded-md border border-white/10 bg-[#1a1a1a] px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">Friction (clicks)</div>
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
          <span className="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50">
            {result.findings.length}
          </span>
        </div>
        <ul className="mt-4 space-y-3">
          {result.findings.map((f) => (
            <li key={f.id} className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4 transition-colors duration-150 hover:border-white/20">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-white/90">{f.title}</div>
                <SeverityBadge severity={f.severity} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{f.detail}</p>
              {f.evidence && (
                <div className="mt-3 overflow-hidden rounded-md border border-white/5 bg-[#121212] px-3 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">{f.evidence.kind}</span>
                  <div className="mt-1 font-mono text-xs text-white/60 break-all">{f.evidence.value}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
