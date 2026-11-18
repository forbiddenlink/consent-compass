import { task, queue } from "@trigger.dev/sdk/v3";
import { scanUrl as runScan } from "@/lib/scan";
import { SCAN_TASK_ID, SCAN_QUEUE_NAME } from "./ids";

// IMPORTANT: this file runs on the Trigger.dev worker, which must not hold the
// app's secrets. Keep its import graph to src/lib/scan and its pure helpers.
// Never import src/env.ts, db, resend, langfuse or arcjet here.

const scanQueue = queue({ name: SCAN_QUEUE_NAME, concurrencyLimit: 2 });

export const scanUrl = task({
  id: SCAN_TASK_ID,
  queue: scanQueue,
  machine: "medium-1x",
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  run: async (payload: { url: string }) => {
    return runScan(payload.url);
  },
});
