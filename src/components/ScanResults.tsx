import type { ScanResult } from "@/lib/types";
import { ClickLedger, ScoreHero, ScorePill, SeverityBadge } from "./ui";

interface ScanResultsProps {
  result: ScanResult;
}

export function ScanResults({ result }: ScanResultsProps) {
  return (
    <div className="border-2 border-ink bg-panel p-6 text-ink md:col-span-2 md:p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-soft">Overall Score</div>
          <div className="mt-3">
            <ScoreHero score={result.score.overall} />
          </div>
          <div className="mt-3 text-xs text-ink-soft">
            Scanned {new Date(result.scannedAt).toLocaleString()}
          </div>
        </div>
        <div className="text-right text-xs text-ink-soft">
          <div className="space-y-1">
            <div>Banner: <span className="text-ink font-semibold">{result.banner.detected ? "Detected" : "Not found"}</span></div>
            <div>Confidence: <span className="text-ink font-semibold">{(result.banner.confidence * 100).toFixed(0)}%</span></div>
          </div>
          <div className="mt-3 border-2 border-ink bg-canvas px-3 py-2">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Friction (clicks)</div>
            <div className="mt-1 flex items-center gap-3 text-sm">
              <span className="text-cobalt-deep font-semibold">Accept: {result.friction.acceptClicks ?? "—"}</span>
              <span className="text-signal-text font-semibold">Reject: {result.friction.rejectClicks ?? "—"}</span>
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

      {"acceptPath" in result.friction &&
        Array.isArray(result.friction.acceptPath) &&
        Array.isArray(result.friction.rejectPath) &&
        result.friction.acceptPath.length > 0 &&
        result.friction.rejectPath.length > 0 && (
          <div className="mt-8">
            <ClickLedger
              acceptPath={result.friction.acceptPath}
              rejectPath={result.friction.rejectPath}
              host={(() => {
                try {
                  return new URL(result.url).host;
                } catch {
                  return result.url;
                }
              })()}
            />
          </div>
        )}

      {/* Findings List */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-soft">Findings</span>
          <span className="border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
            {result.findings.length}
          </span>
        </div>
        <ul className="mt-4 space-y-3">
          {result.findings.map((f) => (
            <li key={f.id} className="border-2 border-ink bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-ink">{f.title}</div>
                <SeverityBadge severity={f.severity} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.detail}</p>
              {f.evidence && (
                <div className="mt-3 overflow-hidden border-2 border-rule-soft bg-panel px-3 py-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{f.evidence.kind}</span>
                  <div className="mt-1 font-mono text-xs text-ink break-all">{f.evidence.value}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
