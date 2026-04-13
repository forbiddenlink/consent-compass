/**
 * IAB Transparency & Consent Framework (TCF) v2.2 Validator
 *
 * Validates consent strings and CMP implementations against IAB TCF specifications.
 * Reference: https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 */

import type { ConsentFinding } from "./types";

export interface TCFConsentData {
  tcString?: string;
  cmpId?: number;
  cmpVersion?: number;
  tcfPolicyVersion?: number;
  isServiceSpecific?: boolean;
  useNonStandardTexts?: boolean;
  purposeOneTreatment?: boolean;
  publisherCC?: string;
  vendorConsents?: Record<number, boolean>;
  purposeConsents?: Record<number, boolean>;
  specialFeatureOptins?: Record<number, boolean>;
  legitimateInterests?: {
    vendors?: Record<number, boolean>;
    purposes?: Record<number, boolean>;
  };
}

export interface TCFValidationResult {
  detected: boolean;
  version?: "v1.1" | "v2.0" | "v2.2";
  cmpId?: number;
  cmpName?: string;
  isValid: boolean;
  issues: TCFIssue[];
  consentData?: TCFConsentData;
  apiAvailable: boolean;
  gdprApplies?: boolean;
}

export interface TCFIssue {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  details?: string;
}

// Known CMP IDs from IAB registry
// Source: https://iabeurope.eu/cmp-list/
const KNOWN_CMPS: Record<number, string> = {
  2: "Sourcepoint",
  6: "AdMetrics",
  8: "OneTrust",
  10: "Quantcast",
  14: "Didomi",
  15: "Crownpeak",
  21: "LiveRamp",
  28: "Cookiebot (Cybot)",
  36: "Consentmanager.net",
  42: "TrustArc",
  70: "Commanders Act",
  76: "Axel Springer",
  90: "Osano",
  92: "UniConsent",
  128: "PubConsent",
  134: "Cookie Information",
  141: "Usercentrics",
  144: "Admiral",
  154: "Optad360",
  162: "Klaro!",
  175: "iubenda",
  186: "CCM19",
  212: "Borlabs Cookie",
  224: "TechConsent",
  241: "Funding Choices (Google)",
  253: "Civic",
  269: "Sirdata",
  284: "Complianz",
  290: "CookieYes",
  300: "SFBX",
};

// TCF Purpose IDs and their descriptions
const TCF_PURPOSES: Record<number, { name: string; required: boolean }> = {
  1: { name: "Store and/or access information on a device", required: true },
  2: { name: "Select basic ads", required: false },
  3: { name: "Create a personalised ads profile", required: false },
  4: { name: "Select personalised ads", required: false },
  5: { name: "Create a personalised content profile", required: false },
  6: { name: "Select personalised content", required: false },
  7: { name: "Measure ad performance", required: false },
  8: { name: "Measure content performance", required: false },
  9: { name: "Apply market research to generate audience insights", required: false },
  10: { name: "Develop and improve products", required: false },
  11: { name: "Use limited data to select content", required: false },
};

// Special features that require explicit opt-in
const TCF_SPECIAL_FEATURES: Record<number, string> = {
  1: "Use precise geolocation data",
  2: "Actively scan device characteristics for identification",
};

/**
 * Decode a TCF v2 consent string
 * TCF v2 strings are base64url encoded bitfields
 */
