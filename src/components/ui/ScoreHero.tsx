"use client";

import { useMemo } from "react";

interface ScoreHeroProps {
  score: number;
}

export function ScoreHero({ score }: ScoreHeroProps) {
  const styles = useMemo(() => {
    if (score >= 80) return "bg-cobalt text-white border-ink";
    if (score >= 60) return "bg-panel text-ink border-ink";
    return "bg-signal text-ink border-ink";
  }, [score]);

  return (
    <div className={`inline-flex h-20 w-24 flex-shrink-0 items-center justify-center border-2 ${styles}`}>
      <span className="display text-5xl tabular-nums">{score}</span>
    </div>
  );
}
