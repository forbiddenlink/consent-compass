"use client";

import { useMemo } from "react";

interface ScoreHeroProps {
  score: number;
}

export function ScoreHero({ score }: ScoreHeroProps) {
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
