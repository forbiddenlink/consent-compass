interface SignalSectionProps {
  label: string;
  children: React.ReactNode;
}

export function SignalSection({ label, children }: SignalSectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-mono text-sm text-white/70">{children}</div>
    </div>
  );
}

export function EmptyData() {
  return <span className="text-white/30">—</span>;
}
