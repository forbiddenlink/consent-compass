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
import {
  analyzeCognitiveFriction,
  calculateFrictionScore,
  generateFrictionFindings,
} from "@/lib/friction";
import {
  measureRejectionFlow,
  generateRejectionFindings,
  type RejectionStep,
} from "@/lib/rejection-flow";
import {
  analyzeGpc,
  generateGpcFindings,
} from "@/lib/gpc";
import {
  auditAccessibility,
  generateAccessibilityFindings,
  type AccessibilityResult,
} from "@/lib/accessibility";
import {
  analyzeCompliance,
  generateComplianceFindings,
  getGdprComplianceStatus,
  type ComplianceResult,
} from "@/lib/compliance";
import {
  saveScreenshot,
  annotateBanner,
  cleanupScreenshots,
  generateTimestamp,
  type BannerBounds,
} from "@/lib/screenshots";

const SCANNER_VERSION = "0.10.0"; // Added Multi-Regulation Compliance Scoring (Phase 5.1)

const UA =
  "ConsentCompass/0.1 (Playwright; +https://example.local) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";

export async function scanUrl(url: string): Promise<ScanResult> {
  const started = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    // Send GPC signal to indicate user opt-out preference
    extraHTTPHeaders: {
      "Sec-GPC": "1",
    },
  });
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

    // =========================================================================
    // SCREENSHOT STORAGE: Capture domain and timestamp for consistent naming
    // =========================================================================
    const domain = new URL(url).hostname;
    const screenshotTimestamp = generateTimestamp();

    // Capture pre-consent screenshot
    const preConsentBuffer = await page.screenshot({ fullPage: true });
    let preConsentScreenshotPath: string | undefined;
    try {
      preConsentScreenshotPath = await saveScreenshot(
        preConsentBuffer,
        domain,
        "pre-consent",
        screenshotTimestamp
      );
    } catch {
      // Screenshot storage failure shouldn't break the scan
    }

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
    let bannerBounds: BannerBounds | undefined;

    for (const sel of selectorCandidates) {
      try {
        const locator = page.locator(sel);
        const count = await locator.count();
        if (count > 0) {
          matchedSelectors.push(sel);
          // Capture bounds of first matched banner element for annotation
          if (!bannerBounds) {
            const firstEl = locator.first();
            const box = await firstEl.boundingBox().catch(() => null);
            if (box) {
              bannerBounds = {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              };
            }
          }
        }
      } catch {
        // ignore invalid selectors
      }
    }

    const acceptButtons: string[] = [];
    const rejectButtons: string[] = [];
    const managePrefsButtons: string[] = [];
    const buttonVisuals: ButtonVisualData[] = [];
    let firstManageButtonLocator: ReturnType<typeof page.locator> | null = null;

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
      if (classification === "manage") {
        managePrefsButtons.push(text.toLowerCase().slice(0, 80));
        // Store first visible manage button for rejection flow
        if (!firstManageButtonLocator) {
          const isVisible = await el.isVisible().catch(() => false);
          if (isVisible) firstManageButtonLocator = el;
        }
      }

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
    let rejectPath: RejectionStep[] = [];

    // Click-friction measurement
    if (acceptButtons.length > 0) acceptClicks = 1;

    if (rejectButtons.length > 0) {
      // Direct reject button on first layer
      rejectClicks = 1;
    } else if (managePrefsButtons.length > 0 && firstManageButtonLocator) {
      // No direct reject - measure actual rejection flow through preference layers
      try {
        const flowResult = await measureRejectionFlow(page, firstManageButtonLocator);
        rejectClicks = flowResult.totalClicks;
        rejectPath = flowResult.path;

        if (flowResult.success) {
          frictionNotes.push(
            `Rejection requires ${flowResult.totalClicks} clicks: ${flowResult.path.map((p) => p.target).join(" → ")}`
          );
        } else {
          frictionNotes.push(
            `Could not complete rejection flow: ${flowResult.error || "unknown error"}`
          );
        }

        // Generate rejection-specific findings
        const rejectionFindings = generateRejectionFindings(flowResult);
        findings.push(...rejectionFindings);

        // Re-navigate to original URL for post-consent comparison
        // (rejection flow may have modified page state)
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(1250);
      } catch (err) {
        // Fallback to estimate if rejection flow fails
        rejectClicks = 2;
        frictionNotes.push(
          "No obvious 'Reject all' found; 'Preferences/Settings' present (likely 2+ step rejection)."
        );
      }
    } else if (managePrefsButtons.length > 0) {
      // Has manage button but couldn't get locator - fallback to estimate
      rejectClicks = 2;
      frictionNotes.push(
        "No obvious 'Reject all' found; 'Preferences/Settings' present (likely 2+ step rejection)."
      );
    }

    // =========================================================================
    // VISUAL BUTTON ANALYSIS: Dark pattern detection
    // =========================================================================
    const visualAnalysis = analyzeButtonVisuals(buttonVisuals);
    const visualFindings = generateVisualFindings(visualAnalysis);
    findings.push(...visualFindings);

    // =========================================================================
    // FRICTION SCORING: Click, visual, and cognitive friction
    // =========================================================================
    // Extract banner text for cognitive analysis
    let bannerText = "";
    if (matchedSelectors.length > 0) {
      try {
        // Get text from first matched consent element
        const bannerEl = page.locator(matchedSelectors[0]).first();
        bannerText = await bannerEl.innerText().catch(() => "");
      } catch {
        // Fall back to checking common banner selectors
      }
    }

    // Analyze cognitive friction patterns
    const cognitiveResult = analyzeCognitiveFriction(bannerText);

    // Calculate overall friction score
    const frictionScore = calculateFrictionScore(
      acceptClicks,
      rejectClicks,
      visualAnalysis.asymmetryScore,
      cognitiveResult
    );

    // Generate friction findings
    const frictionFindings = generateFrictionFindings(frictionScore, cognitiveResult);
    findings.push(...frictionFindings);

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

    let postConsentScreenshotPath: string | undefined;

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

          // Capture post-consent screenshot
          try {
            const postConsentBuffer = await page.screenshot({ fullPage: true });
            postConsentScreenshotPath = await saveScreenshot(
              postConsentBuffer,
              domain,
              "post-consent",
              screenshotTimestamp
            );
          } catch {
            // Screenshot storage failure shouldn't break the scan
          }

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

    // =========================================================================
    // GLOBAL PRIVACY CONTROL (GPC) DETECTION
    // =========================================================================
    const trackerCount = preConsentRequests.filter((r) => r.isTracker).length;
    const gpcResult = await analyzeGpc(page, {
      preConsentTrackerCount: trackerCount,
      googleConsentMode: googleConsentMode.detected
        ? {
            detected: true,
            signals: googleConsentMode.signals,
          }
        : { detected: false },
    });

    // Add GPC findings
    const gpcFindings = generateGpcFindings(gpcResult);
    findings.push(...gpcFindings);

    // =========================================================================
    // ACCESSIBILITY AUDIT (Phase 5.3)
    // =========================================================================
    let accessibilityResult: AccessibilityResult | undefined;
    if (bannerDetected && matchedSelectors.length > 0) {
      try {
        // Use the first matched selector for accessibility audit
        accessibilityResult = await auditAccessibility(page, matchedSelectors[0]);

        // Add accessibility findings
        const a11yFindings = generateAccessibilityFindings(accessibilityResult);
        findings.push(...a11yFindings);
      } catch (err) {
        // Log error but don't fail the scan
        findings.push({
          id: "a11y.audit.error",
          title: "Accessibility audit failed",
          severity: "info",
          category: "accessibility",
          detail: `Could not complete accessibility audit: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    }

    // =========================================================================
    // MULTI-REGULATION COMPLIANCE ANALYSIS (Phase 5.1)
    // =========================================================================
    // Build partial scan result for compliance analysis
    const partialScanResult = {
      status: "ok" as const,
      url,
      scannedAt: new Date().toISOString(),
      score: { overall: 0, choiceSymmetry: 0, preConsentSignals: 0, accessibility: 0, transparency: 0 },
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
        overallScore: frictionScore.overall,
        asymmetryScore: visualAnalysis.asymmetryScore,
        acceptPath: [] as string[],
        rejectPath: rejectPath.map(step => `${step.action}: ${step.target}`),
        notes: frictionNotes,
      },
      preConsent: {
        cookies: preConsentCookies,
        requests: preConsentRequests.slice(0, 80),
        cookiesByCategory,
        trackerCount: preConsentRequests.filter((r) => r.isTracker).length,
      },
      darkPatterns: visualAnalysis.asymmetryScore > 0 ? {
        visualAsymmetry: visualAnalysis.asymmetryScore,
        sizeRatio: visualAnalysis.sizeRatio,
        issues: visualAnalysis.issues,
      } : undefined,
      gpcSupport: {
        detected: gpcResult.detected,
        honored: gpcResult.honored,
      },
      artifacts: {},
      findings: [] as typeof findings,
      meta: { userAgent: UA, tookMs: 0, scannerVersion: SCANNER_VERSION },
    };

    const complianceResult: ComplianceResult = analyzeCompliance(partialScanResult);

    // Generate compliance findings
    const complianceFindings = generateComplianceFindings(complianceResult);
    findings.push(...complianceFindings);

    // =========================================================================
    // SCREENSHOT ARTIFACTS: Create banner-highlighted screenshot and store paths
    // =========================================================================
    // Legacy artifact: Keep /tmp screenshot for backward compatibility
    const safeHost = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const screenshotPath = `/tmp/consent-compass-${safeHost}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Create banner-highlighted screenshot if banner was detected
    let bannerHighlightScreenshotPath: string | undefined;
    if (bannerDetected && bannerBounds && preConsentBuffer) {
      try {
        const annotatedBuffer = await annotateBanner(preConsentBuffer, bannerBounds);
        bannerHighlightScreenshotPath = await saveScreenshot(
          annotatedBuffer,
          domain,
          "banner",
          screenshotTimestamp
        );
      } catch {
        // Annotation failure shouldn't break the scan
      }
    }

    // Clean up old screenshots (keep last 10 sets per domain)
    try {
      await cleanupScreenshots(domain, 10);
    } catch {
      // Cleanup failure is non-critical
    }

    const baseScore = scoreFromFindings(findings);

    // Build final score with GDPR compliance status
    const score = {
      ...baseScore,
      gdprCompliance: getGdprComplianceStatus(complianceResult),
    };

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
      accessibility: accessibilityResult,
      compliance: {
        gdpr: {
          score: complianceResult.gdpr.score,
          status: complianceResult.gdpr.status,
          checks: complianceResult.gdpr.checks.map(c => ({
            id: c.id,
            name: c.name,
            passed: c.passed,
            required: c.required,
            details: c.details,
          })),
        },
        ccpa: {
          score: complianceResult.ccpa.score,
          status: complianceResult.ccpa.status,
          checks: complianceResult.ccpa.checks.map(c => ({
            id: c.id,
            name: c.name,
            passed: c.passed,
            required: c.required,
            details: c.details,
          })),
        },
        eprivacy: {
          score: complianceResult.eprivacy.score,
          status: complianceResult.eprivacy.status,
          checks: complianceResult.eprivacy.checks.map(c => ({
            id: c.id,
            name: c.name,
            passed: c.passed,
            required: c.required,
            details: c.details,
          })),
        },
        overallStatus: complianceResult.overallStatus,
      },
      friction: {
        acceptClicks,
        rejectClicks,
        overallScore: frictionScore.overall,
        clickAsymmetry: frictionScore.clickAsymmetry,
        cognitiveScore: frictionScore.cognitive,
        cognitivePatterns: cognitiveResult.patterns.map(p => p.type),
        asymmetryScore: visualAnalysis.asymmetryScore,
        acceptPath: [],
        rejectPath: rejectPath.map(step => `${step.action}: ${step.target}`),
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
      gpcSupport: {
        detected: gpcResult.detected,
        honored: gpcResult.honored,
      },
      artifacts: {
        screenshotPath, // Legacy /tmp path for backward compatibility
        preConsentScreenshot: preConsentScreenshotPath,
        postConsentScreenshot: postConsentScreenshotPath,
        bannerHighlightScreenshot: bannerHighlightScreenshotPath,
      },
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
