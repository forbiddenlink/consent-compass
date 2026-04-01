/**
 * Cookie Compliance Tooling
 *
 * Comprehensive cookie management and compliance utilities including:
 * - Open Cookie Database integration
 * - Auto-categorization with multiple strategies
 * - IAB TCF v2.2 compliance
 * - Cookie scanning and detection
 * - Compliance report generation
 */

// Database utilities
export {
  lookupCookieExact,
  lookupCookieByPrefix,
  getCookiesByVendor,
  getCookiesByCategory,
  searchCookies,
  getDatabaseStats,
  isKnownCookie,
  COOKIE_EXACT_MATCHES,
  COOKIE_PREFIX_PATTERNS,
  type CookieEntry,
  type CookiePrefixPattern,
} from "./database";

// Categorization utilities
export {
  categorizeCookie,
  categorizeCookieFull,
  categorizeCookies,
  summarizeCookiesByCategory,
  getHighRiskCookies,
  hasPreConsentTracking,
  getCategorizationConfidence,
  type CategorizationResult,
} from "./categorize";

// IAB TCF utilities
export {
  TCF_PURPOSES,
  TCF_SPECIAL_FEATURES,
  TCF_SPECIAL_PURPOSES,
  getPurposesForCategory,
  getPrimaryPurposeForCategory,
  isCategoryAllowed,
  generateConsentStateFromCategories,
  validateTCFConsent,
  generateSimpleTCString,
  getCookieTCFRequirements,
  getPurposeName,
  getSpecialFeatureName,
  checkVendorConsent,
  type TCFConsentState,
  type TCFComplianceResult,
  type TCFIssue,
} from "./iab-tcf";

// Scanner utilities
export {
  scanCookies,
  generateComplianceReport,
  generateCookieFindings,
  identifyUnknownCookies,
  type RawCookie,
  type ScannedCookie,
  type CookieScanResult,
  type ComplianceReport,
} from "./scanner";