function decodeTCFString(tcString: string): TCFConsentData | null {
  try {
    // Basic structure validation
    if (!tcString || tcString.length < 20) {
      return null;
    }

    // TCF strings use base64url encoding
    const base64 = tcString.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    // Decode base64 to binary
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Read bits from the binary data
    let bitOffset = 0;

    const readBits = (numBits: number): number => {
      let value = 0;
      for (let i = 0; i < numBits; i++) {
        const byteIndex = Math.floor(bitOffset / 8);
        const bitIndex = 7 - (bitOffset % 8);
        if (byteIndex < bytes.length) {
          const bit = (bytes[byteIndex] >> bitIndex) & 1;
          value = (value << 1) | bit;
        }
        bitOffset++;
      }
      return value;
    };

    // TCF v2 Header
    const version = readBits(6);
    if (version !== 2) {
      // Check for TCF v1
      if (version === 1) {
        return {
          tcString,
          tcfPolicyVersion: 1,
        };
      }
      return null;
    }

    const created = readBits(36); // deciseconds since 01/01/2020
    const lastUpdated = readBits(36);
    const cmpId = readBits(12);
    const cmpVersion = readBits(12);
    const consentScreen = readBits(6);
    const consentLanguageRaw = readBits(12);
    const vendorListVersion = readBits(12);
    const tcfPolicyVersion = readBits(6);
    const isServiceSpecific = readBits(1) === 1;
    const useNonStandardTexts = readBits(1) === 1;

    // Parse consent language (2 chars encoded in 6 bits each)
    const consentLanguage = String.fromCharCode(
      ((consentLanguageRaw >> 6) & 0x3f) + 65,
      (consentLanguageRaw & 0x3f) + 65
    ).toLowerCase();

    // Special feature opt-ins (12 bits for features 1-12)
    const specialFeatureOptins: Record<number, boolean> = {};
    for (let i = 1; i <= 12; i++) {
      specialFeatureOptins[i] = readBits(1) === 1;
    }

    // Purpose consents (24 bits for purposes 1-24)
    const purposeConsents: Record<number, boolean> = {};
    for (let i = 1; i <= 24; i++) {
      purposeConsents[i] = readBits(1) === 1;
    }

    // Purpose legitimate interests (24 bits)
    const purposeLegitimateInterests: Record<number, boolean> = {};
    for (let i = 1; i <= 24; i++) {
      purposeLegitimateInterests[i] = readBits(1) === 1;
    }

    // Purpose one treatment (1 bit)
    const purposeOneTreatment = readBits(1) === 1;

    // Publisher CC (12 bits - 2 characters)
    const publisherCCRaw = readBits(12);
    const publisherCC = String.fromCharCode(
      ((publisherCCRaw >> 6) & 0x3f) + 65,
      (publisherCCRaw & 0x3f) + 65
    ).toUpperCase();

    return {
      tcString,
      cmpId,
      cmpVersion,
      tcfPolicyVersion,
      isServiceSpecific,
      useNonStandardTexts,
      purposeOneTreatment,
      publisherCC,
      purposeConsents,
      specialFeatureOptins,
      legitimateInterests: {
        purposes: purposeLegitimateInterests,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Validate TCF consent data against IAB specifications
 */
function validateTCFData(data: TCFConsentData): TCFIssue[] {
  const issues: TCFIssue[] = [];

  // Validate CMP ID
  if (data.cmpId !== undefined) {
    if (data.cmpId < 1) {
      issues.push({
        code: "TCF_INVALID_CMP_ID",
        message: "Invalid CMP ID",
        severity: "error",
        details: `CMP ID ${data.cmpId} is not valid`,
      });
    } else if (!KNOWN_CMPS[data.cmpId]) {
      issues.push({
        code: "TCF_UNKNOWN_CMP",
        message: "CMP not found in IAB registry",
        severity: "warning",
        details: `CMP ID ${data.cmpId} is not in the known CMP list`,
      });
    }
  }

  // Validate TCF policy version
  if (data.tcfPolicyVersion !== undefined) {
    if (data.tcfPolicyVersion < 2) {
      issues.push({
        code: "TCF_OUTDATED_POLICY",
        message: "TCF policy version is outdated",
        severity: "warning",
        details: `Policy version ${data.tcfPolicyVersion} should be at least 2 for TCF v2`,
      });
    }
    if (data.tcfPolicyVersion > 4) {
      issues.push({
        code: "TCF_UNKNOWN_POLICY_VERSION",
        message: "Unrecognized TCF policy version",
        severity: "info",
        details: `Policy version ${data.tcfPolicyVersion} may be newer than supported`,
      });
    }
  }

  // Validate purpose consents
  if (data.purposeConsents) {
    // Purpose 1 (store/access device) is typically required
    if (!data.purposeConsents[1] && !data.purposeOneTreatment) {
      issues.push({
        code: "TCF_PURPOSE_1_NOT_CONSENTED",
        message: "Purpose 1 (device access) not consented",
        severity: "info",
        details: "Purpose 1 is typically required for most tracking activities",
      });
    }
  }

  // Validate publisher country code
  if (data.publisherCC) {
    const validCC = /^[A-Z]{2}$/.test(data.publisherCC);
    if (!validCC) {
      issues.push({
        code: "TCF_INVALID_PUBLISHER_CC",
        message: "Invalid publisher country code",
        severity: "warning",
        details: `Country code "${data.publisherCC}" is not valid ISO 3166-1 alpha-2`,
      });
    }
  }

  // Check for non-standard texts flag
  if (data.useNonStandardTexts) {
    issues.push({
      code: "TCF_NON_STANDARD_TEXTS",
      message: "CMP uses non-standard texts",
      severity: "warning",
      details: "Non-standard texts may not comply with TCF requirements",
    });
  }

  return issues;
}

/**
 * Analyze TCF implementation on a page
 * Call this from page.evaluate() context
 */
export function analyzeTCFInBrowser(): TCFValidationResult {
  const result: TCFValidationResult = {
    detected: false,
    isValid: false,
    issues: [],
    apiAvailable: false,
  };

  try {
    // Check for __tcfapi (TCF v2.x)
    // biome-ignore lint/suspicious/noExplicitAny: Browser global
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;

    if (typeof win.__tcfapi === "function") {
      result.apiAvailable = true;
      result.detected = true;

      // Get TCF data via ping
      win.__tcfapi("ping", 2, (pingReturn: {
        gdprApplies?: boolean;
        cmpLoaded?: boolean;
        cmpStatus?: string;
        displayStatus?: string;
        apiVersion?: string;
        cmpVersion?: number;
        cmpId?: number;
        gvlVersion?: number;
        tcfPolicyVersion?: number;
      }) => {
        if (pingReturn) {
          result.gdprApplies = pingReturn.gdprApplies;
          result.cmpId = pingReturn.cmpId;
          result.version = pingReturn.tcfPolicyVersion === 4 ? "v2.2" : "v2.0";

          if (!pingReturn.cmpLoaded) {
            result.issues.push({
              code: "TCF_CMP_NOT_LOADED",
              message: "CMP is not fully loaded",
              severity: "warning",
              details: `CMP status: ${pingReturn.cmpStatus}`,
            });
          }
        }
      });

      // Try to get TC data
      win.__tcfapi("getTCData", 2, (tcData: {
        tcString?: string;
        eventStatus?: string;
        cmpStatus?: string;
        isServiceSpecific?: boolean;
        useNonStandardTexts?: boolean;
        purposeOneTreatment?: boolean;
        publisherCC?: string;
        cmpId?: number;
        cmpVersion?: number;
        tcfPolicyVersion?: number;
        purpose?: {
          consents?: Record<number, boolean>;
          legitimateInterests?: Record<number, boolean>;
        };
        vendor?: {
          consents?: Record<number, boolean>;
          legitimateInterests?: Record<number, boolean>;
        };
        specialFeatureOptins?: Record<number, boolean>;
      }, success: boolean) => {
        if (success && tcData) {
          result.consentData = {
            tcString: tcData.tcString,
            cmpId: tcData.cmpId,
            cmpVersion: tcData.cmpVersion,
            tcfPolicyVersion: tcData.tcfPolicyVersion,
            isServiceSpecific: tcData.isServiceSpecific,
            useNonStandardTexts: tcData.useNonStandardTexts,
            purposeOneTreatment: tcData.purposeOneTreatment,
            publisherCC: tcData.publisherCC,
            purposeConsents: tcData.purpose?.consents,
            specialFeatureOptins: tcData.specialFeatureOptins,
            vendorConsents: tcData.vendor?.consents,
            legitimateInterests: {
              vendors: tcData.vendor?.legitimateInterests,
              purposes: tcData.purpose?.legitimateInterests,
            },
          };
          result.isValid = true;
        } else {
          result.issues.push({
            code: "TCF_GET_TC_DATA_FAILED",
            message: "Failed to retrieve TC data",
            severity: "error",
          });
        }
      });
    }

    // Check for legacy __cmp (TCF v1.1)
    if (!result.detected && typeof win.__cmp === "function") {
      result.apiAvailable = true;
      result.detected = true;
      result.version = "v1.1";
      result.issues.push({
        code: "TCF_V1_DEPRECATED",
        message: "TCF v1.1 is deprecated",
        severity: "warning",
        details: "Sites should upgrade to TCF v2.0 or later",
      });
    }

    // Check for consent string in cookies
    const cookies = document.cookie.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("euconsent-v2=") || cookie.startsWith("eupubconsent-v2=")) {
        const tcString = cookie.split("=")[1];
        if (tcString && !result.consentData?.tcString) {
          result.detected = true;
          result.consentData = { tcString };
        }
      }
      if (cookie.startsWith("euconsent=")) {
        result.detected = true;
        if (!result.version) {
          result.version = "v1.1";
          result.issues.push({
            code: "TCF_V1_COOKIE",
            message: "Legacy TCF v1.1 consent string found",
            severity: "warning",
          });
        }
      }
    }

    // Check localStorage for consent strings
    try {
      const localStorageKeys = ["euconsent-v2", "eupubconsent-v2", "tcf-consent"];
      for (const key of localStorageKeys) {
        const value = localStorage.getItem(key);
        if (value && !result.consentData?.tcString) {
          result.detected = true;
          result.consentData = { tcString: value };
        }
      }
    } catch {
      // localStorage may be blocked
    }
  } catch (e) {
    result.issues.push({
      code: "TCF_ANALYSIS_ERROR",
      message: "Error analyzing TCF implementation",
      severity: "error",
      details: e instanceof Error ? e.message : "Unknown error",
    });
  }

  return result;
}

/**
 * Server-side validation of TCF consent string
 */
export function validateTCFString(tcString: string): {
  valid: boolean;
  data: TCFConsentData | null;
  issues: TCFIssue[];
} {
  const issues: TCFIssue[] = [];

  if (!tcString || tcString.length < 20) {
    return {
      valid: false,
      data: null,
      issues: [
        {
          code: "TCF_STRING_TOO_SHORT",
          message: "TC string is too short to be valid",
          severity: "error",
        },
      ],
    };
  }

  const data = decodeTCFString(tcString);

  if (!data) {
    return {
      valid: false,
      data: null,
      issues: [
        {
          code: "TCF_STRING_DECODE_FAILED",
          message: "Failed to decode TC string",
          severity: "error",
        },
      ],
    };
  }

  // Validate decoded data
  const validationIssues = validateTCFData(data);
  issues.push(...validationIssues);

  return {
    valid: validationIssues.filter((i) => i.severity === "error").length === 0,
    data,
    issues,
  };
}

/**
 * Get CMP name from ID
 */
export function getCMPName(cmpId: number): string | undefined {
  return KNOWN_CMPS[cmpId];
}

/**
 * Generate findings from TCF validation result
 */
export function generateTCFFindings(result: TCFValidationResult): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  if (!result.detected) {
    // No TCF implementation found - not necessarily an issue
    return findings;
  }

  // TCF detected
  const cmpName = result.cmpId ? getCMPName(result.cmpId) : undefined;

  if (result.version === "v2.2" || result.version === "v2.0") {
    findings.push({
      id: "tcf.v2.detected",
      title: `IAB TCF ${result.version} implementation detected`,
      severity: "info",
      category: "compliance",
      detail: cmpName
        ? `Site uses ${cmpName} (CMP ID: ${result.cmpId}) for consent management`
        : `Site implements TCF ${result.version}`,
      evidence: result.consentData?.tcString
        ? { kind: "text", value: `TC String: ${result.consentData.tcString.slice(0, 50)}...` }
        : undefined,
    });
  } else if (result.version === "v1.1") {
    findings.push({
      id: "tcf.v1.deprecated",
      title: "Deprecated TCF v1.1 implementation detected",
      severity: "warn",
      category: "compliance",
      detail:
        "TCF v1.1 has been deprecated. Sites should upgrade to TCF v2.2 for compliance with current IAB standards.",
    });
  }

  // API availability
  if (!result.apiAvailable && result.detected) {
    findings.push({
      id: "tcf.api.missing",
      title: "TCF API (__tcfapi) not available",
      severity: "warn",
      category: "compliance",
      detail:
        "The __tcfapi function is not available. Third-party ad vendors may not be able to check consent status.",
    });
  }

  // Process issues
  for (const issue of result.issues) {
    const severity = issue.severity === "error" ? "fail" : issue.severity === "warning" ? "warn" : "info";

    findings.push({
      id: `tcf.issue.${issue.code.toLowerCase()}`,
      title: issue.message,
      severity,
      category: "compliance",
      detail: issue.details || issue.message,
    });
  }

  // Validate consent data if available
  if (result.consentData?.tcString) {
    const validation = validateTCFString(result.consentData.tcString);

    if (!validation.valid) {
      findings.push({
        id: "tcf.string.invalid",
        title: "Invalid TC consent string",
        severity: "fail",
        category: "compliance",
        detail: "The consent string failed validation and may not be properly honored by ad vendors",
      });
    }

    // Add any additional validation issues
    for (const issue of validation.issues) {
      if (!result.issues.some((i) => i.code === issue.code)) {
        const severity = issue.severity === "error" ? "fail" : issue.severity === "warning" ? "warn" : "info";
        findings.push({
          id: `tcf.validation.${issue.code.toLowerCase()}`,
          title: issue.message,
          severity,
          category: "compliance",
          detail: issue.details || issue.message,
        });
      }
    }
  }

  return findings;
}

/**
 * Check if TCF consent includes specific purpose
 */
export function hasPurposeConsent(data: TCFConsentData, purposeId: number): boolean {
  return data.purposeConsents?.[purposeId] === true;
}

/**
 * Check if TCF consent includes specific vendor
 */
export function hasVendorConsent(data: TCFConsentData, vendorId: number): boolean {
  return data.vendorConsents?.[vendorId] === true;
}

/**
 * Get list of consented purposes
 */
export function getConsentedPurposes(data: TCFConsentData): number[] {
  if (!data.purposeConsents) return [];
  return Object.entries(data.purposeConsents)
    .filter(([_, consented]) => consented)
    .map(([id]) => Number.parseInt(id, 10));
}

/**
 * Get purpose name by ID
 */
export function getPurposeName(purposeId: number): string {
  return TCF_PURPOSES[purposeId]?.name || `Purpose ${purposeId}`;
}

/**
 * Get special feature name by ID
 */
export function getSpecialFeatureName(featureId: number): string {
  return TCF_SPECIAL_FEATURES[featureId] || `Special Feature ${featureId}`;
}
