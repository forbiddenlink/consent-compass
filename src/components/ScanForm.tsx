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
    <section className="mt-8 border-2 border-ink bg-panel p-4 text-ink md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <label className="flex-1">
          <div className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-soft">Target URL</div>
          <input
            className="h-12 w-full border-2 border-ink bg-canvas px-4 font-mono text-sm font-medium text-ink outline-none placeholder:text-ink-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
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
          className="inline-flex h-12 items-center justify-center border-2 border-ink bg-signal px-8 text-sm font-bold uppercase tracking-widest text-ink transition-colors duration-150 hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onScan}
          disabled={loading}
        >
          {loading ? "Scanning…" : "Run scan"}
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-3 border-2 border-ink bg-signal px-4 py-3 text-sm font-medium text-ink">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}
    </section>
  );
}
