import { TRACKER_DOMAINS, type TrackerCategory, type TrackerInfo } from "./tracker-database";

export type { TrackerCategory, TrackerInfo };

/**
 * Classify a domain as a tracker
 *
 * Checks exact domain match first, then strips subdomains progressively.
 * Example: "pixel.facebook.com" -> try "pixel.facebook.com" -> "facebook.com"
 *
 * @param domain - The domain to classify (e.g., "www.google-analytics.com")
 * @returns TrackerInfo if domain is a known tracker, null otherwise
 */
export function classifyTrackerDomain(domain: string): TrackerInfo | null {
  if (!domain) return null;

  // Normalize: lowercase, remove trailing dot
  let normalized = domain.toLowerCase().replace(/\.$/, "");

  // Try exact match first
  const exact = TRACKER_DOMAINS.get(normalized);
  if (exact) return exact;

  // Strip subdomains progressively
  // "pixel.ads.facebook.com" -> "ads.facebook.com" -> "facebook.com"
  while (normalized.includes(".")) {
    const dotIndex = normalized.indexOf(".");
    normalized = normalized.slice(dotIndex + 1);

    const match = TRACKER_DOMAINS.get(normalized);
    if (match) return match;
  }

  return null;
}

/**
 * Check if a domain is a known tracker
 */
export function isTrackerDomain(domain: string): boolean {
  return classifyTrackerDomain(domain) !== null;
}

/**
 * Classify multiple domains and return summary
 */
export function classifyTrackerDomains(
  domains: string[]
): Map<string, TrackerInfo> {
  const results = new Map<string, TrackerInfo>();

  for (const domain of domains) {
    const info = classifyTrackerDomain(domain);
    if (info) {
      results.set(domain, info);
    }
  }

  return results;
}

/**
 * Count trackers by category
 */
export function countTrackersByCategory(
  domains: string[]
): Record<TrackerCategory, number> {
  const counts: Record<TrackerCategory, number> = {
    advertising: 0,
    analytics: 0,
    social: 0,
    fingerprinting: 0,
  };

  for (const domain of domains) {
    const info = classifyTrackerDomain(domain);
    if (info) {
      counts[info.category]++;
    }
  }

  return counts;
}
