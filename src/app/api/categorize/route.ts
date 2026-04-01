/**
 * Cookie Categorization API
 *
 * POST /api/categorize
 *
 * Categorizes cookies using the Open Cookie Database and local patterns.
 * Returns category, vendor, description, and confidence for each cookie.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  categorizeCookieFull,
  categorizeCookies,
  summarizeCookiesByCategory,
  getCategorizationConfidence,
} from "@/lib/cookies/index";

const CookieInputSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().optional(),
  value: z.string().optional(),
});

const CategorizeRequestSchema = z.object({
  cookies: z.array(CookieInputSchema).min(1).max(100),
  includeConfidence: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cookies, includeConfidence } = CategorizeRequestSchema.parse(body);

    // Categorize each cookie with full details
    const categorized = cookies.map((cookie) => {
      const result = categorizeCookieFull(cookie.name, cookie.domain);

      return {
        name: cookie.name,
        domain: cookie.domain,
        category: result.category,
        vendor: result.vendor,
        description: result.description,
        ...(includeConfidence && {
          source: result.source,
          confidence: result.confidence,
        }),
      };
    });

    // Generate summary statistics
    const categorizedCookies = categorizeCookies(cookies);
    const summary = summarizeCookiesByCategory(categorizedCookies);
    const confidence = getCategorizationConfidence(cookies);

    return NextResponse.json({
      cookies: categorized,
      summary: {
        total: cookies.length,
        byCategory: summary,
        ...(includeConfidence && {
          confidence: {
            average: Math.round(confidence.averageConfidence * 100) / 100,
            highConfidence: confidence.highConfidenceCount,
            lowConfidence: confidence.lowConfidenceCount,
            unknown: confidence.unknownCount,
          },
        }),
      },
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

    console.error("[Categorize API Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/categorize?name=_ga&domain=.google.com
 *
 * Categorize a single cookie by name (and optionally domain).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    const domain = url.searchParams.get("domain") ?? undefined;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required parameter: name" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: "Cookie name too long (max 200 characters)" },
        { status: 400 }
      );
    }

    const result = categorizeCookieFull(name, domain);

    return NextResponse.json({
      name,
      domain,
      category: result.category,
      vendor: result.vendor,
      description: result.description,
      source: result.source,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("[Categorize API Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
