import { chromium } from "playwright";
import type { ScanResult, ConsentFinding, CategorizedCookie, TrackedRequest, CookieCategory } from "@/lib/types";
import { categorizeCookies, summarizeCookiesByCategory, hasPreConsentTracking } from "@/lib/cookies";

const SCANNER_VERSION = "0.2.0";

const UA =
  "ConsentCompass/0.1 (Playwright; +https://example.local) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreFromFindings(findings: ConsentFinding[]): ScanResult["score"] {
  // Very rough v0 scoring.
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
    (score.choiceSymmetry + score.preConsentSignals + score.accessibility + score.transparency) /
      4,
  );
  return score;
}

const BANNER_HINTS = [
  "cookie",
  "consent",
  "gdpr",
  "privacy",
  "preferences",
  "your choices",
];

const ACCEPT_HINTS = ["accept", "allow all", "agree", "ok", "got it"];
const REJECT_HINTS = ["reject", "decline", "deny", "disallow", "no thanks", "only necessary", "necessary only"];
const MANAGE_HINTS = ["preferences", "manage", "settings", "customize", "choices", "more options"];

export async function scanUrl(url: string): Promise<ScanResult> {
  const started = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const preConsentRequests: TrackedRequest[] = [];
  page.on("request", (req) => {
    if (preConsentRequests.length >= 60) return;
    const reqUrl = req.url();
    let domain = "";
    try {
      domain = new URL(reqUrl).hostname;
    } catch {
      domain = "unknown";
    }
    preConsentRequests.push({
      url: reqUrl,
      resourceType: req.resourceType(),
      domain,
      isTracker: false, // Will be enhanced with tracker database later
    });
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1250);

    const html = await page.content();
    const lower = html.toLowerCase();

    const detectedByText = BANNER_HINTS.some((h) => lower.includes(h));

    // Heuristic selectors people often use.
    const selectorCandidates = [
      "#onetrust-banner-sdk",
      "#cookie-banner",
      "[id*='cookie']",
      "[class*='cookie']",
      "[id*='consent']",
      "[class*='consent']",
      "[aria-label*='cookie']",
      "[aria-label*='consent']",
    ];

    const matchedSelectors: string[] = [];
    for (const sel of selectorCandidates) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) matchedSelectors.push(sel);
      } catch {
        // ignore invalid selectors
      }
    }

    const acceptButtons: string[] = [];
    const rejectButtons: string[] = [];
    const managePrefsButtons: string[] = [];

    // Search visible-ish buttons/links by their text.
    const clickable = page.locator("button, [role='button'], a");
    const clickableCount = await clickable.count();
    for (let i = 0; i < Math.min(clickableCount, 220); i++) {
      const el = clickable.nth(i);
      const text = (await el.innerText().catch(() => "")).trim().toLowerCase();
      if (!text) continue;

      const isAccept = ACCEPT_HINTS.some((h) => text === h || text.includes(h));
      const isReject = REJECT_HINTS.some((h) => text === h || text.includes(h));
      const isManage = MANAGE_HINTS.some((h) => text === h || text.includes(h));

      if (isAccept) acceptButtons.push(text.slice(0, 80));
      if (isReject) rejectButtons.push(text.slice(0, 80));
      if (isManage) managePrefsButtons.push(text.slice(0, 80));

      if (acceptButtons.length > 10 && rejectButtons.length > 10 && managePrefsButtons.length > 10) break;
    }

    const findings: ConsentFinding[] = [];

    const bannerDetected =
      detectedByText || matchedSelectors.length > 0 || acceptButtons.length > 0 || rejectButtons.length > 0;
    const confidence = clamp(
      (detectedByText ? 0.3 : 0) +
        (matchedSelectors.length > 0 ? 0.45 : 0) +
        (acceptButtons.length > 0 ? 0.15 : 0) +
        (rejectButtons.length > 0 ? 0.1 : 0),
      0,
      1,
    );

    const preConsentCookiesRaw = await context.cookies();
    const preConsentCookies: CategorizedCookie[] = categorizeCookies(
      preConsentCookiesRaw.map((c) => ({
        name: c.name,
        domain: c.domain,
        path: c.path,
        value: c.value?.slice(0, 100), // Truncate for safety
        expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : undefined,
      }))
    ).slice(0, 80);

    // Summarize cookies by category
    const cookiesByCategory = summarizeCookiesByCategory(preConsentCookies);

    const frictionNotes: string[] = [];
    let acceptClicks: number | undefined;
    let rejectClicks: number | undefined;

    // Click-friction is tricky (many CMPs are multi-step). For v0:
    // - if we see a direct reject button, treat as 1 click
    // - if reject missing but there is a "preferences/settings" button, treat as 2 clicks (open prefs + find reject)
    if (acceptButtons.length > 0) acceptClicks = 1;
    if (rejectButtons.length > 0) rejectClicks = 1;
    else if (managePrefsButtons.length > 0 && acceptButtons.length > 0) {
      rejectClicks = 2;
      frictionNotes.push("No obvious ‘Reject all’ found; ‘Preferences/Settings’ present (likely 2+ step rejection)." );
    }

    if (!bannerDetected) {
      findings.push({
        id: "banner.missing",
        title: "No obvious consent banner detected",
        severity: "warn",
        detail:
          "Consent Compass didn’t find common CMP/banner patterns. This can be okay (no non-essential cookies), or it can mean the banner is hidden behind an interaction we didn’t trigger in v0.",
      });
    }

    if (acceptButtons.length > 0 && rejectButtons.length === 0) {
      findings.push({
        id: "choice.symmetry.reject_missing",
        title: "Reject / ‘Only necessary’ option not found on first layer",
        severity: managePrefsButtons.length > 0 ? "warn" : "fail",
        detail:
          managePrefsButtons.length > 0
            ? "We found an ‘accept’ action but no equally-visible ‘reject’ action on the first layer. A preferences/settings path exists, which often adds friction to rejecting."
            : "We found an obvious ‘accept’ action but no equally-visible ‘reject’ / ‘only necessary’ action. This is commonly considered non-symmetric choice design.",
        evidence: { kind: "text", value: `accept: ${acceptButtons.slice(0, 3).join(", ")}` },
      });
    }

    if (bannerDetected) {
      findings.push({
        id: "transparency.banner_detected",
        title: "Consent UI appears present",
        severity: "info",
        detail:
          "A consent interface was detected via text/selector heuristics. v0 also captures pre-consent cookies/requests and a rough click-friction estimate.",
      });
    }

    // Analyze pre-consent tracking
    const trackingAnalysis = hasPreConsentTracking(preConsentCookies);

    if (preConsentCookies.length > 0) {
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
            value: preConsentCookies.filter((c) => c.category === "unknown").slice(0, 6).map((c) => c.name).join(", "),
          },
        });
      }

      // Add info finding with cookie summary
      if (cookiesByCategory.necessary > 0 || cookiesByCategory.functional > 0) {
        findings.push({
          id: "preconsent.cookies.essential",
          title: "Essential cookies detected (acceptable)",
          severity: "info",
          category: "pre-consent",
          detail: `Found ${cookiesByCategory.necessary} necessary and ${cookiesByCategory.functional} functional cookies. These typically don't require consent.`,
        });
      }
    }

    // Check for Google Consent Mode v2
    const googleConsentMode = await page.evaluate(() => {
      const result: {
        detected: boolean;
        version?: "v1" | "v2";
        signals?: {
          ad_storage?: "granted" | "denied";
          analytics_storage?: "granted" | "denied";
          ad_user_data?: "granted" | "denied";
          ad_personalization?: "granted" | "denied";
        };
        issues: string[];
      } = { detected: false, issues: [] };

      // Check for dataLayer
      const dataLayer = (window as any).dataLayer;
      if (!dataLayer || !Array.isArray(dataLayer)) {
        return result;
      }

      // Look for consent commands in dataLayer
      for (const item of dataLayer) {
        if (item && typeof item === "object") {
          // Check for gtag consent command
          if (item[0] === "consent" && (item[1] === "default" || item[1] === "update")) {
            result.detected = true;
            const consentConfig = item[2];
            if (consentConfig && typeof consentConfig === "object") {
              result.signals = {
                ad_storage: consentConfig.ad_storage,
                analytics_storage: consentConfig.analytics_storage,
                ad_user_data: consentConfig.ad_user_data,
                ad_personalization: consentConfig.ad_personalization,
              };

              // Check for v2 signals (ad_user_data and ad_personalization are v2 specific)
              if (consentConfig.ad_user_data !== undefined || consentConfig.ad_personalization !== undefined) {
                result.version = "v2";
              } else {
                result.version = "v1";
              }
            }
          }

          // Also check gtm.consent format
          if (item["gtm.consent"]) {
            result.detected = true;
            const consent = item["gtm.consent"];
            result.signals = {
              ad_storage: consent.ad_storage,
              analytics_storage: consent.analytics_storage,
              ad_user_data: consent.ad_user_data,
              ad_personalization: consent.ad_personalization,
            };
            if (consent.ad_user_data !== undefined || consent.ad_personalization !== undefined) {
              result.version = "v2";
            }
          }
        }
      }

      // Validation
      if (result.detected && result.signals) {
        if (!result.signals.ad_storage) result.issues.push("Missing ad_storage signal");
        if (!result.signals.analytics_storage) result.issues.push("Missing analytics_storage signal");
        if (result.version === "v2") {
          if (!result.signals.ad_user_data) result.issues.push("Missing ad_user_data signal (required for GCM v2)");
          if (!result.signals.ad_personalization) result.issues.push("Missing ad_personalization signal (required for GCM v2)");
        }
      }

      return result;
    });

    // Add GCM findings
    if (googleConsentMode.detected) {
      if (googleConsentMode.version === "v2" && googleConsentMode.issues.length === 0) {
        findings.push({
          id: "gcm.v2.complete",
          title: "Google Consent Mode v2 detected and complete",
          severity: "info",
          category: "gcm",
          detail: "All required GCM v2 signals are present. This is good for Google Ads and Analytics compliance.",
        });
      } else if (googleConsentMode.version === "v2" && googleConsentMode.issues.length > 0) {
        findings.push({
          id: "gcm.v2.incomplete",
          title: "Google Consent Mode v2 detected but incomplete",
          severity: "warn",
          category: "gcm",
          detail: `GCM v2 is implemented but missing signals: ${googleConsentMode.issues.join(", ")}`,
          evidence: { kind: "text", value: googleConsentMode.issues.join("; ") },
        });
      } else if (googleConsentMode.version === "v1") {
        findings.push({
          id: "gcm.v1.detected",
          title: "Google Consent Mode v1 detected (upgrade recommended)",
          severity: "warn",
          category: "gcm",
          detail: "GCM v1 is implemented but v2 is now required for full Google Ads functionality. Consider upgrading to include ad_user_data and ad_personalization signals.",
        });
      }
    }

    // Artifact
    const safeHost = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const screenshotPath = `/tmp/consent-compass-${safeHost}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const score = scoreFromFindings(findings);

    return {
      status: "ok",
      url,
      scannedAt: new Date().toISOString(),
      score,
      banner: {
        detected: bannerDetected,
        confidence,
        selectors: matchedSelectors.slice(0, 10),
        acceptButtons: acceptButtons.slice(0, 10),
        rejectButtons: rejectButtons.slice(0, 10),
        managePrefsButtons: managePrefsButtons.slice(0, 10),
      },
      friction: {
        acceptClicks,
        rejectClicks,
        notes: frictionNotes,
      },
      preConsent: {
        cookies: preConsentCookies,
        requests: preConsentRequests.slice(0, 80),
        cookiesByCategory,
        trackerCount: preConsentRequests.filter((r) => r.isTracker).length,
      },
      googleConsentMode: googleConsentMode.detected ? googleConsentMode : undefined,
      artifacts: { screenshotPath },
      findings,
      meta: {
        userAgent: UA,
        tookMs: Date.now() - started,
        scannerVersion: SCANNER_VERSION,
      },
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
