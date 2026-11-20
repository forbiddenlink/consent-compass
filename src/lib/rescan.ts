import { scanUrl } from "@/lib/scan";
import { initDb, saveScan, getDomainsForRescan, getDomainLatestScan } from "@/lib/db";
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

  return rescanDomainFromInfo(latestScan);
}

/**
 * Re-scan a domain using existing scan info.
 */
async function rescanDomainFromInfo(domainInfo: DomainForRescan): Promise<RescanResult> {
  // Perform the scan
  const result = await scanUrl(domainInfo.url);

  // Save the new scan
  const scanId = saveScan(result);

  // Extract new score
  const newScore = result.status === "ok" ? result.score.overall : 0;

  // Check for regression
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
 * Re-scan multiple domains.
 * Domains are selected by oldest scan first.
 */
export async function rescanDomains(limit: number = 10): Promise<RescanResult[]> {
  initDb();

  // Get domains to rescan, ordered by oldest scan first
  const domains = getDomainsForRescan(limit);

  const results: RescanResult[] = [];

  for (const domainInfo of domains) {
    try {
      const result = await rescanDomainFromInfo(domainInfo);
      results.push(result);
    } catch (err) {
      // Log error but continue with other domains
      console.error(`[Rescan Error] Failed to rescan ${domainInfo.domain}:`, err);
    }
  }

  return results;
}
