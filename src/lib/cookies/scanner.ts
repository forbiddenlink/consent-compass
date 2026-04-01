/**
 * Cookie Scanner - Detection and Analysis Utilities
 *
 * Provides utilities for:
 * - Detecting cookies from browser context
 * - Matching cookies against the Open Cookie Database
 * - Generating compliance reports
 * - Identifying unknown/uncategorized cookies
 */

import type { CookieCategory, CategorizedCookie, ConsentFinding, Severity } from "@/lib/types";
import {
  categorizeCookieFull,
  categorizeCookies,
  summarizeCookiesByCategory,
  getHighRiskCookies,
  hasPreConsentTracking,
  getCategorizationConfidence,
  type CategorizationResult,
} from "./categorize";
import { isKnownCookie, getDatabaseStats } from "./database";
import { getCookieTCFRequirements, getPurposeName } from "./iab-tcf";

/**
 * Raw cookie data from browser
 */
export interface RawCookie {
  name: string;
  value?: string;
  domain?: string;
  path?: string;
  expires?: number | string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | string;
}

/**
 * Extended cookie with categorization and compliance info
 */
export interface ScannedCookie extends CategorizedCookie {
  categorizationSource: CategorizationResult["source"];
  confidence: number;
  tcfPurposes: number[];
  requiresConsent: boolean;
  isThirdParty: boolean;
  lifespan?: "session" | "persistent";
  lifespanDays?: number;
}

/**
 * Cookie scan result with analysis
 */
export interface CookieScanResult {
  url: string;
  scannedAt: string;
  cookies: ScannedCookie[];
  summary: {
    total: number;
    byCategory: Record<CookieCategory, number>;
    bySource: Record<CategorizationResult["source"], number>;
    thirdPartyCount: number;
    unknownCount: number;
    requiresConsentCount: number;
  };
  confidence: {
    average: number;
    highConfidence: number;
    lowConfidence: number;
    unknown: number;
  };
  compliance: {
    hasPreConsentTracking: boolean;
    trackingCookieCount: number;
    severity: "none" | "warn" | "fail";
    issues: string[];
  };
}

/**
 * Compliance report structure
 */
export interface ComplianceReport {
  url: string;
  generatedAt: string;
  overallStatus: "compliant" | "issues" | "non-compliant";
  score: number;
  summary: {
    totalCookies: number;
    categorizedCookies: number;
    unknownCookies: number;
    consentRequired: number;
    thirdParty: number;
  };
  byCategory: Array<{
    category: CookieCategory;
    count: number;
    requiresConsent: boolean;
    cookies: Array<{
      name: string;
      vendor?: string;
      description?: string;
      tcfPurposes: number[];
    }>;
  }>;
  issues: Array<{
    severity: Severity;
    message: string;
    cookies?: string[];
  }>;
  recommendations: string[];
}

/**
 * Parse cookie expiry to determine lifespan
 */
function parseCookieLifespan(expires?: number | string): {
  lifespan: "session" | "persistent";
  lifespanDays?: number;
} {
  if (!expires) {
    return { lifespan: "session" };
  }

  let expiryDate: Date;

  if (typeof expires === "number") {
    // Unix timestamp (seconds)
    if (expires <= 0) {
      return { lifespan: "session" };
    }
    expiryDate = new Date(expires * 1000);
  } else {
    // ISO string or date string
    expiryDate = new Date(expires);
    if (Number.isNaN(expiryDate.getTime())) {
      return { lifespan: "session" };
    }
  }

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { lifespan: "session" };
  }

  return {
    lifespan: "persistent",
    lifespanDays: diffDays,
  };
}

/**
 * Determine if a cookie is third-party based on domain
 */
function isThirdPartyCookie(cookieDomain: string | undefined, pageUrl: string): boolean {
  if (!cookieDomain) return false;

  try {
    const pageHost = new URL(pageUrl).hostname.toLowerCase();
    const cookieHost = cookieDomain.toLowerCase().replace(/^\./, "");

    // Check if cookie domain matches or is a subdomain of page
    return !pageHost.endsWith(cookieHost) && !cookieHost.endsWith(pageHost);
  } catch {
    return false;
  }
}

/**
 * Scan and categorize cookies
 */
