/**
 * Multi-Regulation Compliance Scoring (Phase 5.1)
 *
 * Analyzes scan results against three major privacy regulations:
 * 1. GDPR (EU General Data Protection Regulation)
 * 2. CCPA/CPRA (California Consumer Privacy Act / California Privacy Rights Act)
 * 3. ePrivacy Directive (EU Cookie Law)
 *
 * Each regulation has specific requirements that are checked against
 * the data collected during a consent scan.
 */

import type { ScanResult, ConsentFinding, Severity } from "@/lib/types";

// ============================================================================
// Types
// ============================================================================

export type Regulation = "gdpr" | "ccpa" | "eprivacy";

export type ComplianceCheck = {
  id: string;
  name: string;
  passed: boolean;
  required: boolean; // true = must pass, false = recommended
  weight: number; // Weight for scoring (higher = more important)
  details?: string;
};

export type RegulationScore = {
  regulation: Regulation;
  score: number; // 0-100
  status: "pass" | "warn" | "fail";
  checks: ComplianceCheck[];
};

export type ComplianceResult = {
  gdpr: RegulationScore;
  ccpa: RegulationScore;
  eprivacy: RegulationScore;
  overallStatus: "pass" | "warn" | "fail";
};

// ============================================================================
// GDPR Compliance Checks
// ============================================================================

/**
 * GDPR compliance requires:
 * - Prior consent (no tracking before consent)
 * - Clear accept/reject options
 * - Equal prominence (no dark patterns)
 * - Granular choices (manage preferences)
 * - Easy withdrawal (reject as easy as accept)
 * - No pre-ticked boxes
 * - Transparency (cookie information provided)
 */
function checkGdprCompliance(scanResult: ScanResult): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // 1. Prior consent - no tracking cookies before consent
  const hasPreConsentTracking = scanResult.preConsent.cookies.some(
    (c) => c.category === "analytics" || c.category === "marketing"
  );
  const preConsentTrackerCount = scanResult.preConsent.trackerCount ?? 0;

  checks.push({
    id: "gdpr.prior_consent",
    name: "Prior consent required",
    passed: !hasPreConsentTracking && preConsentTrackerCount === 0,
    required: true,
    weight: 25,
    details: hasPreConsentTracking || preConsentTrackerCount > 0
      ? `Found ${scanResult.preConsent.cookies.filter(c => c.category === "analytics" || c.category === "marketing").length} tracking cookies and ${preConsentTrackerCount} tracker requests before consent`
      : "No tracking detected before consent",
  });

  // 2. Clear accept/reject options
  const hasAcceptButton = scanResult.banner.acceptButtons.length > 0;
  const hasRejectButton = scanResult.banner.rejectButtons.length > 0;
  const hasManageButton = scanResult.banner.managePrefsButtons.length > 0;

  checks.push({
    id: "gdpr.reject_option",
    name: "Clear reject option available",
    passed: hasRejectButton,
    required: true,
    weight: 20,
    details: hasRejectButton
      ? "Reject button found on first layer"
      : hasManageButton
        ? "No direct reject - only 'manage preferences' available (adds friction)"
        : "No reject option found",
  });

  // 3. Equal prominence (no dark patterns)
  const visualAsymmetry = scanResult.darkPatterns?.visualAsymmetry ?? 0;
  const frictionScore = "overallScore" in scanResult.friction
    ? scanResult.friction.overallScore ?? 0
    : 0;

  checks.push({
    id: "gdpr.equal_prominence",
    name: "Equal prominence for choices",
    passed: visualAsymmetry < 40 && frictionScore < 50,
    required: true,
    weight: 15,
    details: visualAsymmetry >= 40 || frictionScore >= 50
      ? `Visual asymmetry: ${visualAsymmetry}/100, Friction: ${frictionScore}/100`
      : "Accept and reject options have comparable prominence",
  });

  // 4. Granular choices (manage preferences available)
  checks.push({
    id: "gdpr.granular_choices",
    name: "Granular preference management",
    passed: hasManageButton || hasRejectButton,
    required: false, // Recommended but not strictly required if reject exists
    weight: 10,
    details: hasManageButton
      ? "Preference management option available"
      : hasRejectButton
        ? "Direct reject available (granular preferences not required)"
        : "No granular preference options found",
  });

  // 5. Easy withdrawal (reject as easy as accept)
  const acceptClicks = "acceptClicks" in scanResult.friction
    ? scanResult.friction.acceptClicks ?? 1
    : 1;
  const rejectClicks = "rejectClicks" in scanResult.friction
    ? scanResult.friction.rejectClicks ?? (hasRejectButton ? 1 : 2)
    : (hasRejectButton ? 1 : 2);

  checks.push({
    id: "gdpr.easy_withdrawal",
    name: "Easy consent withdrawal",
    passed: rejectClicks <= acceptClicks + 1,
    required: true,
    weight: 15,
    details: `Accept requires ${acceptClicks} click(s), reject requires ${rejectClicks} click(s)`,
  });

  // 6. No pre-ticked boxes (inferred from pre-consent tracking)
  // If marketing cookies are set before consent, it suggests pre-ticked boxes or auto-consent
  const hasMarketingBeforeConsent = scanResult.preConsent.cookies.some(
    (c) => c.category === "marketing"
  );

  checks.push({
    id: "gdpr.no_preticked",
    name: "No pre-ticked consent boxes",
    passed: !hasMarketingBeforeConsent,
    required: true,
    weight: 10,
    details: hasMarketingBeforeConsent
      ? "Marketing cookies present before consent suggests pre-ticked boxes or auto-consent"
      : "No evidence of pre-ticked consent boxes",
  });

  // 7. Transparency (cookie information provided)
  const bannerDetected = scanResult.banner.detected;

  checks.push({
    id: "gdpr.transparency",
    name: "Cookie information provided",
    passed: bannerDetected,
    required: true,
    weight: 5,
    details: bannerDetected
      ? "Consent banner detected with cookie information"
      : "No consent banner or cookie information detected",
  });

  return checks;
}

