export function LoadingSkeleton() {
  return (
    <div className="mt-8 space-y-4 motion-safe:animate-pulse" role="status" aria-label="Scanning">
      <div className="h-32 border-2 border-ink bg-panel" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-64 border-2 border-ink bg-panel md:col-span-2" />
        <div className="h-64 border-2 border-ink bg-panel" />
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center border-2 border-dashed border-ink-soft bg-panel py-12 text-center">
      <svg className="h-10 w-10 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <p className="mt-4 text-sm text-ink-soft">Enter a URL above to scan for consent patterns</p>
    </div>
  );
}
