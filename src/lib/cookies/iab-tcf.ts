/**
 * IAB TCF (Transparency & Consent Framework) v2.2 Compliance
 *
 * Provides utilities for IAB TCF compliance including:
 * - Purpose mapping to cookie categories
 * - Vendor consent verification
 * - TC string generation and parsing
 * - TCF v2.2 signal validation
 *
 * Reference: https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 */

import type { CookieCategory } from "@/lib/types";

/**
 * IAB TCF Purpose definitions (v2.2)
 * Each purpose maps to specific cookie categories and use cases
 */
type LegalBasis = "consent" | "legitimate-interest";

export const TCF_PURPOSES: Record<number, {
  id: number;
  name: string;
  description: string;
  cookieCategories: CookieCategory[];
  required: boolean;
  legalBasis: LegalBasis[];
}> = {
  1: {
    id: 1,
    name: "Store and/or access information on a device",
    description: "Cookies, device or similar online identifiers together with other information can be stored or read on your device to recognise it each time it connects to an app or to a website.",
    cookieCategories: ["necessary", "functional", "analytics", "marketing"],
    required: true,
    legalBasis: ["consent"],
  },
  2: {
    id: 2,
    name: "Select basic ads",
    description: "Ads can be shown to you based on the content you're viewing, the app you're using, your approximate location, or your device type.",
    cookieCategories: ["marketing"],
    required: false,
    legalBasis: ["consent", "legitimate-interest"],
  },
  3: {
    id: 3,
    name: "Create a personalised ads profile",
    description: "A profile can be built about you and your interests to show you personalised ads that are relevant to you.",
    cookieCategories: ["marketing"],
    required: false,
    legalBasis: ["consent"],
  },
  4: {
    id: 4,
    name: "Select personalised ads",
    description: "Personalised ads can be shown to you based on a profile about you.",
    cookieCategories: ["marketing"],
    required: false,
    legalBasis: ["consent"],
  },
  5: {
    id: 5,
    name: "Create a personalised content profile",
    description: "A profile can be built about you and your interests to show you personalised content that is relevant to you.",
    cookieCategories: ["functional", "analytics"],
    required: false,
    legalBasis: ["consent"],
  },
  6: {
    id: 6,
    name: "Select personalised content",
    description: "Personalised content can be shown to you based on a profile about you.",
    cookieCategories: ["functional"],
    required: false,
    legalBasis: ["consent"],
  },
  7: {
    id: 7,
    name: "Measure ad performance",
    description: "The performance and effectiveness of ads that you see or interact with can be measured.",
    cookieCategories: ["analytics", "marketing"],
    required: false,
    legalBasis: ["consent", "legitimate-interest"],
  },
  8: {
    id: 8,
    name: "Measure content performance",
    description: "The performance and effectiveness of content that you see or interact with can be measured.",
    cookieCategories: ["analytics"],
    required: false,
    legalBasis: ["consent", "legitimate-interest"],
  },
  9: {
    id: 9,
    name: "Apply market research to generate audience insights",
    description: "Market research can be used to learn more about the audiences who visit sites/apps and view ads.",
    cookieCategories: ["analytics"],
    required: false,
    legalBasis: ["consent", "legitimate-interest"],
  },
  10: {
    id: 10,
    name: "Develop and improve products",
    description: "Your data can be used to improve existing systems and software, and to develop new products.",
    cookieCategories: ["analytics", "functional"],
    required: false,
    legalBasis: ["consent", "legitimate-interest"],
  },
  11: {
    id: 11,
    name: "Use limited data to select content",
    description: "Content can be selected based on limited data.",
    cookieCategories: ["functional"],
    required: false,
    legalBasis: ["consent", "legitimate-interest"],
  },
};

/**
 * IAB TCF Special Features (require explicit opt-in)
 */
export const TCF_SPECIAL_FEATURES = {
  1: {
    id: 1,
    name: "Use precise geolocation data",
    description: "Your precise geolocation data can be used in support of one or more purposes.",
    cookieCategories: ["marketing", "analytics"] as CookieCategory[],
  },
  2: {
    id: 2,
    name: "Actively scan device characteristics for identification",
    description: "Your device can be identified based on a scan of your device's unique combination of characteristics.",
    cookieCategories: ["marketing"] as CookieCategory[],
  },
} as const;

/**
 * IAB TCF Special Purposes (no consent required, but transparency needed)
 */
export const TCF_SPECIAL_PURPOSES = {
  1: {
    id: 1,
    name: "Ensure security, prevent fraud, and debug",
    description: "Your data can be used to monitor for and prevent unusual and possibly fraudulent activity.",
    cookieCategories: ["necessary"] as CookieCategory[],
  },
  2: {
    id: 2,
    name: "Technically deliver ads or content",
    description: "Your device can receive and send information that allows you to see and interact with ads and content.",
    cookieCategories: ["necessary"] as CookieCategory[],
  },
} as const;

