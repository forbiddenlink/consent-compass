import type { ConsentFinding } from "@/lib/types";

interface SeverityBadgeProps {
  severity: ConsentFinding["severity"];
}

const styles = {
  fail: "bg-signal text-ink border-ink",
  warn: "bg-panel text-signal-text border-signal-text",
  info: "bg-cobalt-tint text-cobalt-deep border-cobalt-deep",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-widest ${styles[severity]}`}>
      {severity}
    </span>
  );
}