export function scanCookies(
  cookies: RawCookie[],
  pageUrl: string
): CookieScanResult {
  const scannedCookies: ScannedCookie[] = [];
  const bySource: Record<CategorizationResult["source"], number> = {
    "ocd-exact": 0,
    "ocd-prefix": 0,
    "local-pattern": 0,
    "domain-heuristic": 0,
    "unknown": 0,
  };

  for (const cookie of cookies) {
    const categorization = categorizeCookieFull(cookie.name, cookie.domain);
    const tcfRequirements = getCookieTCFRequirements(categorization.category);
    const lifespan = parseCookieLifespan(cookie.expires);
    const thirdParty = isThirdPartyCookie(cookie.domain, pageUrl);

    bySource[categorization.source]++;

    scannedCookies.push({
      name: cookie.name,
      value: cookie.value?.slice(0, 100), // Truncate for safety
      domain: cookie.domain,
      path: cookie.path,
      expires: typeof cookie.expires === "number" && cookie.expires > 0
        ? new Date(cookie.expires * 1000).toISOString()
        : typeof cookie.expires === "string"
          ? cookie.expires
          : undefined,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      category: categorization.category,
      vendor: categorization.vendor,
      description: categorization.description,
      categorizationSource: categorization.source,
      confidence: categorization.confidence,
      tcfPurposes: tcfRequirements.purposes,
      requiresConsent: tcfRequirements.requiresConsent,
      isThirdParty: thirdParty,
      lifespan: lifespan.lifespan,
      lifespanDays: lifespan.lifespanDays,
    });
  }

  // Generate summary
  const byCategory = summarizeCookiesByCategory(scannedCookies);
  const confidenceStats = getCategorizationConfidence(
    cookies.map((c) => ({ name: c.name, domain: c.domain }))
  );

  // Check for pre-consent tracking
  const trackingAnalysis = hasPreConsentTracking(scannedCookies);

  // Generate compliance issues
  const issues: string[] = [];

  if (trackingAnalysis.hasTracking) {
    const marketingCookies = trackingAnalysis.trackingCookies.filter(
      (c) => c.category === "marketing"
    );
    const analyticsCookies = trackingAnalysis.trackingCookies.filter(
      (c) => c.category === "analytics"
    );

    if (marketingCookies.length > 0) {
      issues.push(
        `${marketingCookies.length} marketing cookie(s) detected: ${marketingCookies.map((c) => c.name).join(", ")}`
      );
    }
    if (analyticsCookies.length > 0) {
      issues.push(
        `${analyticsCookies.length} analytics cookie(s) detected: ${analyticsCookies.map((c) => c.name).join(", ")}`
      );
    }
  }

  const thirdPartyCount = scannedCookies.filter((c) => c.isThirdParty).length;
  if (thirdPartyCount > 0) {
    issues.push(`${thirdPartyCount} third-party cookie(s) detected`);
  }

  const unknownCount = scannedCookies.filter((c) => c.category === "unknown").length;
  if (unknownCount > 0) {
    issues.push(
      `${unknownCount} cookie(s) could not be categorized: ${scannedCookies
        .filter((c) => c.category === "unknown")
        .map((c) => c.name)
        .slice(0, 5)
        .join(", ")}${unknownCount > 5 ? "..." : ""}`
    );
  }

  return {
    url: pageUrl,
    scannedAt: new Date().toISOString(),
    cookies: scannedCookies,
    summary: {
      total: scannedCookies.length,
      byCategory,
      bySource,
      thirdPartyCount,
      unknownCount,
      requiresConsentCount: scannedCookies.filter((c) => c.requiresConsent).length,
    },
    confidence: {
      average: confidenceStats.averageConfidence,
      highConfidence: confidenceStats.highConfidenceCount,
      lowConfidence: confidenceStats.lowConfidenceCount,
      unknown: confidenceStats.unknownCount,
    },
    compliance: {
      hasPreConsentTracking: trackingAnalysis.hasTracking,
      trackingCookieCount: trackingAnalysis.trackingCookies.length,
      severity: trackingAnalysis.severity,
      issues,
    },
  };
}

/**
 * Generate a compliance report from scan results
 */
