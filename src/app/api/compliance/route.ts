/**
 * Cookie Compliance Check API
 *
 * POST /api/compliance
 *
 * Analyzes cookies for GDPR/ePrivacy compliance.
 * Returns compliance report with issues and recommendations.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  scanCookies,
  generateComplianceReport,
  generateCookieFindings,
  type RawCookie,
} from "@/lib/cookies/index";
import {
  validateTCFConsent,
  generateConsentStateFromCategories,
  type TCFConsentState,
} from "@/lib/cookies/iab-tcf";

const CookieInputSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().optional(),
  value: z.string().optional(),
  expires: z.union([z.number(), z.string()]).optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.string().optional(),
});

const ComplianceRequestSchema = z.object({
  url: z.string().url(),
  cookies: z.array(CookieInputSchema).min(1).max(200),
  // Optional: allowed categories for TCF validation
  allowedCategories: z
    .array(z.enum(["necessary", "functional", "analytics", "marketing"]))
    .optional(),
  // Optional: include TCF validation
  validateTCF: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, cookies, allowedCategories, validateTCF } =
      ComplianceRequestSchema.parse(body);

    // Convert to RawCookie format
    const rawCookies: RawCookie[] = cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      value: c.value,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));

    // Scan and categorize cookies
    const scanResult = scanCookies(rawCookies, url);

    // Generate compliance report
    const report = generateComplianceReport(scanResult);

    // Generate findings
    const findings = generateCookieFindings(scanResult);

    // Optional: TCF validation
    let tcfValidation;
    if (validateTCF && allowedCategories) {
      const consentState = generateConsentStateFromCategories(allowedCategories);
      tcfValidation = validateTCFConsent(consentState);
    }

    return NextResponse.json({
      report,
      findings,
      scanResult: {
        url: scanResult.url,
        scannedAt: scanResult.scannedAt,
        summary: scanResult.summary,
        confidence: scanResult.confidence,
        compliance: scanResult.compliance,
      },
      ...(tcfValidation && { tcfValidation }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("[Compliance API Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/tcf?categories=necessary,functional
 *
 * Generate TCF consent state and validate for given categories.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const categoriesParam = url.searchParams.get("categories");

    if (!categoriesParam) {
      return NextResponse.json(
        { error: "Missing required parameter: categories" },
        { status: 400 }
      );
    }

    const validCategories = ["necessary", "functional", "analytics", "marketing"] as const;
    type ValidCategory = (typeof validCategories)[number];

    const categories = categoriesParam.split(",").filter((c): c is ValidCategory =>
      validCategories.includes(c as ValidCategory)
    );

    if (categories.length === 0) {
      return NextResponse.json(
        {
          error: "Invalid categories. Must be one or more of: necessary, functional, analytics, marketing",
        },
        { status: 400 }
      );
    }

    // Generate consent state from categories
    const consentState = generateConsentStateFromCategories(categories);

    // Validate TCF compliance
    const validation = validateTCFConsent(consentState);

    return NextResponse.json({
      categories,
      consentState: {
        purposeConsents: consentState.purposeConsents,
        specialFeatureOptins: consentState.specialFeatureOptins,
      },
      validation: {
        isCompliant: validation.isCompliant,
        version: validation.version,
        issues: validation.issues,
        purposeStatus: validation.purposeStatus,
      },
    });
  } catch (error) {
    console.error("[Compliance API Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
