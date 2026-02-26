"use client";

interface ScanFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onScan: () => void;
  loading: boolean;
  error: string | null;
}

export function ScanForm({ url, onUrlChange, onScan, loading, error }: ScanFormProps) {
  return (
    <section className="mt-10 rounded-xl border border-white/10 bg-[#121212] p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <label className="flex-1">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">Target URL</div>
          <input
            className="w-full rounded-md border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm font-medium outline-none transition-all duration-150 ease-in-out placeholder:font-normal placeholder:text-white/30 focus:border-white/20 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-[#121212]"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com"
            inputMode="url"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                onScan();
              }
            }}
          />
        </label>

        <button
          className="inline-flex h-11 items-center justify-center rounded-md bg-white px-6 text-sm font-medium tracking-tight text-black shadow-[inset_0_1px_rgba(255,255,255,0.2)] transition duration-150 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-[#121212] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onScan}
          disabled={loading}
        >
          {loading ? "Scanning…" : "Run scan"}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}
    </section>
  );
}
