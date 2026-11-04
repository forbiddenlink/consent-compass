interface SignalSectionProps {
  label: string;
  children: React.ReactNode;
}

export function SignalSection({ label, children }: SignalSectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{label}</div>
      <div className="font-mono text-sm text-ink break-words">{children}</div>
    </div>
  );
}

export function EmptyData() {
  return <span className="text-ink-soft">—</span>;
}
