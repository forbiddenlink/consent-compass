/**
 * Browser-side helper: submit a scan, then poll its run until it finishes.
 * Resolves with the same JSON the old synchronous POST /api/scan returned.
 */

export const SCAN_POLL_INTERVAL_MS = 2000;
export const SCAN_POLL_TIMEOUT_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function scanViaApi<T = unknown>(
  url: string,
  {
    intervalMs = SCAN_POLL_INTERVAL_MS,
    timeoutMs = SCAN_POLL_TIMEOUT_MS,
  }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const submit = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const submitted = await submit.json();
  if (!submit.ok) throw new Error(submitted?.error ?? "Scan failed");

  const runId: unknown = submitted?.runId;
  if (typeof runId !== "string") throw new Error("Scan failed");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const res = await fetch(`/api/scan/${encodeURIComponent(runId)}`);
    const json = await res.json();
    if (res.status === 202) continue;
    if (!res.ok) throw new Error(json?.error ?? "Scan failed");
    return json as T;
  }
  throw new Error("Scan timed out. The target site may be slow or unresponsive.");
}
