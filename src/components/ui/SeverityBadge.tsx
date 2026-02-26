import type { ConsentFinding } from "@/lib/types";

interface SeverityBadgeProps {
  severity: ConsentFinding["severity"];
}

const styles = {
  fail: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-sky-500/10 text-sky-400 border-sky-500/20"
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[severity]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}
