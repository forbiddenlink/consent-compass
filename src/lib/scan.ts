import { chromium } from "playwright";
import type { ScanResult, ConsentFinding, CategorizedCookie, TrackedRequest } from "@/lib/types";
import { categorizeCookies, summarizeCookiesByCategory, hasPreConsentTracking } from "@/lib/cookies";
import {
  BANNER_HINTS,
  clamp,
  scoreFromFindings,
  classifyButtonText,
  compareCookies,
  generatePostConsentFindings,
  analyzeButtonVisuals,
  generateVisualFindings,
  type ButtonVisualData,
} from "@/lib/heuristics";
import { classifyTrackerDomain } from "@/lib/trackers";

const SCANNER_VERSION = "0.5.0"; // Added WhoTracksMe tracker classification

const UA =
  "ConsentCompass/0.1 (Playwright; +https://example.local) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";

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

    // Classify domain using WhoTracksMe database
    const trackerInfo = classifyTrackerDomain(domain);

    preConsentRequests.push({
      url: reqUrl,
      resourceType: req.resourceType(),
      domain,
      isTracker: trackerInfo !== null,
      trackerCategory: trackerInfo?.category,
      vendor: trackerInfo?.tracker,
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
    const buttonVisuals: ButtonVisualData[] = [];

    // Search visible-ish buttons/links by their text.
    const clickable = page.locator("button, [role='button'], a");
    const clickableCount = await clickable.count();
    for (let i = 0; i < Math.min(clickableCount, 220); i++) {
      const el = clickable.nth(i);
      const text = (await el.innerText().catch(() => "")).trim();
      if (!text) continue;

      const classification = classifyButtonText(text);
      if (classification === "accept") acceptButtons.push(text.toLowerCase().slice(0, 80));
      if (classification === "reject") rejectButtons.push(text.toLowerCase().slice(0, 80));
      if (classification === "manage") managePrefsButtons.push(text.toLowerCase().slice(0, 80));

      // Capture visual data for accept and reject buttons (first of each type)
      if (
        (classification === "accept" || classification === "reject") &&
        !buttonVisuals.some((b) => b.role === classification)
      ) {
        try {
          const isVisible = await el.isVisible().catch(() => false);
          if (isVisible) {
            const box = await el.boundingBox();
            const styles = await el.evaluate((node) => {
              const computed = window.getComputedStyle(node);
              return {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
              };
            });
            if (box) {
              buttonVisuals.push({
                text: text.slice(0, 80),
                role: classification,
                width: Math.round(box.width),
                height: Math.round(box.height),
                backgroundColor: styles.backgroundColor,
                textColor: styles.color,
              });
            }
          }
        } catch {
          // Ignore visual capture errors
        }
      }

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
      frictionNotes.push("No obvious 'Reject all' found; 'Preferences/Settings' present (likely 2+ step rejection)." );
    }

    // =========================================================================
    // VISUAL BUTTON ANALYSIS: Dark pattern detection
    // =========================================================================
    const visualAnalysis = analyzeButtonVisuals(buttonVisuals);
    const visualFindings = generateVisualFindings(visualAnalysis);
    findings.push(...visualFindings);

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

    // =========================================================================
    // PRE-CONSENT TRACKER DETECTION
    // =========================================================================
    const trackerRequests = preConsentRequests.filter((r) => r.isTracker);
    if (trackerRequests.length > 0) {
      // Group by category for reporting
      const byCategory: Record<string, TrackedRequest[]> = {};
      for (const req of trackerRequests) {
        const cat = req.trackerCategory || "unknown";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(req);
      }

      // Advertising trackers are the most severe
      const hasAdTrackers = (byCategory.advertising?.length ?? 0) > 0;
      const uniqueTrackers = [...new Set(trackerRequests.map((r) => r.vendor).filter(Boolean))];

      findings.push({
        id: "preconsent.trackers.detected",
        title: `${trackerRequests.length} tracker request(s) detected before consent`,
        severity: hasAdTrackers ? "fail" : "warn",
        category: "pre-consent",
        detail: hasAdTrackers
          ? `Advertising trackers were contacted before any user consent. This is a potential GDPR violation.`
          : `Tracker requests were made before consent. Categories: ${Object.keys(byCategory).join(", ")}.`,
        evidence: {
          kind: "request",
          value: uniqueTrackers.slice(0, 6).join(", ") || trackerRequests.slice(0, 3).map((r) => r.domain).join(", "),
        },
      });
    }

    // =========================================================================
    // POST-CONSENT COMPARISON: Click accept and capture delta
    // =========================================================================
    let postConsentData:
      | {
          cookies: CategorizedCookie[];
          cookiesByCategory: ReturnType<typeof summarizeCookiesByCategory>;
          newCookies: CategorizedCookie[];
          persistedCookies: CategorizedCookie[];
          acceptClicked: boolean;
          clickError?: string;
        }
      | undefined;

    if (acceptButtons.length > 0) {
      try {
        // Find the first clickable accept button
        const clickable = page.locator("button, [role='button'], a");
        const clickableCount = await clickable.count();
        let clicked = false;

        for (let i = 0; i < Math.min(clickableCount, 220) && !clicked; i++) {
          const el = clickable.nth(i);
          const text = (await el.innerText().catch(() => "")).trim();
          if (classifyButtonText(text) === "accept") {
            // Check if element is visible and clickable
            const isVisible = await el.isVisible().catch(() => false);
            if (isVisible) {
              await el.click({ timeout: 5000 });
              clicked = true;
            }
          }
        }

        if (clicked) {
          // Wait for cookies to be set after consent
          await page.waitForTimeout(2000);

          // Capture post-consent cookies
          const postConsentCookiesRaw = await context.cookies();
          const postConsentCookies: CategorizedCookie[] = categorizeCookies(
            postConsentCookiesRaw.map((c) => ({
              name: c.name,
              domain: c.domain,
              path: c.path,
              value: c.value?.slice(0, 100),
              expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : undefined,
            }))
          ).slice(0, 80);

          // Compare pre vs post consent
          const comparison = compareCookies(preConsentCookies, postConsentCookies);
          const postCookiesByCategory = summarizeCookiesByCategory(postConsentCookies);

          postConsentData = {
            cookies: postConsentCookies,
            cookiesByCategory: postCookiesByCategory,
            newCookies: comparison.newCookies,
            persistedCookies: comparison.persistedCookies,
            acceptClicked: true,
          };

          // Generate violation findings from comparison
          const postConsentFindings = generatePostConsentFindings(comparison);
          findings.push(...postConsentFindings);
        } else {
          postConsentData = {
            cookies: [],
            cookiesByCategory: { necessary: 0, functional: 0, analytics: 0, marketing: 0, unknown: 0 },
            newCookies: [],
            persistedCookies: [],
            acceptClicked: false,
            clickError: "Could not find visible accept button to click",
          };
        }
      } catch (err) {
        postConsentData = {
          cookies: [],
          cookiesByCategory: { necessary: 0, functional: 0, analytics: 0, marketing: 0, unknown: 0 },
          newCookies: [],
          persistedCookies: [],
          acceptClicked: false,
          clickError: err instanceof Error ? err.message : "Unknown error clicking accept",
        };
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        buttons: buttonVisuals.length > 0 ? buttonVisuals.map((b) => ({
          text: b.text,
          selector: "", // Not captured yet
          role: b.role,
          width: b.width,
          height: b.height,
          backgroundColor: b.backgroundColor,
          textColor: b.textColor,
          contrastRatio: visualAnalysis.acceptButton?.role === b.role
            ? visualAnalysis.acceptButton.contrastRatio
            : visualAnalysis.rejectButton?.role === b.role
              ? visualAnalysis.rejectButton.contrastRatio
              : undefined,
          isProminent: b.role === "accept" && (visualAnalysis.sizeRatio ?? 0) > 1.5 ? true : undefined,
        })) : undefined,
      },
      darkPatterns: visualAnalysis.asymmetryScore > 0 ? {
        visualAsymmetry: visualAnalysis.asymmetryScore,
        sizeRatio: visualAnalysis.sizeRatio,
        contrastDifference: visualAnalysis.contrastDifference,
        issues: visualAnalysis.issues,
      } : undefined,
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
      postConsent: postConsentData,
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
