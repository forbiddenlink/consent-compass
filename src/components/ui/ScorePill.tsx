"use client";

import { useMemo } from "react";

interface ScorePillProps {
  label: string;
  value: number;
}

export function ScorePill({ label, value }: ScorePillProps) {
  const mark = useMemo(() => {
    if (value >= 80) return "bg-cobalt";
    if (value >= 60) return "bg-panel";
    return "bg-signal";
  }, [value]);

  return (
    <div className="inline-flex items-center gap-2 border-2 border-ink bg-panel px-3 py-1 text-xs font-medium tracking-wide">
      <span className={`h-2.5 w-2.5 border-2 border-ink ${mark}`} aria-hidden="true" />
      <span className="text-ink-soft">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}
