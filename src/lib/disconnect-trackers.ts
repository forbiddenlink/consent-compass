/**
 * Disconnect Tracker List Integration
 *
 * Integrates the Disconnect tracking protection list for enhanced tracker detection.
 * Source: https://github.com/nickoftime5/nickoftime5-disconnectme-disconnect/tree/master/services.json
 *
 * This complements WhoTracksMe with Disconnect's categorization which is used by:
 * - Firefox Enhanced Tracking Protection
 * - Safari Intelligent Tracking Prevention
 * - DuckDuckGo Privacy Browser
 *
 * Categories follow Disconnect's classification:
 * - Advertising: Ad networks and tracking
 * - Analytics: Site analytics and metrics
 * - Social: Social media widgets and tracking
 * - Content: Content delivery that may track
 * - Fingerprinting: Browser fingerprinting
 * - Cryptomining: Cryptocurrency mining scripts
 */

export type DisconnectCategory =
  | "Advertising"
  | "Analytics"
  | "Social"
  | "Content"
  | "Fingerprinting"
  | "Cryptomining"
  | "FingerprintingInvasive"
  | "FingerprintingGeneral";

export interface DisconnectTracker {
  name: string;
  category: DisconnectCategory;
  domains: string[];
  // Some trackers have sub-properties
  properties?: string[];
}

export interface DisconnectMatch {
  tracker: string;
  category: DisconnectCategory;
  matchedDomain: string;
}

/**
 * Disconnect tracker database
 * This is a curated subset of Disconnect's services.json
 * Focused on most common and impactful trackers
 */