export function generateComplianceReport(
  scanResult: CookieScanResult
): ComplianceReport {
  const issues: ComplianceReport["issues"] = [];
  const recommendations: string[] = [];

  // Analyze compliance issues
  if (scanResult.compliance.hasPreConsentTracking) {
    if (scanResult.compliance.severity === "fail") {
      issues.push({
        severity: "fail",
        message: "Marketing/advertising cookies detected before user consent",
        cookies: scanResult.cookies
          .filter((c) => c.category === "marketing")
          .map((c) => c.name),
      });
      recommendations.push(
        "Implement a consent management platform (CMP) to block marketing cookies until consent is given"
      );
    } else if (scanResult.compliance.severity === "warn") {
      issues.push({
        severity: "warn",
        message: "Analytics cookies detected before user consent",
        cookies: scanResult.cookies
          .filter((c) => c.category === "analytics")
          .map((c) => c.name),
      });
      recommendations.push(
        "Consider blocking analytics cookies until user provides consent, or use privacy-friendly alternatives like Plausible or Fathom"
      );
    }
  }

  // Check for unknown cookies
  if (scanResult.summary.unknownCount > 0) {
    issues.push({
      severity: "warn",
      message: `${scanResult.summary.unknownCount} cookie(s) could not be automatically categorized`,
      cookies: scanResult.cookies
        .filter((c) => c.category === "unknown")
        .map((c) => c.name),
    });
    recommendations.push(
      "Review and document unknown cookies to ensure proper consent handling"
    );
  }

  // Check for third-party cookies
  if (scanResult.summary.thirdPartyCount > 0) {
    issues.push({
      severity: "info",
      message: `${scanResult.summary.thirdPartyCount} third-party cookie(s) detected`,
      cookies: scanResult.cookies
        .filter((c) => c.isThirdParty)
        .map((c) => c.name),
    });
    recommendations.push(
      "Ensure all third-party cookies are disclosed in your privacy policy and consent banner"
    );
  }

  // Check for long-lived cookies
  const longLivedCookies = scanResult.cookies.filter(
    (c) => c.lifespanDays && c.lifespanDays > 365
  );
  if (longLivedCookies.length > 0) {
    issues.push({
      severity: "warn",
      message: `${longLivedCookies.length} cookie(s) have lifespans longer than 1 year`,
      cookies: longLivedCookies.map((c) => c.name),
    });
    recommendations.push(
      "Review cookie lifespans - regulators recommend shorter retention periods"
    );
  }

  // Calculate overall status and score
  const failCount = issues.filter((i) => i.severity === "fail").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;

  let overallStatus: ComplianceReport["overallStatus"];
  let score: number;

  if (failCount > 0) {
    overallStatus = "non-compliant";
    score = Math.max(0, 100 - failCount * 30 - warnCount * 10);
  } else if (warnCount > 0) {
    overallStatus = "issues";
    score = Math.max(50, 100 - warnCount * 15);
  } else {
    overallStatus = "compliant";
    score = 100;
  }

  // Group cookies by category for report
  const categories: CookieCategory[] = ["necessary", "functional", "analytics", "marketing", "unknown"];
  const byCategory = categories.map((category) => ({
    category,
    count: scanResult.summary.byCategory[category],
    requiresConsent: category !== "necessary",
    cookies: scanResult.cookies
      .filter((c) => c.category === category)
      .map((c) => ({
        name: c.name,
        vendor: c.vendor,
        description: c.description,
        tcfPurposes: c.tcfPurposes,
      })),
  }));

  return {
    url: scanResult.url,
    generatedAt: new Date().toISOString(),
    overallStatus,
    score,
    summary: {
      totalCookies: scanResult.summary.total,
      categorizedCookies: scanResult.summary.total - scanResult.summary.unknownCount,
      unknownCookies: scanResult.summary.unknownCount,
      consentRequired: scanResult.summary.requiresConsentCount,
      thirdParty: scanResult.summary.thirdPartyCount,
    },
    byCategory,
    issues,
    recommendations,
  };
}

/**
 * Generate consent findings from scanned cookies
 */
