import { chromium } from "playwright";
import type { ScanResult, ConsentFinding } from "@/lib/types";

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
const REJECT_HINTS = ["reject", "decline", "deny", "disallow", "no thanks", "only necessary"];

export async function scanUrl(url: string): Promise<ScanResult> {
  const started = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

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

    // Search visible buttons/links by their text.
    const clickable = page.locator("button, [role='button'], a");
    const clickableCount = await clickable.count();
    for (let i = 0; i < Math.min(clickableCount, 200); i++) {
      const el = clickable.nth(i);
      const text = (await el.innerText().catch(() => "")).trim().toLowerCase();
      if (!text) continue;

      const isAccept = ACCEPT_HINTS.some((h) => text === h || text.includes(h));
      const isReject = REJECT_HINTS.some((h) => text === h || text.includes(h));

      if (isAccept) acceptButtons.push(text.slice(0, 80));
      if (isReject) rejectButtons.push(text.slice(0, 80));

      if (acceptButtons.length > 10 && rejectButtons.length > 10) break;
    }

    const findings: ConsentFinding[] = [];

    const bannerDetected = detectedByText || matchedSelectors.length > 0 || acceptButtons.length > 0;
    const confidence = clamp(
      (detectedByText ? 0.35 : 0) +
        (matchedSelectors.length > 0 ? 0.45 : 0) +
        (acceptButtons.length > 0 ? 0.2 : 0),
      0,
      1,
    );

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
        title: "Reject / ‘Only necessary’ option not found",
        severity: "fail",
        detail:
          "We found an obvious ‘accept’ action but no equally-visible ‘reject’ / ‘only necessary’ action. This is commonly considered non-symmetric choice design.",
        evidence: { kind: "text", value: `accept: ${acceptButtons.slice(0, 3).join(", ")}` },
      });
    }

    if (bannerDetected) {
      findings.push({
        id: "transparency.banner_detected",
        title: "Consent UI appears present",
        severity: "info",
        detail:
          "A consent interface was detected via text/selector heuristics. Next iterations will validate actual pre-consent tracking and click-friction measurements.",
      });
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
      },
      artifacts: { screenshotPath },
      findings,
      meta: {
        userAgent: UA,
        tookMs: Date.now() - started,
      },
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