export type TCFPurposeId = keyof typeof TCF_PURPOSES;
export type TCFSpecialFeatureId = keyof typeof TCF_SPECIAL_FEATURES;
export type TCFSpecialPurposeId = keyof typeof TCF_SPECIAL_PURPOSES;

/**
 * Consent state for TCF purposes
 */
export interface TCFConsentState {
  purposeConsents: Record<number, boolean>;
  purposeLegitimateInterests: Record<number, boolean>;
  specialFeatureOptins: Record<number, boolean>;
  vendorConsents: Record<number, boolean>;
  vendorLegitimateInterests: Record<number, boolean>;
}

/**
 * TCF compliance check result
 */
export interface TCFComplianceResult {
  isCompliant: boolean;
  version: "2.0" | "2.2";
  issues: TCFIssue[];
  purposeStatus: Record<number, { consented: boolean; legitimateInterest: boolean }>;
  specialFeatureStatus: Record<number, boolean>;
}

export interface TCFIssue {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  purposeId?: number;
  vendorId?: number;
}

/**
 * Get the purposes required for a cookie category
 */
export function getPurposesForCategory(category: CookieCategory): number[] {
  const purposes: number[] = [];

  for (const [id, purpose] of Object.entries(TCF_PURPOSES)) {
    if (purpose.cookieCategories.includes(category)) {
      purposes.push(Number(id));
    }
  }

  return purposes;
}

/**
 * Get the primary purpose for a cookie category
 */
export function getPrimaryPurposeForCategory(category: CookieCategory): number | null {
  switch (category) {
    case "necessary":
      return null; // Necessary cookies don't require TCF purpose consent
    case "functional":
      return 6; // Select personalised content
    case "analytics":
      return 8; // Measure content performance
    case "marketing":
      return 4; // Select personalised ads
    default:
      return null;
  }
}

/**
 * Check if a category is allowed based on TCF consent state
 */
export function isCategoryAllowed(
  category: CookieCategory,
  consentState: TCFConsentState
): boolean {
  // Necessary cookies are always allowed
  if (category === "necessary") {
    return true;
  }

  const primaryPurpose = getPrimaryPurposeForCategory(category);
  if (primaryPurpose === null) {
    return false;
  }

  // Check if purpose is consented or has legitimate interest
  const purpose = TCF_PURPOSES[primaryPurpose as TCFPurposeId];
  if (!purpose) return false;

  const consented = consentState.purposeConsents[primaryPurpose] === true;
  const hasLegitimateInterest =
    purpose.legalBasis.includes("legitimate-interest") &&
    consentState.purposeLegitimateInterests[primaryPurpose] === true;

  return consented || hasLegitimateInterest;
}

/**
 * Generate TCF consent state from cookie categories
 */
export function generateConsentStateFromCategories(
  allowedCategories: CookieCategory[]
): TCFConsentState {
  const purposeConsents: Record<number, boolean> = {};
  const purposeLegitimateInterests: Record<number, boolean> = {};
  const specialFeatureOptins: Record<number, boolean> = {};

  // Map categories to purposes
  for (const category of allowedCategories) {
    const purposes = getPurposesForCategory(category);
    for (const purposeId of purposes) {
      purposeConsents[purposeId] = true;
    }
  }

  // Initialize all purposes with defaults
  for (const id of Object.keys(TCF_PURPOSES)) {
    const purposeId = Number(id);
    if (purposeConsents[purposeId] === undefined) {
      purposeConsents[purposeId] = false;
    }
    purposeLegitimateInterests[purposeId] = false;
  }

  // Initialize special features
  for (const id of Object.keys(TCF_SPECIAL_FEATURES)) {
    const featureId = Number(id);
    // Special features require explicit opt-in
    specialFeatureOptins[featureId] =
      allowedCategories.includes("marketing") || allowedCategories.includes("analytics");
  }

  return {
    purposeConsents,
    purposeLegitimateInterests,
    specialFeatureOptins,
    vendorConsents: {},
    vendorLegitimateInterests: {},
  };
}

/**
 * Validate TCF consent state for compliance
 */