// ============================================================================
// CCPA/CPRA Compliance Checks
// ============================================================================

/**
 * CCPA/CPRA compliance requires:
 * - "Do Not Sell/Share" link present
 * - GPC signal honored
 * - Opt-out mechanism available
 * - No dark patterns in opt-out flow
 */
function checkCcpaCompliance(scanResult: ScanResult): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // 1. "Do Not Sell/Share" link present
  // Check banner buttons for CCPA-specific language
  const allButtonTexts = [
    ...scanResult.banner.acceptButtons,
    ...scanResult.banner.rejectButtons,
    ...scanResult.banner.managePrefsButtons,
  ].map((t) => t.toLowerCase());

  const dnsPatterns = [
    /do\s*not\s*sell/i,
    /don'?t\s*sell/i,
    /opt[\s-]?out/i,
    /your\s*privacy\s*choices/i,
    /your\s*california\s*privacy/i,
  ];

  const hasDnsLink = allButtonTexts.some((text) =>
    dnsPatterns.some((pattern) => pattern.test(text))
  );

  checks.push({
    id: "ccpa.dns_link",
    name: '"Do Not Sell/Share" link present',
    passed: hasDnsLink,
    required: true,
    weight: 30,
    details: hasDnsLink
      ? 'Found "Do Not Sell/Share" or equivalent opt-out link'
      : 'No "Do Not Sell/Share" link detected (may be on a separate privacy page)',
  });

  // 2. GPC signal honored
  const gpcDetected = scanResult.gpcSupport?.detected ?? false;
  const gpcHonored = scanResult.gpcSupport?.honored ?? false;

  checks.push({
    id: "ccpa.gpc_honored",
    name: "GPC signal honored",
    passed: gpcHonored,
    required: true, // CPRA requires honoring GPC as of 2023
    weight: 25,
    details: gpcHonored
      ? "Global Privacy Control signal is detected and honored"
      : gpcDetected
        ? "GPC support detected but honoring could not be verified"
        : "No GPC support detected",
  });

  // 3. Opt-out mechanism available
  const hasRejectButton = scanResult.banner.rejectButtons.length > 0;
  const hasManageButton = scanResult.banner.managePrefsButtons.length > 0;
  const hasOptOut = hasRejectButton || hasManageButton || hasDnsLink;

  checks.push({
    id: "ccpa.optout_available",
    name: "Opt-out mechanism available",
    passed: hasOptOut,
    required: true,
    weight: 25,
    details: hasOptOut
      ? "Opt-out mechanism is available"
      : "No opt-out mechanism detected",
  });

  // 4. No dark patterns in opt-out flow
  const frictionScore = "overallScore" in scanResult.friction
    ? scanResult.friction.overallScore ?? 0
    : 0;
  const darkPatternIssues = scanResult.darkPatterns?.issues ?? [];

  checks.push({
    id: "ccpa.no_dark_patterns",
    name: "No dark patterns in opt-out",
    passed: frictionScore < 50 && darkPatternIssues.length < 2,
    required: true,
    weight: 20,
    details: frictionScore >= 50 || darkPatternIssues.length >= 2
      ? `Friction score: ${frictionScore}/100, Dark pattern issues: ${darkPatternIssues.length}`
      : "Opt-out flow does not appear to use dark patterns",
  });

  return checks;
}

