import { triggerScan, waitForScan } from "@/lib/scan-runs";
import type { ScanResult } from "@/lib/types";
import { initDb, saveScanForRun, getDomainsForRescan, getDomainLatestScan } from "@/lib/db";
import type { DomainForRescan } from "@/lib/db";

/**
 * Result of a single domain re-scan.
 */
export type RescanResult = {
  domain: string;
  url: string;
  scanId: number;
  previousScanId: number;
  previousScore: number | null;
  newScore: number;
  regression: boolean;
  regressionAmount?: number;
};

/**
 * Regression threshold: flag if score drops by this many points or more.
 */
const REGRESSION_THRESHOLD = 10;

/**
 * Check if there's a regression between scores.
 * Regression is defined as score dropping by REGRESSION_THRESHOLD or more points.
 */
export function detectRegression(
  previousScore: number | null,
  newScore: number
): { regression: boolean; regressionAmount?: number } {
  if (previousScore === null) {
    return { regression: false };
  }

  const difference = previousScore - newScore;
  if (difference >= REGRESSION_THRESHOLD) {
    return { regression: true, regressionAmount: difference };
  }

  return { regression: false };
}

/**
 * Re-scan a single domain.
 * Uses the URL from the most recent scan of that domain.
 */
export async function rescanDomain(domain: string): Promise<RescanResult | null> {
  initDb();

  // Get the latest scan for this domain
  const latestScan = getDomainLatestScan(domain);
  if (!latestScan) {
    return null;
  }

  const [result] = await rescanFromInfos([latestScan]);
  if (!result) throw new Error(`Re-scan of ${domain} did not complete`);
  return result;
}

/** Wait budget for scans started from one request (the route allows 300s). */
const RESCAN_WAIT_MS = 270_000;

/**
 * Turn a finished scan into a RescanResult and save it. Saved once per run id,
 * so retrying a request never duplicates rows.
 */
function recordRescan(
  domainInfo: DomainForRescan,
  runId: string,
  result: ScanResult
): RescanResult {
  const scanId = saveScanForRun(runId, result);
  const newScore = result.status === "ok" ? result.score.overall : 0;
  const regressionCheck = detectRegression(domainInfo.lastScore, newScore);

  return {
    domain: domainInfo.domain,
    url: domainInfo.url,
    scanId,
    previousScanId: domainInfo.lastScanId,
    previousScore: domainInfo.lastScore,
    newScore,
    regression: regressionCheck.regression,
    regressionAmount: regressionCheck.regressionAmount,
  };
}

/**
 * Re-scan domains on Trigger.dev. All runs are triggered first (the task queue
 * limits how many execute at once), then polled until a shared deadline.
 * Domains whose run has not finished by then are skipped and logged.
 */
async function rescanFromInfos(infos: DomainForRescan[]): Promise<RescanResult[]> {
  const started = await Promise.all(
    infos.map(async (info) => {
      try {
        return { info, runId: await triggerScan(info.url) };
      } catch (err) {
        console.error(`[Rescan Error] Failed to start scan for ${info.domain}:`, err);
        return null;
      }
    })
  );

  const deadline = Date.now() + RESCAN_WAIT_MS;
  const results: RescanResult[] = [];

  await Promise.all(
    started.map(async (entry) => {
      if (!entry) return;
      try {
        const run = await waitForScan(entry.runId, {
          timeoutMs: Math.max(0, deadline - Date.now()),
        });
        if (run.state === "ok") {
          results.push(recordRescan(entry.info, entry.runId, run.result));
        } else {
          console.error(
            `[Rescan Error] Scan for ${entry.info.domain} ${run.state === "error" ? `failed: ${run.message}` : run.state === "expired" ? "expired in the queue" : "did not finish in time"}`
          );
        }
      } catch (err) {
        console.error(`[Rescan Error] Failed to rescan ${entry.info.domain}:`, err);
      }
    })
  );

  return results;
}

/**
 * Re-scan multiple domains.
 * Domains are selected by oldest scan first.
 */
export async function rescanDomains(limit: number = 10): Promise<RescanResult[]> {
  initDb();
  return rescanFromInfos(getDomainsForRescan(limit));
}
