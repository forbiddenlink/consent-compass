import { calculateClickAsymmetry } from "@/lib/friction";

interface ClickLedgerProps {
  /** Ordered click labels to accept (FrictionAnalysis.acceptPath). */
  acceptPath: string[];
  /** Ordered click labels to reject (FrictionAnalysis.rejectPath). */
  rejectPath: string[];
  /** Host the path was measured on. */
  host: string;
  /** Marks the ledger as a fixture rather than a live result. */
  sample?: boolean;
}

function Lane({
  label,
  path,
  baseline,
}: {
  label: string;
  path: string[];
  baseline: number;
}) {
  return (
    <li className="grid gap-3 md:grid-cols-[6rem_minmax(0,1fr)_8.5rem] md:items-stretch">
      <div className="flex items-center justify-between md:block">
        <div className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-soft">
          {label}
        </div>
      </div>
      <ol className="grid gap-2 md:grid-cols-3">
        {path.map((step, i) => {
          const extra = i + 1 > baseline;
          return (
            <li
              key={`${i}-${step}`}
              className={`flex items-start gap-3 border-2 border-ink px-3 py-3 ${
                extra ? "bg-signal text-ink" : "bg-cobalt text-white"
              }`}
            >
              <span className="font-mono text-xs font-semibold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold leading-snug">{step}</span>
              {extra && <span className="sr-only">(extra click)</span>}
            </li>
          );
        })}
      </ol>
      <div className="flex items-baseline gap-2 md:justify-end md:self-center">
        <span className="display text-5xl tabular-nums">{path.length}</span>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">
          {path.length === 1 ? "click" : "clicks"}
        </span>
      </div>
    </li>
  );
}

export function ClickLedger({ acceptPath, rejectPath, host, sample }: ClickLedgerProps) {
  const asymmetry = calculateClickAsymmetry(acceptPath.length, rejectPath.length);
  const extra = Math.max(0, rejectPath.length - acceptPath.length);

  return (
    <figure
      className="border-2 border-ink bg-panel text-ink"
      aria-label={`Click path to accept versus reject on ${host}`}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b-2 border-ink bg-canvas px-4 py-2.5 font-mono text-xs uppercase tracking-widest">
        <span className="font-semibold">Click path ledger</span>
        <span className="text-ink-soft">
          {sample ? "Sample fixture, not a live scan · " : ""}
          {host}
        </span>
      </figcaption>
      <ul className="space-y-5 p-4 md:p-6">
        <Lane label="Accept" path={acceptPath} baseline={acceptPath.length} />
        <Lane label="Reject" path={rejectPath} baseline={acceptPath.length} />
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-ink px-4 py-3 font-mono text-xs uppercase tracking-widest">
        <span>
          <span className="mr-2 inline-block h-2.5 w-2.5 border-2 border-ink bg-signal align-baseline" aria-hidden="true" />
          {extra} extra {extra === 1 ? "click" : "clicks"} to say no
        </span>
        <span className="font-semibold">Click asymmetry {asymmetry} / 100</span>
      </div>
    </figure>
  );
}
