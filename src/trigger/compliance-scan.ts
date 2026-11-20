import { task, schedules } from "@trigger.dev/sdk/v3";

// Daily compliance re-scan
export const dailyComplianceScan = schedules.task({
  id: "daily-compliance-scan",
  cron: "0 6 * * *",
  run: async () => {
    console.log("Running daily compliance re-scan");
    // TODO: Trigger re-scans for watched URLs
  },
});

export const scanUrl = task({
  id: "scan-url-compliance",
  retry: { maxAttempts: 2 },
  run: async (payload: { url: string; reportId: string }) => {
    console.log(`Scanning URL for compliance: ${payload.url}`);
  },
});