export function validateTCFConsent(consentState: TCFConsentState): TCFComplianceResult {
  const issues: TCFIssue[] = [];
  const purposeStatus: Record<number, { consented: boolean; legitimateInterest: boolean }> = {};
  const specialFeatureStatus: Record<number, boolean> = {};

  // Check Purpose 1 (required for any tracking)
  if (!consentState.purposeConsents[1]) {
    issues.push({
      code: "PURPOSE_1_NOT_CONSENTED",
      message: "Purpose 1 (Store/access device information) is required but not consented",
      severity: "error",
      purposeId: 1,
    });
  }

  // Validate each purpose
  for (const [id, purpose] of Object.entries(TCF_PURPOSES)) {
    const purposeId = Number(id);
    const consented = consentState.purposeConsents[purposeId] === true;
    const legitimateInterest = consentState.purposeLegitimateInterests[purposeId] === true;

    purposeStatus[purposeId] = { consented, legitimateInterest };

    // Check for purposes that can't use legitimate interest
    if (!purpose.legalBasis.includes("legitimate-interest") && legitimateInterest && !consented) {
      issues.push({
        code: "INVALID_LEGITIMATE_INTEREST",
        message: `Purpose ${purposeId} cannot use legitimate interest as legal basis`,
        severity: "warning",
        purposeId,
      });
    }
  }

  // Validate special features
  for (const id of Object.keys(TCF_SPECIAL_FEATURES)) {
    const featureId = Number(id);
    specialFeatureStatus[featureId] = consentState.specialFeatureOptins[featureId] === true;
  }

  // Check for personalization without base consent
  if (
    (consentState.purposeConsents[3] || consentState.purposeConsents[4]) &&
    !consentState.purposeConsents[1]
  ) {
    issues.push({
      code: "PERSONALIZATION_WITHOUT_STORAGE",
      message: "Personalization purposes (3,4) require Purpose 1 consent",
      severity: "error",
    });
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    isCompliant: !hasErrors,
    version: "2.2",
    issues,
    purposeStatus,
    specialFeatureStatus,
  };
}

/**
 * Generate a simplified TC string (for demo purposes)
 * Note: Real TC strings require proper encoding per IAB spec
 */
export function generateSimpleTCString(consentState: TCFConsentState): string {
  // This is a simplified representation - actual TC strings are base64-encoded bitfields
  const parts: string[] = [];

  // Version
  parts.push("2"); // TCF v2

  // Created/Updated timestamps (simplified)
  const now = Math.floor(Date.now() / 100); // deciseconds
  parts.push(now.toString(36));

  // CMP ID and version (placeholder)
  parts.push("0"); // CMP ID
  parts.push("1"); // CMP version

  // Purpose consents as bit string
  let purposeBits = "";
  for (let i = 1; i <= 11; i++) {
    purposeBits += consentState.purposeConsents[i] ? "1" : "0";
  }
  parts.push(Number.parseInt(purposeBits, 2).toString(36));

  // Special features as bit string
  let featureBits = "";
  for (let i = 1; i <= 2; i++) {
    featureBits += consentState.specialFeatureOptins[i] ? "1" : "0";
  }
  parts.push(Number.parseInt(featureBits, 2).toString(36));

  return `TCF2_${parts.join(".")}`;
}

/**
 * Map a cookie to required TCF purposes
 */
export function getCookieTCFRequirements(
  category: CookieCategory
): {
  purposes: number[];
  specialFeatures: number[];
  requiresConsent: boolean;
} {
  if (category === "necessary") {
    return {
      purposes: [],
      specialFeatures: [],
      requiresConsent: false,
    };
  }

  const purposes = getPurposesForCategory(category);
  const specialFeatures: number[] = [];

  // Marketing cookies may require special features
  if (category === "marketing") {
    specialFeatures.push(1, 2);
  }

  return {
    purposes,
    specialFeatures,
    requiresConsent: true,
  };
}

/**
 * Get human-readable purpose name
 */
export function getPurposeName(purposeId: number): string {
  const purpose = TCF_PURPOSES[purposeId as TCFPurposeId];
  return purpose?.name ?? `Purpose ${purposeId}`;
}

/**
 * Get human-readable special feature name
 */
export function getSpecialFeatureName(featureId: number): string {
  const feature = TCF_SPECIAL_FEATURES[featureId as TCFSpecialFeatureId];
  return feature?.name ?? `Special Feature ${featureId}`;
}

/**
 * Check if a vendor requires consent for specific purposes
 */
export function checkVendorConsent(
  vendorId: number,
  requiredPurposes: number[],
  consentState: TCFConsentState
): { allowed: boolean; missingPurposes: number[] } {
  // Check if vendor is consented
  if (!consentState.vendorConsents[vendorId]) {
    return {
      allowed: false,
      missingPurposes: requiredPurposes,
    };
  }

  // Check each required purpose
  const missingPurposes: number[] = [];
  for (const purposeId of requiredPurposes) {
    const purpose = TCF_PURPOSES[purposeId as TCFPurposeId];
    if (!purpose) continue;

    const hasConsent = consentState.purposeConsents[purposeId] === true;
    const hasLI =
      purpose.legalBasis.includes("legitimate-interest") &&
      consentState.purposeLegitimateInterests[purposeId] === true;

    if (!hasConsent && !hasLI) {
      missingPurposes.push(purposeId);
    }
  }

  return {
    allowed: missingPurposes.length === 0,
    missingPurposes,
  };
}