const DISCONNECT_TRACKERS: Map<string, { tracker: string; category: DisconnectCategory }> = new Map([
  // ============= ADVERTISING =============
  // Google Advertising
  ["doubleclick.net", { tracker: "Google", category: "Advertising" }],
  ["googlesyndication.com", { tracker: "Google", category: "Advertising" }],
  ["googleadservices.com", { tracker: "Google", category: "Advertising" }],
  ["googleads.g.doubleclick.net", { tracker: "Google", category: "Advertising" }],
  ["pagead2.googlesyndication.com", { tracker: "Google", category: "Advertising" }],
  ["adservice.google.com", { tracker: "Google", category: "Advertising" }],
  ["www.googleadservices.com", { tracker: "Google", category: "Advertising" }],
  ["2mdn.net", { tracker: "Google", category: "Advertising" }],

  // Facebook/Meta Advertising
  ["facebook.net", { tracker: "Facebook", category: "Advertising" }],
  ["fbcdn.net", { tracker: "Facebook", category: "Advertising" }],
  ["connect.facebook.net", { tracker: "Facebook", category: "Advertising" }],
  ["pixel.facebook.com", { tracker: "Facebook", category: "Advertising" }],
  ["an.facebook.com", { tracker: "Facebook", category: "Advertising" }],

  // Amazon Advertising
  ["amazon-adsystem.com", { tracker: "Amazon", category: "Advertising" }],
  ["aax.amazon-adsystem.com", { tracker: "Amazon", category: "Advertising" }],
  ["fls-na.amazon-adsystem.com", { tracker: "Amazon", category: "Advertising" }],

  // Microsoft/Bing Advertising
  ["ads.microsoft.com", { tracker: "Microsoft", category: "Advertising" }],
  ["bat.bing.com", { tracker: "Microsoft", category: "Advertising" }],
  ["c.bing.com", { tracker: "Microsoft", category: "Advertising" }],
  ["c.msn.com", { tracker: "Microsoft", category: "Advertising" }],

  // Twitter/X Advertising
  ["ads-twitter.com", { tracker: "Twitter", category: "Advertising" }],
  ["ads-api.twitter.com", { tracker: "Twitter", category: "Advertising" }],
  ["analytics.twitter.com", { tracker: "Twitter", category: "Advertising" }],
  ["t.co", { tracker: "Twitter", category: "Advertising" }],

  // LinkedIn Advertising
  ["ads.linkedin.com", { tracker: "LinkedIn", category: "Advertising" }],
  ["snap.licdn.com", { tracker: "LinkedIn", category: "Advertising" }],
  ["px.ads.linkedin.com", { tracker: "LinkedIn", category: "Advertising" }],

  // TikTok
  ["analytics.tiktok.com", { tracker: "TikTok", category: "Advertising" }],
  ["ads.tiktok.com", { tracker: "TikTok", category: "Advertising" }],

  // AppNexus (Xandr)
  ["adnxs.com", { tracker: "AppNexus", category: "Advertising" }],
  ["adnxs.net", { tracker: "AppNexus", category: "Advertising" }],

  // The Trade Desk
  ["adsrvr.org", { tracker: "The Trade Desk", category: "Advertising" }],
  ["thetradedesk.com", { tracker: "The Trade Desk", category: "Advertising" }],

  // Criteo
  ["criteo.com", { tracker: "Criteo", category: "Advertising" }],
  ["criteo.net", { tracker: "Criteo", category: "Advertising" }],

  // Taboola
  ["taboola.com", { tracker: "Taboola", category: "Advertising" }],
  ["taboolasyndication.com", { tracker: "Taboola", category: "Advertising" }],

  // Outbrain
  ["outbrain.com", { tracker: "Outbrain", category: "Advertising" }],
  ["outbrainimg.com", { tracker: "Outbrain", category: "Advertising" }],

  // AdRoll
  ["adroll.com", { tracker: "AdRoll", category: "Advertising" }],
  ["d.adroll.com", { tracker: "AdRoll", category: "Advertising" }],

  // PubMatic
  ["pubmatic.com", { tracker: "PubMatic", category: "Advertising" }],
  ["ads.pubmatic.com", { tracker: "PubMatic", category: "Advertising" }],

  // Index Exchange
  ["indexww.com", { tracker: "Index Exchange", category: "Advertising" }],
  ["casalemedia.com", { tracker: "Index Exchange", category: "Advertising" }],

  // Rubicon Project (Magnite)
  ["rubiconproject.com", { tracker: "Rubicon", category: "Advertising" }],
  ["pixel.rubiconproject.com", { tracker: "Rubicon", category: "Advertising" }],

  // OpenX
  ["openx.net", { tracker: "OpenX", category: "Advertising" }],
  ["openx.com", { tracker: "OpenX", category: "Advertising" }],

  // MediaMath
  ["mathtag.com", { tracker: "MediaMath", category: "Advertising" }],
  ["mediamath.com", { tracker: "MediaMath", category: "Advertising" }],

  // Quantcast
  ["quantserve.com", { tracker: "Quantcast", category: "Advertising" }],
  ["quantcast.com", { tracker: "Quantcast", category: "Advertising" }],

  // ============= ANALYTICS =============
  // Google Analytics
  ["google-analytics.com", { tracker: "Google Analytics", category: "Analytics" }],
  ["www.google-analytics.com", { tracker: "Google Analytics", category: "Analytics" }],
  ["ssl.google-analytics.com", { tracker: "Google Analytics", category: "Analytics" }],
  ["analytics.google.com", { tracker: "Google Analytics", category: "Analytics" }],
  ["googletagmanager.com", { tracker: "Google Tag Manager", category: "Analytics" }],
  ["www.googletagmanager.com", { tracker: "Google Tag Manager", category: "Analytics" }],

  // Adobe Analytics
  ["omtrdc.net", { tracker: "Adobe Analytics", category: "Analytics" }],
  ["demdex.net", { tracker: "Adobe Audience Manager", category: "Analytics" }],
  ["2o7.net", { tracker: "Adobe Analytics", category: "Analytics" }],

  // Hotjar
  ["hotjar.com", { tracker: "Hotjar", category: "Analytics" }],
  ["static.hotjar.com", { tracker: "Hotjar", category: "Analytics" }],
  ["vars.hotjar.com", { tracker: "Hotjar", category: "Analytics" }],

  // Mixpanel
  ["mixpanel.com", { tracker: "Mixpanel", category: "Analytics" }],
  ["api.mixpanel.com", { tracker: "Mixpanel", category: "Analytics" }],

  // Segment
  ["segment.io", { tracker: "Segment", category: "Analytics" }],
  ["segment.com", { tracker: "Segment", category: "Analytics" }],
  ["api.segment.io", { tracker: "Segment", category: "Analytics" }],

  // Amplitude
  ["amplitude.com", { tracker: "Amplitude", category: "Analytics" }],
  ["api.amplitude.com", { tracker: "Amplitude", category: "Analytics" }],

  // Heap
  ["heap.io", { tracker: "Heap", category: "Analytics" }],
  ["heapanalytics.com", { tracker: "Heap", category: "Analytics" }],

  // FullStory
  ["fullstory.com", { tracker: "FullStory", category: "Analytics" }],
  ["rs.fullstory.com", { tracker: "FullStory", category: "Analytics" }],

  // LogRocket
  ["logrocket.io", { tracker: "LogRocket", category: "Analytics" }],
  ["logrocket.com", { tracker: "LogRocket", category: "Analytics" }],

  // Microsoft Clarity
  ["clarity.ms", { tracker: "Microsoft Clarity", category: "Analytics" }],

  // Mouseflow
  ["mouseflow.com", { tracker: "Mouseflow", category: "Analytics" }],

  // Lucky Orange
  ["luckyorange.com", { tracker: "Lucky Orange", category: "Analytics" }],

  // Heap
  ["cdn.heapanalytics.com", { tracker: "Heap", category: "Analytics" }],

  // New Relic
  ["newrelic.com", { tracker: "New Relic", category: "Analytics" }],
  ["js-agent.newrelic.com", { tracker: "New Relic", category: "Analytics" }],
  ["bam.nr-data.net", { tracker: "New Relic", category: "Analytics" }],

  // Datadog
  ["datadoghq.com", { tracker: "Datadog", category: "Analytics" }],
  ["browser-intake-datadoghq.com", { tracker: "Datadog", category: "Analytics" }],

  // Sentry (performance monitoring, less invasive)
  ["sentry.io", { tracker: "Sentry", category: "Analytics" }],

  // ============= SOCIAL =============
  // Facebook Social
  ["facebook.com", { tracker: "Facebook", category: "Social" }],
  ["staticxx.facebook.com", { tracker: "Facebook", category: "Social" }],
  ["graph.facebook.com", { tracker: "Facebook", category: "Social" }],

  // Instagram
  ["instagram.com", { tracker: "Instagram", category: "Social" }],
  ["cdninstagram.com", { tracker: "Instagram", category: "Social" }],

  // Twitter Social
  ["platform.twitter.com", { tracker: "Twitter", category: "Social" }],
  ["syndication.twitter.com", { tracker: "Twitter", category: "Social" }],

  // LinkedIn Social
  ["platform.linkedin.com", { tracker: "LinkedIn", category: "Social" }],

  // Pinterest
  ["pinterest.com", { tracker: "Pinterest", category: "Social" }],
  ["assets.pinterest.com", { tracker: "Pinterest", category: "Social" }],
  ["ct.pinterest.com", { tracker: "Pinterest", category: "Social" }],

  // Reddit
  ["redditstatic.com", { tracker: "Reddit", category: "Social" }],
  ["redditmedia.com", { tracker: "Reddit", category: "Social" }],

  // Disqus
  ["disqus.com", { tracker: "Disqus", category: "Social" }],
  ["disquscdn.com", { tracker: "Disqus", category: "Social" }],

  // AddThis
  ["addthis.com", { tracker: "AddThis", category: "Social" }],
  ["addthiscdn.com", { tracker: "AddThis", category: "Social" }],

  // ShareThis
  ["sharethis.com", { tracker: "ShareThis", category: "Social" }],

  // ============= FINGERPRINTING =============
  ["fingerprintjs.com", { tracker: "FingerprintJS", category: "Fingerprinting" }],
  ["fpjs.io", { tracker: "FingerprintJS", category: "Fingerprinting" }],
  ["openfpcdn.io", { tracker: "FingerprintJS", category: "Fingerprinting" }],
  ["threatmetrix.com", { tracker: "ThreatMetrix", category: "Fingerprinting" }],
  ["iovation.com", { tracker: "iovation", category: "Fingerprinting" }],
  ["deviceidentity.lexisnexis.com", { tracker: "LexisNexis", category: "FingerprintingInvasive" }],

  // ============= CRYPTOMINING =============
  ["coinhive.com", { tracker: "CoinHive", category: "Cryptomining" }],
  ["coin-hive.com", { tracker: "CoinHive", category: "Cryptomining" }],
  ["authedmine.com", { tracker: "AuthedMine", category: "Cryptomining" }],
  ["coinimp.com", { tracker: "CoinIMP", category: "Cryptomining" }],
  ["crypto-loot.com", { tracker: "CryptoLoot", category: "Cryptomining" }],
  ["jsecoin.com", { tracker: "JSEcoin", category: "Cryptomining" }],
  ["mineralt.io", { tracker: "MinerAlt", category: "Cryptomining" }],
  ["webmine.pro", { tracker: "WebMine", category: "Cryptomining" }],

  // ============= CONTENT (may track) =============
  ["cdn.jsdelivr.net", { tracker: "jsDelivr", category: "Content" }],
  ["cdnjs.cloudflare.com", { tracker: "Cloudflare CDN", category: "Content" }],
  ["ajax.googleapis.com", { tracker: "Google CDN", category: "Content" }],
  ["fonts.googleapis.com", { tracker: "Google Fonts", category: "Content" }],
  ["fonts.gstatic.com", { tracker: "Google Fonts", category: "Content" }],
  ["use.fontawesome.com", { tracker: "FontAwesome", category: "Content" }],
  ["kit.fontawesome.com", { tracker: "FontAwesome", category: "Content" }],
  ["use.typekit.net", { tracker: "Adobe Fonts", category: "Content" }],
]);