export function generateCookieFindings(
  scanResult: CookieScanResult
): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  // Pre-consent tracking finding
  if (scanResult.compliance.hasPreConsentTracking) {
    const trackingCookies = scanResult.cookies.filter(
      (c) => c.category === "analytics" || c.category === "marketing"
    );

    findings.push({
      id: "cookies.preconsent.tracking",
      title: `${trackingCookies.length} tracking cookie(s) detected before consent`,
      severity: scanResult.compliance.severity === "fail" ? "fail" : "warn",
      category: "pre-consent",
      detail:
        scanResult.compliance.severity === "fail"
          ? "Marketing/advertising cookies were set before user consent. This is a potential GDPR violation."
          : "Analytics cookies were set before consent. While less severe, this may still require user consent.",
      evidence: {
        kind: "cookie",
        value: trackingCookies
          .slice(0, 6)
          .map((c) => `${c.name}${c.vendor ? ` (${c.vendor})` : ""}`)
          .join(", "),
      },
    });
  }

  // Unknown cookies finding
  if (scanResult.summary.unknownCount > 0) {
    const unknownCookies = scanResult.cookies.filter((c) => c.category === "unknown");

    findings.push({
      id: "cookies.categorization.unknown",
      title: `${unknownCookies.length} unclassified cookie(s) detected`,
      severity: "warn",
      category: "transparency",
      detail:
        "Cookies were detected that couldn't be automatically classified. Manual review recommended to determine if they require consent.",
      evidence: {
        kind: "cookie",
        value: unknownCookies
          .slice(0, 6)
          .map((c) => c.name)
          .join(", "),
      },
    });
  }

  // Third-party cookies finding
  if (scanResult.summary.thirdPartyCount > 0) {
    const thirdPartyCookies = scanResult.cookies.filter((c) => c.isThirdParty);

    findings.push({
      id: "cookies.thirdparty",
      title: `${thirdPartyCookies.length} third-party cookie(s) detected`,
      severity: "info",
      category: "transparency",
      detail:
        "Third-party cookies were detected. These should be disclosed in your privacy policy and consent banner.",
      evidence: {
        kind: "cookie",
        value: thirdPartyCookies
          .slice(0, 6)
          .map((c) => `${c.name} (${c.domain})`)
          .join(", "),
      },
    });
  }

  // Essential cookies info
  const essentialCount =
    scanResult.summary.byCategory.necessary + scanResult.summary.byCategory.functional;
  if (essentialCount > 0) {
    findings.push({
      id: "cookies.essential.detected",
      title: "Essential cookies detected (acceptable)",
      severity: "info",
      category: "pre-consent",
      detail: `Found ${scanResult.summary.byCategory.necessary} necessary and ${scanResult.summary.byCategory.functional} functional cookies. These typically don't require consent.`,
    });
  }

  return findings;
}

/**
 * Identify unknown cookies that need manual review
 */
export function identifyUnknownCookies(
  cookies: RawCookie[]
): Array<{
  name: string;
  domain?: string;
  suggestions: string[];
}> {
  const results: Array<{
    name: string;
    domain?: string;
    suggestions: string[];
  }> = [];

  for (const cookie of cookies) {
    if (!isKnownCookie(cookie.name)) {
      const suggestions: string[] = [];

      // Generate suggestions based on name patterns
      const lowerName = cookie.name.toLowerCase();

      if (lowerName.includes("sess") || lowerName.includes("token") || lowerName.includes("auth")) {
        suggestions.push("May be a session/authentication cookie (necessary)");
      }
      if (lowerName.includes("lang") || lowerName.includes("locale") || lowerName.includes("pref")) {
        suggestions.push("May be a preference cookie (functional)");
      }
      if (lowerName.includes("track") || lowerName.includes("visit") || lowerName.includes("stat")) {
        suggestions.push("May be an analytics cookie (analytics)");
      }
      if (lowerName.includes("ad") || lowerName.includes("pixel") || lowerName.includes("campaign")) {
        suggestions.push("May be an advertising cookie (marketing)");
      }

      if (suggestions.length === 0) {
        suggestions.push("Unable to determine category - manual review required");
      }

      results.push({
        name: cookie.name,
        domain: cookie.domain,
        suggestions,
      });
    }
  }

  return results;
}

// Re-export commonly used functions
export {
  categorizeCookies,
  summarizeCookiesByCategory,
  getHighRiskCookies,
  hasPreConsentTracking,
  getDatabaseStats,
};
