import type {
  ScanResult,
  CategorizedCookie,
  ConsentFinding,
  TrackedRequest,
} from "./types";

/**
 * Score change information.
 */
export type ScoreChange = {
  delta: number;
  direction: "improved" | "regressed" | "unchanged";
  oldScore: number;
  newScore: number;
};

/**
 * Cookie diff item.
 */
export type CookieDiff = {
  name: string;
  domain?: string;
  category: CategorizedCookie["category"];
};

/**
 * Finding diff item.
 */
export type FindingDiff = {
  id: string;
  title: string;
  severity: ConsentFinding["severity"];
};

/**
 * Tracker diff item.
 */
export type TrackerDiff = {
  url: string;
  domain: string;
  vendor?: string;
  category?: TrackedRequest["trackerCategory"];
};

/**
 * Full diff result between two scans.
 */
export type ScanDiff = {
  // Metadata
  scan1Id?: number;
  scan2Id?: number;
  scan1Date: string;
  scan2Date: string;

  // Score changes
  scoreChange: ScoreChange;

  // Cookie changes (pre-consent cookies)
  cookiesAdded: CookieDiff[];
  cookiesRemoved: CookieDiff[];

  // Finding changes
  findingsAdded: FindingDiff[];
  findingsResolved: FindingDiff[];

  // Tracker changes
  trackersAdded: TrackerDiff[];
  trackersRemoved: TrackerDiff[];

  // Summary
  summary: {
    hasScoreChange: boolean;
    hasCookieChanges: boolean;
    hasFindingChanges: boolean;
    hasTrackerChanges: boolean;
    totalChanges: number;
  };
};

/**
 * Generate a unique key for a cookie (for comparison).
 */
function cookieKey(cookie: CategorizedCookie): string {
  return `${cookie.name}:${cookie.domain ?? ""}:${cookie.category}`;
}

/**
 * Generate a unique key for a tracker request (for comparison).
 */
function trackerKey(tracker: TrackedRequest): string {
  return tracker.url;
}

/**
 * Compare two sets using key functions.
 * Returns items that are in set1 but not in set2 (removed),
 * and items in set2 but not in set1 (added).
 */
function diffSets<T>(
  set1: T[],
  set2: T[],
  keyFn: (item: T) => string
): { added: T[]; removed: T[] } {
  const keys1 = new Set(set1.map(keyFn));
  const keys2 = new Set(set2.map(keyFn));

  const added = set2.filter((item) => !keys1.has(keyFn(item)));
  const removed = set1.filter((item) => !keys2.has(keyFn(item)));

  return { added, removed };
}

/**
 * Compare two scan results and return a diff object.
 *
 * @param scan1 - The older/baseline scan (before)
 * @param scan2 - The newer scan (after)
 * @param scan1Id - Optional ID for scan1
 * @param scan2Id - Optional ID for scan2
 */
export function diffScans(
  scan1: ScanResult,
  scan2: ScanResult,
  scan1Id?: number,
  scan2Id?: number
): ScanDiff {
  // Score comparison
  const oldScore = scan1.status === "ok" ? scan1.score.overall : 0;
  const newScore = scan2.status === "ok" ? scan2.score.overall : 0;
  const delta = newScore - oldScore;

  const scoreChange: ScoreChange = {
    delta,
    direction: delta > 0 ? "improved" : delta < 0 ? "regressed" : "unchanged",
    oldScore,
    newScore,
  };

  // Cookie comparison (pre-consent cookies)
  const cookies1 = scan1.preConsent?.cookies ?? [];
  const cookies2 = scan2.preConsent?.cookies ?? [];
  const cookieDiff = diffSets(cookies1, cookies2, cookieKey);

  const cookiesAdded: CookieDiff[] = cookieDiff.added.map((c) => ({
    name: c.name,
    domain: c.domain,
    category: c.category,
  }));

  const cookiesRemoved: CookieDiff[] = cookieDiff.removed.map((c) => ({
    name: c.name,
    domain: c.domain,
    category: c.category,
  }));

  // Finding comparison
  const findings1 = scan1.findings ?? [];
  const findings2 = scan2.findings ?? [];
  const findingDiff = diffSets(findings1, findings2, (f) => f.id);

  const findingsAdded: FindingDiff[] = findingDiff.added.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
  }));

  const findingsResolved: FindingDiff[] = findingDiff.removed.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
  }));

  // Tracker comparison (only tracking requests)
  const trackers1 = (scan1.preConsent?.requests ?? []).filter((r) => r.isTracker);
  const trackers2 = (scan2.preConsent?.requests ?? []).filter((r) => r.isTracker);
  const trackerDiff = diffSets(trackers1, trackers2, trackerKey);

  const trackersAdded: TrackerDiff[] = trackerDiff.added.map((t) => ({
    url: t.url,
    domain: t.domain,
    vendor: t.vendor,
    category: t.trackerCategory,
  }));

  const trackersRemoved: TrackerDiff[] = trackerDiff.removed.map((t) => ({
    url: t.url,
    domain: t.domain,
    vendor: t.vendor,
    category: t.trackerCategory,
  }));

  // Summary
  const hasScoreChange = delta !== 0;
  const hasCookieChanges = cookiesAdded.length > 0 || cookiesRemoved.length > 0;
  const hasFindingChanges =
    findingsAdded.length > 0 || findingsResolved.length > 0;
  const hasTrackerChanges =
    trackersAdded.length > 0 || trackersRemoved.length > 0;

  const totalChanges =
    cookiesAdded.length +
    cookiesRemoved.length +
    findingsAdded.length +
    findingsResolved.length +
    trackersAdded.length +
    trackersRemoved.length;

  return {
    scan1Id,
    scan2Id,
    scan1Date: scan1.scannedAt,
    scan2Date: scan2.scannedAt,
    scoreChange,
    cookiesAdded,
    cookiesRemoved,
    findingsAdded,
    findingsResolved,
    trackersAdded,
    trackersRemoved,
    summary: {
      hasScoreChange,
      hasCookieChanges,
      hasFindingChanges,
      hasTrackerChanges,
      totalChanges,
    },
  };
}
