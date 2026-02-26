/**
 * Pure heuristic functions for consent banner detection.
 * These are extracted from scan.ts for testability without Playwright.
 */

import type { ConsentFinding, CategorizedCookie } from "@/lib/types";
import { hasPreConsentTracking, summarizeCookiesByCategory } from "@/lib/cookies";

// ============================================================================
// Constants - Banner/Button Detection Hints
// ============================================================================

export const BANNER_HINTS = [
  "cookie",
  "consent",
  "gdpr",
  "privacy",
  "preferences",
  "your choices",
];

export const ACCEPT_HINTS = ["accept", "allow all", "agree", "ok", "got it"];
export const REJECT_HINTS = [
  "reject",
  "decline",
  "deny",
  "disallow",
  "no thanks",
  "only necessary",
  "necessary only",
];
export const MANAGE_HINTS = [
  "preferences",
  "manage",
  "settings",
  "customize",
  "choices",
  "more options",
];

export const BANNER_SELECTORS = [
  "#onetrust-banner-sdk",
  "#cookie-banner",
  "[id*='cookie']",
  "[class*='cookie']",
  "[id*='consent']",
  "[class*='consent']",
  "[aria-label*='cookie']",
  "[aria-label*='consent']",
];

// ============================================================================
// Pure Utility Functions
// ============================================================================

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ============================================================================
// Scoring Functions
// ============================================================================

export function scoreFromFindings(findings: ConsentFinding[]): {
  choiceSymmetry: number;
  preConsentSignals: number;
  accessibility: number;
  transparency: number;
  overall: number;
} {
  const base = {
    choiceSymmetry: 80,
    preConsentSignals: 80,
    accessibility: 80,
    transparency: 80,
  };

  for (const f of findings) {
    if (f.severity === "fail") {
      if (f.id.includes("symmetry")) base.choiceSymmetry -= 35;
      else if (f.id.includes("preconsent")) base.preConsentSignals -= 35;
      else if (f.id.includes("a11y")) base.accessibility -= 35;
      else base.transparency -= 25;
    }
    if (f.severity === "warn") {
      if (f.id.includes("symmetry")) base.choiceSymmetry -= 15;
      else if (f.id.includes("preconsent")) base.preConsentSignals -= 15;
      else if (f.id.includes("a11y")) base.accessibility -= 15;
      else base.transparency -= 10;
    }
  }

  const score = {
    choiceSymmetry: clamp(base.choiceSymmetry, 0, 100),
    preConsentSignals: clamp(base.preConsentSignals, 0, 100),
    accessibility: clamp(base.accessibility, 0, 100),
    transparency: clamp(base.transparency, 0, 100),
    overall: 0,
  };
  score.overall = Math.round(
    (score.choiceSymmetry + score.preConsentSignals + score.accessibility + score.transparency) / 4
  );
  return score;
}

// ============================================================================
// Banner Detection
// ============================================================================

export type BannerDetectionResult = {
  detected: boolean;
  confidence: number;
  detectedByText: boolean;
  matchedSelectors: string[];
  acceptButtons: string[];
  rejectButtons: string[];
  managePrefsButtons: string[];
};

/**
 * Detect if HTML content contains consent banner text hints.
 */
export function detectBannerByText(html: string): boolean {
  const lower = html.toLowerCase();
  return BANNER_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Check if text matches a hint with word boundary awareness.
 * Short hints (<=3 chars) require exact match or word boundaries.
 */
function matchesHint(text: string, hint: string): boolean {
  if (text === hint) return true;
  if (hint.length <= 3) {
    // Short hints like "ok" need word boundary matching to avoid "cookie" false positives
    const wordBoundaryRegex = new RegExp(`\\b${hint}\\b`, "i");
    return wordBoundaryRegex.test(text);
  }
  return text.includes(hint);
}

/**
 * Classify button text into accept/reject/manage categories.
 * Order matters: reject is checked before accept to handle "only necessary" correctly.
 */
export function classifyButtonText(text: string): "accept" | "reject" | "manage" | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  // Check reject first - "only necessary" should not match "accept" hints
  if (REJECT_HINTS.some((h) => matchesHint(lower, h))) return "reject";
  // Check manage before accept - "cookie preferences" should not match "ok" in cookie
  if (MANAGE_HINTS.some((h) => matchesHint(lower, h))) return "manage";
  if (ACCEPT_HINTS.some((h) => matchesHint(lower, h))) return "accept";

  return null;
}

/**
 * Calculate banner detection confidence based on signals.
 */
export function calculateBannerConfidence(params: {
  detectedByText: boolean;
  matchedSelectors: string[];
  acceptButtons: string[];
  rejectButtons: string[];
}): number {
  return clamp(
    (params.detectedByText ? 0.3 : 0) +
      (params.matchedSelectors.length > 0 ? 0.45 : 0) +
      (params.acceptButtons.length > 0 ? 0.15 : 0) +
      (params.rejectButtons.length > 0 ? 0.1 : 0),
    0,
    1
  );
}

// ============================================================================
// Friction Analysis
// ============================================================================