/**
 * Classify a domain using Disconnect tracker list
 */
export function classifyDisconnectDomain(domain: string): DisconnectMatch | null {
  if (!domain) return null;

  let normalized = domain.toLowerCase().replace(/\.$/, "");

  // Try exact match first
  const exact = DISCONNECT_TRACKERS.get(normalized);
  if (exact) {
    return {
      tracker: exact.tracker,
      category: exact.category,
      matchedDomain: normalized,
    };
  }

  // Strip subdomains progressively
  while (normalized.includes(".")) {
    const dotIndex = normalized.indexOf(".");
    normalized = normalized.slice(dotIndex + 1);

    const match = DISCONNECT_TRACKERS.get(normalized);
    if (match) {
      return {
        tracker: match.tracker,
        category: match.category,
        matchedDomain: normalized,
      };
    }
  }

  return null;
}

/**
 * Check if a domain is in Disconnect's blocking list
 */
export function isDisconnectBlocked(domain: string): boolean {
  return classifyDisconnectDomain(domain) !== null;
}

/**
 * Get all Disconnect matches for a list of domains
 */
export function classifyDisconnectDomains(domains: string[]): Map<string, DisconnectMatch> {
  const results = new Map<string, DisconnectMatch>();

  for (const domain of domains) {
    const match = classifyDisconnectDomain(domain);
    if (match) {
      results.set(domain, match);
    }
  }

  return results;
}

