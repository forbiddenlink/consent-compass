export function LoadingSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-4">
      <div className="h-32 rounded-xl bg-[#121212] border border-white/5" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-64 rounded-xl bg-[#121212] border border-white/5 md:col-span-2" />
        <div className="h-64 rounded-xl bg-[#121212] border border-white/5" />
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#121212] py-16 text-center">
      <svg className="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <p className="mt-4 text-sm text-white/50">Enter a URL above to scan for consent patterns</p>
    </div>
  );
}
