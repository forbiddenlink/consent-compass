"use client";

import { useMemo } from "react";

interface ScorePillProps {
  label: string;
  value: number;
}

export function ScorePill({ label, value }: ScorePillProps) {
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
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${styles.border} ${styles.bg}`}>
      <span className="text-white/60">{label}</span>
      <span className={`font-semibold tabular-nums ${styles.text}`}>{value}</span>
    </div>
  );
}