// ============================================================================
// ePrivacy Directive Compliance Checks
// ============================================================================

/**
 * ePrivacy Directive (Cookie Law) compliance requires:
 * - Consent before cookies (no pre-consent tracking)
 * - Clear information provided
 * - Active consent required (not implied)
 * - Functional cookies excepted appropriately
 */
function checkEprivacyCompliance(scanResult: ScanResult): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // 1. Consent before cookies (no pre-consent tracking cookies)
  const trackingCookiesBefore = scanResult.preConsent.cookies.filter(
    (c) => c.category === "analytics" || c.category === "marketing"
  );
  const preConsentTrackerCount = scanResult.preConsent.trackerCount ?? 0;

  checks.push({
    id: "eprivacy.consent_before_cookies",
    name: "Consent obtained before tracking cookies",
    passed: trackingCookiesBefore.length === 0 && preConsentTrackerCount === 0,
    required: true,
    weight: 30,
    details: trackingCookiesBefore.length > 0 || preConsentTrackerCount > 0
      ? `Found ${trackingCookiesBefore.length} tracking cookies and ${preConsentTrackerCount} tracker requests before consent`
      : "No tracking cookies or requests before consent",
  });

  // 2. Clear information provided
  const bannerDetected = scanResult.banner.detected;
  const bannerConfidence = scanResult.banner.confidence;

  checks.push({
    id: "eprivacy.clear_information",
    name: "Clear cookie information provided",
    passed: bannerDetected && bannerConfidence > 0.5,
    required: true,
    weight: 25,
    details: bannerDetected
      ? `Consent banner detected (confidence: ${Math.round(bannerConfidence * 100)}%)`
      : "No clear cookie information banner detected",
  });

  // 3. Active consent required (not implied)
  // Check for signs of implied consent (auto-accept on scroll, etc.)
  // We infer this from whether marketing cookies appear without explicit action
  const hasMarketingBeforeConsent = scanResult.preConsent.cookies.some(
    (c) => c.category === "marketing"
  );
  const hasAcceptButton = scanResult.banner.acceptButtons.length > 0;

  checks.push({
    id: "eprivacy.active_consent",
    name: "Active consent mechanism (not implied)",
    passed: hasAcceptButton && !hasMarketingBeforeConsent,
    required: true,
    weight: 25,
    details: !hasAcceptButton
      ? "No clear consent action button found"
      : hasMarketingBeforeConsent
        ? "Marketing cookies set without explicit consent action"
        : "Consent appears to require active user action",
  });

  // 4. Functional cookies excepted appropriately
  // Check that necessary/functional cookies don't require consent
  // (they should be present before consent if needed)
  const necessaryCookies = scanResult.preConsent.cookies.filter(
    (c) => c.category === "necessary" || c.category === "functional"
  );
  const onlyNecessaryBeforeConsent =
    necessaryCookies.length > 0 &&
    trackingCookiesBefore.length === 0;

  checks.push({
    id: "eprivacy.functional_exception",
    name: "Functional cookies properly excepted",
    passed: true, // Hard to fail this without knowing site requirements
    required: false,
    weight: 20,
    details: onlyNecessaryBeforeConsent
      ? `${necessaryCookies.length} necessary/functional cookies present (no consent required)`
      : necessaryCookies.length === 0
        ? "No pre-consent cookies detected"
        : "Pre-consent cookie usage appears compliant",
  });

  return checks;
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate compliance score from checks.
 * Score = (sum of passed check weights) / (sum of all check weights) * 100
 */
function calculateScore(checks: ComplianceCheck[]): number {
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = checks
    .filter((check) => check.passed)
    .reduce((sum, check) => sum + check.weight, 0);

  if (totalWeight === 0) return 100;
  return Math.round((passedWeight / totalWeight) * 100);
}