export type FrictionEstimate = {
  acceptClicks: number | undefined;
  rejectClicks: number | undefined;
  notes: string[];
};

/**
 * Estimate click friction based on button presence.
 */
export function estimateFriction(params: {
  acceptButtons: string[];
  rejectButtons: string[];
  managePrefsButtons: string[];
}): FrictionEstimate {
  const notes: string[] = [];
  let acceptClicks: number | undefined;
  let rejectClicks: number | undefined;

  if (params.acceptButtons.length > 0) acceptClicks = 1;
  if (params.rejectButtons.length > 0) {
    rejectClicks = 1;
  } else if (params.managePrefsButtons.length > 0 && params.acceptButtons.length > 0) {
    rejectClicks = 2;
    notes.push(
      "No obvious 'Reject all' found; 'Preferences/Settings' present (likely 2+ step rejection)."
    );
  }

  return { acceptClicks, rejectClicks, notes };
}

// ============================================================================
// Findings Generation
// ============================================================================

/**
 * Generate findings based on banner detection results.
 */
export function generateBannerFindings(params: {
  bannerDetected: boolean;
  acceptButtons: string[];
  rejectButtons: string[];
  managePrefsButtons: string[];
}): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  if (!params.bannerDetected) {
    findings.push({
      id: "banner.missing",
      title: "No obvious consent banner detected",
      severity: "warn",
      detail:
        "Consent Compass didn't find common CMP/banner patterns. This can be okay (no non-essential cookies), or it can mean the banner is hidden behind an interaction we didn't trigger in v0.",
    });
  }

  if (params.acceptButtons.length > 0 && params.rejectButtons.length === 0) {
    findings.push({
      id: "choice.symmetry.reject_missing",
      title: "Reject / 'Only necessary' option not found on first layer",
      severity: params.managePrefsButtons.length > 0 ? "warn" : "fail",
      detail:
        params.managePrefsButtons.length > 0
          ? "We found an 'accept' action but no equally-visible 'reject' action on the first layer. A preferences/settings path exists, which often adds friction to rejecting."
          : "We found an obvious 'accept' action but no equally-visible 'reject' / 'only necessary' action. This is commonly considered non-symmetric choice design.",
      evidence: { kind: "text", value: `accept: ${params.acceptButtons.slice(0, 3).join(", ")}` },
    });
  }

  if (params.bannerDetected) {
    findings.push({
      id: "transparency.banner_detected",
      title: "Consent UI appears present",
      severity: "info",
      detail:
        "A consent interface was detected via text/selector heuristics. v0 also captures pre-consent cookies/requests and a rough click-friction estimate.",
    });
  }

  return findings;
}

/**
 * Generate findings based on pre-consent cookie analysis.
 */
export function generateCookieFindings(cookies: CategorizedCookie[]): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  if (cookies.length === 0) return findings;

  const trackingAnalysis = hasPreConsentTracking(cookies);
  const cookiesByCategory = summarizeCookiesByCategory(cookies);

  if (trackingAnalysis.hasTracking) {
    const trackingNames = trackingAnalysis.trackingCookies.slice(0, 6).map((c) => {
      const vendorInfo = c.vendor ? ` (${c.vendor})` : "";
      return `${c.name}${vendorInfo}`;
    });

    findings.push({
      id: "preconsent.tracking.detected",
      title: `${trackingAnalysis.trackingCookies.length} tracking cookie(s) detected before consent`,
      severity: trackingAnalysis.severity === "fail" ? "fail" : "warn",
      category: "pre-consent",
      detail:
        trackingAnalysis.severity === "fail"
          ? "Marketing/advertising cookies were set before any user consent interaction. This is a potential GDPR violation."
          : "Analytics cookies were set before consent. While less severe than marketing cookies, this may still require user consent.",
      evidence: { kind: "cookie", value: trackingNames.join(", ") },
    });
  } else if (cookiesByCategory.unknown > 0) {
    findings.push({
      id: "preconsent.cookies.unknown",
      title: `${cookiesByCategory.unknown} unclassified cookie(s) detected before consent`,
      severity: "warn",
      category: "pre-consent",
      detail:
        "Cookies were set before consent that couldn't be automatically classified. Manual review recommended to determine if they require consent.",
      evidence: {
        kind: "cookie",
        value: cookies
          .filter((c) => c.category === "unknown")
          .slice(0, 6)
          .map((c) => c.name)
          .join(", "),
      },
    });
  }

  if (cookiesByCategory.necessary > 0 || cookiesByCategory.functional > 0) {
    findings.push({
      id: "preconsent.cookies.essential",
      title: "Essential cookies detected (acceptable)",
      severity: "info",
      category: "pre-consent",
      detail: `Found ${cookiesByCategory.necessary} necessary and ${cookiesByCategory.functional} functional cookies. These typically don't require consent.`,
    });
  }

  return findings;
}

/**
 * Generate findings based on Google Consent Mode detection.
 */