/**
 * Count trackers by Disconnect category
 */
export function countByDisconnectCategory(
  domains: string[]
): Record<DisconnectCategory, number> {
  const counts: Record<DisconnectCategory, number> = {
    Advertising: 0,
    Analytics: 0,
    Social: 0,
    Content: 0,
    Fingerprinting: 0,
    FingerprintingInvasive: 0,
    FingerprintingGeneral: 0,
    Cryptomining: 0,
  };

  for (const domain of domains) {
    const match = classifyDisconnectDomain(domain);
    if (match) {
      counts[match.category]++;
    }
  }

  return counts;
}

/**
 * Map Disconnect category to severity
 */
export function getDisconnectSeverity(
  category: DisconnectCategory
): "critical" | "high" | "medium" | "low" {
  switch (category) {
    case "Cryptomining":
    case "FingerprintingInvasive":
      return "critical";
    case "Advertising":
    case "Fingerprinting":
      return "high";
    case "Analytics":
    case "Social":
      return "medium";
    case "Content":
    case "FingerprintingGeneral":
      return "low";
  }
}

/**
 * Check if category is privacy-invasive (blocks in strict mode)
 */
export function isStrictBlocked(category: DisconnectCategory): boolean {
  return ["Advertising", "Analytics", "Social", "Fingerprinting", "FingerprintingInvasive", "Cryptomining"].includes(
    category
  );
}

/**
 * Get tracker statistics
 */
export function getDisconnectStats(): {
  totalTrackers: number;
  byCategory: Record<DisconnectCategory, number>;
} {
  const byCategory: Record<DisconnectCategory, number> = {
    Advertising: 0,
    Analytics: 0,
    Social: 0,
    Content: 0,
    Fingerprinting: 0,
    FingerprintingInvasive: 0,
    FingerprintingGeneral: 0,
    Cryptomining: 0,
  };

  for (const [_, info] of DISCONNECT_TRACKERS) {
    byCategory[info.category]++;
  }

  return {
    totalTrackers: DISCONNECT_TRACKERS.size,
    byCategory,
  };
}