/**
 * Determine status based on score and required checks.
 * - fail: Any required check failed OR score < 50
 * - warn: score 50-79 OR any recommended check failed
 * - pass: score >= 80 AND all required checks passed
 */
function determineStatus(
  score: number,
  checks: ComplianceCheck[]
): "pass" | "warn" | "fail" {
  const requiredFailed = checks.some((check) => check.required && !check.passed);

  if (requiredFailed || score < 50) {
    return "fail";
  }
  if (score < 80) {
    return "warn";
  }
  return "pass";
}

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Analyze scan result against all three regulations.
 */
export function analyzeCompliance(scanResult: ScanResult): ComplianceResult {
  // Run checks for each regulation
  const gdprChecks = checkGdprCompliance(scanResult);
  const ccpaChecks = checkCcpaCompliance(scanResult);
  const eprivacyChecks = checkEprivacyCompliance(scanResult);

  // Calculate scores
  const gdprScore = calculateScore(gdprChecks);
  const ccpaScore = calculateScore(ccpaChecks);
  const eprivacyScore = calculateScore(eprivacyChecks);

  // Determine statuses
  const gdprStatus = determineStatus(gdprScore, gdprChecks);
  const ccpaStatus = determineStatus(ccpaScore, ccpaChecks);
  const eprivacyStatus = determineStatus(eprivacyScore, eprivacyChecks);

  // Determine overall status (worst of all three)
  let overallStatus: "pass" | "warn" | "fail" = "pass";
  if (gdprStatus === "fail" || ccpaStatus === "fail" || eprivacyStatus === "fail") {
    overallStatus = "fail";
  } else if (gdprStatus === "warn" || ccpaStatus === "warn" || eprivacyStatus === "warn") {
    overallStatus = "warn";
  }

  return {
    gdpr: {
      regulation: "gdpr",
      score: gdprScore,
      status: gdprStatus,
      checks: gdprChecks,
    },
    ccpa: {
      regulation: "ccpa",
      score: ccpaScore,
      status: ccpaStatus,
      checks: ccpaChecks,
    },
    eprivacy: {
      regulation: "eprivacy",
      score: eprivacyScore,
      status: eprivacyStatus,
      checks: eprivacyChecks,
    },
    overallStatus,
  };
}

// ============================================================================
// Finding Generation
// ============================================================================

/**
 * Generate compliance findings from analysis result.
 */
export function generateComplianceFindings(result: ComplianceResult): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  // Generate findings for each regulation
  const regulations: { key: keyof Omit<ComplianceResult, "overallStatus">; name: string }[] = [
    { key: "gdpr", name: "GDPR" },
    { key: "ccpa", name: "CCPA/CPRA" },
    { key: "eprivacy", name: "ePrivacy" },
  ];

  for (const { key, name } of regulations) {
    const regResult = result[key];

    // Add overall regulation finding
    const overallSeverity: Severity =
      regResult.status === "fail" ? "fail" : regResult.status === "warn" ? "warn" : "info";

    findings.push({
      id: `compliance.${key}.overall`,
      title: `${name} Compliance: ${regResult.score}/100 (${regResult.status})`,
      severity: overallSeverity,
      category: "compliance",
      detail: `${name} compliance score based on ${regResult.checks.length} checks. ${
        regResult.checks.filter((c) => c.passed).length
      } passed, ${regResult.checks.filter((c) => !c.passed).length} failed.`,
    });

    // Add findings for failed required checks
    for (const check of regResult.checks) {
      if (!check.passed && check.required) {
        findings.push({
          id: `compliance.${check.id}`,
          title: `${name}: ${check.name} - FAILED`,
          severity: "fail",
          category: "compliance",
          detail: check.details || `Required ${name} check "${check.name}" failed.`,
        });
      }
    }

    // Add warnings for failed recommended checks
    for (const check of regResult.checks) {
      if (!check.passed && !check.required) {
        findings.push({
          id: `compliance.${check.id}`,
          title: `${name}: ${check.name} - Recommended`,
          severity: "warn",
          category: "compliance",
          detail: check.details || `Recommended ${name} check "${check.name}" not met.`,
        });
      }
    }
  }

  return findings;
}

/**
 * Convert compliance status to gdprCompliance score format.
 */
export function getGdprComplianceStatus(
  result: ComplianceResult
): "pass" | "warn" | "fail" {
  return result.gdpr.status;
}