export function generateGCMFindings(gcm: {
  detected: boolean;
  version?: "v1" | "v2";
  issues: string[];
}): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  if (!gcm.detected) return findings;

  if (gcm.version === "v2" && gcm.issues.length === 0) {
    findings.push({
      id: "gcm.v2.complete",
      title: "Google Consent Mode v2 detected and complete",
      severity: "info",
      category: "gcm",
      detail: "All required GCM v2 signals are present. This is good for Google Ads and Analytics compliance.",
    });
  } else if (gcm.version === "v2" && gcm.issues.length > 0) {
    findings.push({
      id: "gcm.v2.incomplete",
      title: "Google Consent Mode v2 detected but incomplete",
      severity: "warn",
      category: "gcm",
      detail: `GCM v2 is implemented but missing signals: ${gcm.issues.join(", ")}`,
      evidence: { kind: "text", value: gcm.issues.join("; ") },
    });
  } else if (gcm.version === "v1") {
    findings.push({
      id: "gcm.v1.detected",
      title: "Google Consent Mode v1 detected (upgrade recommended)",
      severity: "warn",
      category: "gcm",
      detail:
        "GCM v1 is implemented but v2 is now required for full Google Ads functionality. Consider upgrading to include ad_user_data and ad_personalization signals.",
    });
  }

  return findings;
}

// ============================================================================
// Post-Consent Cookie Comparison
// ============================================================================

export type CookieComparisonResult = {
  /** Cookies that appeared after consent (expected behavior) */
  newCookies: CategorizedCookie[];
  /** Cookies present before AND after consent */
  persistedCookies: CategorizedCookie[];
  /** Tracking cookies that existed before consent - VIOLATION */
  preConsentViolations: CategorizedCookie[];
};

/**
 * Create a unique key for a cookie (name + domain).
 */
function cookieKey(cookie: { name: string; domain?: string }): string {
  return `${cookie.name}@${cookie.domain || ""}`;
}

/**
 * Compare pre-consent and post-consent cookies to identify violations.
 */
export function compareCookies(
  preCookies: CategorizedCookie[],
  postCookies: CategorizedCookie[]
): CookieComparisonResult {
  const preSet = new Set(preCookies.map(cookieKey));

  const newCookies: CategorizedCookie[] = [];
  const persistedCookies: CategorizedCookie[] = [];

  for (const cookie of postCookies) {
    const key = cookieKey(cookie);
    if (preSet.has(key)) {
      persistedCookies.push(cookie);
    } else {
      newCookies.push(cookie);
    }
  }

  // Violations: tracking cookies (analytics/marketing) that existed BEFORE consent
  const preConsentViolations = preCookies.filter(
    (c) => c.category === "analytics" || c.category === "marketing"
  );

  return { newCookies, persistedCookies, preConsentViolations };
}

/**
 * Generate findings from post-consent comparison.
 */
export function generatePostConsentFindings(comparison: CookieComparisonResult): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  // Critical: tracking cookies existed before consent
  if (comparison.preConsentViolations.length > 0) {
    const marketingViolations = comparison.preConsentViolations.filter(
      (c) => c.category === "marketing"
    );
    const analyticsViolations = comparison.preConsentViolations.filter(
      (c) => c.category === "analytics"
    );

    if (marketingViolations.length > 0) {
      const names = marketingViolations.slice(0, 5).map((c) => {
        const vendor = c.vendor ? ` (${c.vendor})` : "";
        return `${c.name}${vendor}`;
      });
      findings.push({
        id: "postconsent.violation.marketing",
        title: `${marketingViolations.length} marketing cookie(s) set before consent`,
        severity: "fail",
        category: "pre-consent",
        detail:
          "Marketing/advertising cookies were present before the user gave consent. " +
          "This is a GDPR violation - these cookies should only be set AFTER the user clicks accept.",
        evidence: { kind: "cookie", value: names.join(", ") },
      });
    }

    if (analyticsViolations.length > 0) {
      const names = analyticsViolations.slice(0, 5).map((c) => {
        const vendor = c.vendor ? ` (${c.vendor})` : "";
        return `${c.name}${vendor}`;
      });
      findings.push({
        id: "postconsent.violation.analytics",
        title: `${analyticsViolations.length} analytics cookie(s) set before consent`,
        severity: "warn",
        category: "pre-consent",
        detail:
          "Analytics cookies were present before the user gave consent. " +
          "Under strict GDPR interpretation, analytics cookies require consent before being set.",
        evidence: { kind: "cookie", value: names.join(", ") },
      });
    }
  }

  // Info: new cookies appeared after consent (expected)
  if (comparison.newCookies.length > 0) {
    const trackingNew = comparison.newCookies.filter(
      (c) => c.category === "analytics" || c.category === "marketing"
    );
    if (trackingNew.length > 0) {
      findings.push({
        id: "postconsent.new_tracking",
        title: `${trackingNew.length} tracking cookie(s) set after consent (correct behavior)`,
        severity: "info",
        category: "pre-consent",
        detail:
          "Tracking cookies were set only after the user consented. This is the expected GDPR-compliant behavior.",
      });
    }
  }

  return findings;
}
