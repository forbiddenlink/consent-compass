/**
 * Global Privacy Control (GPC) detection and verification.
 *
 * GPC is a browser signal that indicates a user's intent to opt out of
 * the sale or sharing of their personal information. Sites should respect
 * this signal under laws like CCPA and GDPR.
 *
 * Detection methods:
 * 1. .well-known/gpc.json - Published support declaration
 * 2. navigator.globalPrivacyControl - JavaScript API (browser signal)
 *
 * Reference: https://globalprivacycontrol.github.io/gpc-spec/
 */

import type { Page } from "playwright";
import type { ConsentFinding } from "@/lib/types";

// ============================================================================
// Types
// ============================================================================

export type GpcDetectionMethod = "well-known" | "js-api";

export type GpcSupportResult = {
  detected: boolean;
  method?: GpcDetectionMethod;
  wellKnown?: {
    found: boolean;
    gpc?: boolean;
    error?: string;
  };
  jsApi?: {
    supported: boolean;
  };
};

export type GpcHonoredResult = {
  honored: boolean;
  evidence?: string;
  method?: "consent-default" | "tracker-reduction" | "unknown";
};

export type GpcResult = {
  detected: boolean;
  honored: boolean;
  support?: GpcSupportResult;
  honoredResult?: GpcHonoredResult;
};

// ============================================================================
// GPC Detection Functions
// ============================================================================

/**
 * Check if a site declares GPC support via .well-known/gpc.json.
 *
 * Per the spec, this file should contain: {"gpc": true}
 */
export async function checkWellKnownGpc(page: Page): Promise<GpcSupportResult["wellKnown"]> {
  try {
    const pageUrl = new URL(page.url());
    const gpcUrl = `${pageUrl.origin}/.well-known/gpc.json`;

    const response = await page.request.get(gpcUrl, {
      timeout: 5000,
      failOnStatusCode: false,
    });

    if (response.status() === 200) {
      try {
        const json = await response.json();
        return {
          found: true,
          gpc: json?.gpc === true,
        };
      } catch {
        return {
          found: true,
          gpc: false,
          error: "Invalid JSON in gpc.json",
        };
      }
    }

    return {
      found: false,
    };
  } catch (err) {
    return {
      found: false,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/**
 * Check if the page supports navigator.globalPrivacyControl.
 *
 * This checks if the JS API is recognized by the page context.
 * When GPC is sent via Sec-GPC: 1 header, compliant sites should
 * also expose this via the navigator API.
 */
export async function checkJsApiGpc(page: Page): Promise<GpcSupportResult["jsApi"]> {
  try {
    const supported = await page.evaluate(() => {
      // Check if the API exists and returns a value
      return typeof navigator !== "undefined" &&
             "globalPrivacyControl" in navigator &&
             navigator.globalPrivacyControl !== undefined;
    });

    return { supported };
  } catch {
    return { supported: false };
  }
}

/**
 * Main GPC support detection function.
 * Checks both .well-known/gpc.json and navigator.globalPrivacyControl.
 */
export async function checkGpcSupport(page: Page): Promise<GpcSupportResult> {
  const [wellKnown, jsApi] = await Promise.all([
    checkWellKnownGpc(page),
    checkJsApiGpc(page),
  ]);

  const wellKnownSupports = wellKnown?.found && wellKnown?.gpc === true;
  const jsApiSupports = jsApi?.supported === true;

  const detected = wellKnownSupports || jsApiSupports;

  let method: GpcDetectionMethod | undefined;
  if (wellKnownSupports) {
    method = "well-known";
  } else if (jsApiSupports) {
    method = "js-api";
  }

  return {
    detected,
    method,
    wellKnown,
    jsApi,
  };
}

// ============================================================================
// GPC Honoring Verification
// ============================================================================

/**
 * Verify if a site actually honors the GPC signal.
 *
 * Verification methods:
 * 1. Check if consent mode defaults to denied when GPC is present
 * 2. Compare tracker behavior with GPC vs without (requires re-scan)
 *
 * For now, we use a heuristic: if GPC is supported AND Google Consent Mode
 * signals are set to denied by default, the site is likely honoring GPC.
 */
export async function verifyGpcHonored(
  page: Page,
  options?: {
    preConsentTrackerCount?: number;
    googleConsentMode?: {
      detected: boolean;
      signals?: {
        ad_storage?: "granted" | "denied";
        analytics_storage?: "granted" | "denied";
      };
    };
  }
): Promise<GpcHonoredResult> {
  // Check if Google Consent Mode defaults indicate GPC is honored
  if (options?.googleConsentMode?.detected && options.googleConsentMode.signals) {
    const { ad_storage, analytics_storage } = options.googleConsentMode.signals;

    // If consent defaults to denied, site is likely honoring GPC
    if (ad_storage === "denied" || analytics_storage === "denied") {
      return {
        honored: true,
        method: "consent-default",
        evidence: `Google Consent Mode defaults: ad_storage=${ad_storage}, analytics_storage=${analytics_storage}`,
      };
    }
  }

  // Check for low tracker count as possible evidence
  if (options?.preConsentTrackerCount !== undefined && options.preConsentTrackerCount === 0) {
    return {
      honored: true,
      method: "tracker-reduction",
      evidence: "No trackers detected before consent with GPC signal",
    };
  }

  // Cannot determine honoring status
  return {
    honored: false,
    evidence: "Could not verify GPC signal is being honored",
  };
}

/**
 * Full GPC analysis: detect support and verify honoring.
 */
export async function analyzeGpc(
  page: Page,
  options?: {
    preConsentTrackerCount?: number;
    googleConsentMode?: {
      detected: boolean;
      signals?: {
        ad_storage?: "granted" | "denied";
        analytics_storage?: "granted" | "denied";
      };
    };
  }
): Promise<GpcResult> {
  const support = await checkGpcSupport(page);

  let honoredResult: GpcHonoredResult | undefined;
  if (support.detected) {
    honoredResult = await verifyGpcHonored(page, options);
  }

  return {
    detected: support.detected,
    honored: support.detected ? (honoredResult?.honored ?? false) : false,
    support,
    honoredResult,
  };
}

// ============================================================================
// Findings Generation
// ============================================================================

/**
 * Generate findings based on GPC analysis results.
 */
export function generateGpcFindings(result: GpcResult): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  if (result.detected) {
    if (result.honored) {
      findings.push({
        id: "gpc.honored",
        title: "GPC signal is supported and honored",
        severity: "info",
        category: "transparency",
        detail: `Site supports Global Privacy Control and appears to honor the signal. ${result.honoredResult?.evidence || ""}`,
        evidence: result.support?.method
          ? { kind: "text", value: `Detection method: ${result.support.method}` }
          : undefined,
      });
    } else {
      findings.push({
        id: "gpc.not_honored",
        title: "GPC signal supported but may not be honored",
        severity: "warn",
        category: "transparency",
        detail: "Site declares GPC support but we could not verify it is being honored. The site may still be compliant - manual verification recommended.",
        evidence: result.support?.method
          ? { kind: "text", value: `Detection method: ${result.support.method}` }
          : undefined,
      });
    }
  } else {
    findings.push({
      id: "gpc.not_supported",
      title: "No GPC support detected",
      severity: "info",
      category: "transparency",
      detail: "Site does not declare Global Privacy Control support via .well-known/gpc.json or navigator.globalPrivacyControl. This is not a violation but GPC support is recommended for privacy compliance.",
    });
  }

  return findings;
}
