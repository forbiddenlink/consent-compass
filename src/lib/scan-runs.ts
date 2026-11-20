/**
 * Vercel-side client for the scan-url-compliance Trigger.dev task. The browser
 * runs on the Trigger.dev worker; this module only submits and reads runs.
 * It imports the task type only, so the scanner is never bundled here.
 */

import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { scanUrl as scanTask } from "@/trigger/compliance-scan";
import { SCAN_TASK_ID } from "@/trigger/ids";
import type { ScanResult } from "@/lib/types";

export const RUN_ID_RE = /^run_[a-z0-9]{8,64}$/;

export class ForeignRunError extends Error {
  constructor() {
    super("Run is not a scan run");
    this.name = "ForeignRunError";
  }
}

export type ScanRunState =
  | { state: "pending" }
  | { state: "expired" }
  | { state: "error"; message: string }
  | { state: "ok"; result: ScanResult };

const PENDING = new Set([
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
]);

/** An unstarted run expires after this long instead of running late. */
export const SCAN_RUN_TTL = "10m";

/** Body and status for a run that expired in the queue. */
export const QUEUE_BUSY_RESPONSE = {
  status: 503,
  body: {
    status: "error" as const,
    error: "Scan queue is busy, try again",
    code: "QUEUE_BUSY",
  },
};

export async function triggerScan(url: string): Promise<string> {
  const handle = await tasks.trigger<typeof scanTask>(
    SCAN_TASK_ID,
    { url },
    { ttl: SCAN_RUN_TTL },
  );
  return handle.id;
}

export async function getScanRun(runId: string): Promise<ScanRunState> {
  const run = await runs.retrieve(runId);
  if (run.taskIdentifier !== SCAN_TASK_ID) throw new ForeignRunError();

  if (PENDING.has(run.status)) return { state: "pending" };
  if (run.status === "EXPIRED") return { state: "expired" };
  if (run.status === "COMPLETED" && run.output) {
    return { state: "ok", result: run.output as ScanResult };
  }
  return {
    state: "error",
    message: run.error?.message ?? `Scan run ended with status ${run.status}`,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a run until it finishes or the deadline passes (then returns pending). */
export async function waitForScan(
  runId: string,
  { intervalMs = 2000, timeoutMs = 280_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ScanRunState> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await getScanRun(runId);
    if (state.state !== "pending" || Date.now() >= deadline) return state;
    await sleep(intervalMs);
  }
}

/** Map a failed run's message to the HTTP error shape /api/scan always used. */
export function mapRunError(message: string): {
  status: number;
  body: { status: "error" | "timeout"; error: string; code: string };
} {
  if (message.includes("net::ERR_NAME_NOT_RESOLVED")) {
    return {
      status: 400,
      body: { status: "error", error: "Could not resolve domain. Please check the URL.", code: "DNS_ERROR" },
    };
  }
  if (message.includes("net::ERR_CONNECTION_REFUSED")) {
    return {
      status: 502,
      body: { status: "error", error: "Connection refused by the target server.", code: "CONNECTION_REFUSED" },
    };
  }
  if (message.includes("Timeout") || message.includes("exceeded maximum duration")) {
    return {
      status: 504,
      body: {
        status: "timeout",
        error: "Scan timed out. The target site may be slow or unresponsive.",
        code: "TIMEOUT",
      },
    };
  }
  console.error("[Scan Run Error]", message);
  return {
    status: 500,
    body: { status: "error", error: "An unexpected error occurred during the scan.", code: "INTERNAL_ERROR" },
  };
}
