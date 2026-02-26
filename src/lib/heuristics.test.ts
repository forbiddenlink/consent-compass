import { describe, it, expect } from "vitest";
import {
  // Constants
  BANNER_HINTS,
  ACCEPT_HINTS,
  REJECT_HINTS,
  MANAGE_HINTS,
  BANNER_SELECTORS,
  // Functions
  clamp,
  scoreFromFindings,
  detectBannerByText,
  classifyButtonText,
  calculateBannerConfidence,
  estimateFriction,
  generateBannerFindings,
  generateCookieFindings,
  generateGCMFindings,
} from "./heuristics";
import type { ConsentFinding, CategorizedCookie } from "./types";

// ============================================================================
// HTML Fixtures - Inline for maintainability
// ============================================================================

const FIXTURES = {
  // OneTrust CMP with symmetric choices
  onetrust: `
    <!DOCTYPE html>
    <html>
    <body>
      <div id="onetrust-banner-sdk" class="onetrust-consent-banner">
        <p>We use cookies to improve your experience. By continuing to use this site, you agree to our cookie policy.</p>
        <div class="ot-sdk-row">
          <button id="onetrust-accept-btn-handler">Accept All Cookies</button>
          <button id="onetrust-reject-all-handler">Reject All</button>
          <button id="onetrust-pc-btn-handler">Cookie Settings</button>
        </div>
      </div>
    </body>
    </html>
  `,

  // Cookiebot CMP
  cookiebot: `
    <!DOCTYPE html>
    <html>
    <body>
      <div id="CybotCookiebotDialog" class="CybotCookiebotDialogActive">
        <h2>This website uses cookies</h2>
        <p>We use cookies to personalise content and ads, to provide social media features and to analyse our traffic.</p>
        <button id="CybotCookiebotDialogBodyLevelButtonAccept">Allow all cookies</button>
        <button id="CybotCookiebotDialogBodyButtonDecline">Decline</button>
        <a href="#" id="CybotCookiebotDialogBodyLevelButtonPreferences">Customize</a>
      </div>
    </body>
    </html>
  `,

  // Asymmetric pattern - accept prominent, reject hidden
  asymmetric: `
    <!DOCTYPE html>
    <html>
    <body>
      <div class="cookie-consent-banner">
        <p>We value your privacy. Please accept cookies to continue.</p>
        <button class="btn-primary">Accept All</button>
        <a href="#" class="link-secondary">Manage Preferences</a>
      </div>
    </body>
    </html>
  `,

  // No reject or manage - worst case
  acceptOnly: `
    <!DOCTYPE html>
    <html>
    <body>
      <div id="cookie-banner">
        <p>This site uses cookies for analytics.</p>
        <button>Got it</button>
      </div>
    </body>
    </html>
  `,

  // Text-only detection (no selectors match)
  textOnly: `
    <!DOCTYPE html>
    <html>
    <body>
      <div class="modal">
        <p>We use cookies for analytics and marketing purposes. By continuing, you accept our privacy policy.</p>
        <button>OK</button>
      </div>
    </body>
    </html>
  `,

  // No banner at all
  noBanner: `
    <!DOCTYPE html>
    <html>
    <body>
      <header><h1>Welcome to our site</h1></header>
      <main><p>Regular content here.</p></main>
    </body>
    </html>
  `,

  // GDPR-specific language
  gdprExplicit: `
    <!DOCTYPE html>
    <html>
    <body>
      <div id="gdpr-consent-modal" aria-label="Cookie consent dialog">
        <h2>Your privacy choices</h2>
        <p>Under GDPR, you have the right to control your data.</p>
        <button>Accept</button>
        <button>Only Necessary</button>
        <button>More Options</button>
      </div>
    </body>
    </html>
  `,

  // Multilingual (German)
  german: `
    <!DOCTYPE html>
    <html lang="de">
    <body>
      <div class="cookie-hinweis">
        <p>Wir verwenden Cookies, um Ihnen das beste Erlebnis zu bieten.</p>
        <button>Alle akzeptieren</button>
        <button>Nur notwendige</button>
      </div>
    </body>
    </html>
  `,

  // Shadow DOM hint (aria-label based)
  ariaLabel: `
    <!DOCTYPE html>
    <html>
    <body>
      <div aria-label="Cookie consent notice" role="dialog">
        <p>Please accept our cookie policy.</p>
        <button role="button" aria-label="Accept cookies">Accept</button>
        <button role="button" aria-label="Decline cookies">Decline</button>
      </div>
    </body>
    </html>
  `,
};

// ============================================================================
// Test: clamp()
// ============================================================================

describe("clamp", () => {
  it("returns value when within bounds", () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });

  it("clamps to minimum when below", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(-1, 0, 100)).toBe(0);
  });

  it("clamps to maximum when above", () => {
    expect(clamp(110, 0, 100)).toBe(100);
    expect(clamp(200, 0, 100)).toBe(100);
  });

  it("works with decimal values", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-0.1, 0, 1)).toBe(0);
    expect(clamp(1.5, 0, 1)).toBe(1);
  });

  it("works with negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

// ============================================================================
// Test: scoreFromFindings()
// ============================================================================

describe("scoreFromFindings", () => {
  it("returns base scores when no findings", () => {
    const score = scoreFromFindings([]);
    expect(score.choiceSymmetry).toBe(80);
    expect(score.preConsentSignals).toBe(80);
    expect(score.accessibility).toBe(80);
    expect(score.transparency).toBe(80);
    expect(score.overall).toBe(80);
  });

  it("deducts 35 points for symmetry fail", () => {
    const findings: ConsentFinding[] = [
      { id: "choice.symmetry.reject_missing", title: "Test", severity: "fail", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.choiceSymmetry).toBe(45);
    expect(score.overall).toBe(71); // (45+80+80+80)/4 = 71.25 rounded
  });

  it("deducts 35 points for preconsent fail", () => {
    const findings: ConsentFinding[] = [
      { id: "preconsent.tracking.detected", title: "Test", severity: "fail", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.preConsentSignals).toBe(45);
  });

  it("deducts 35 points for a11y fail", () => {
    const findings: ConsentFinding[] = [
      { id: "a11y.focus_trap", title: "Test", severity: "fail", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.accessibility).toBe(45);
  });

  it("deducts 25 points for transparency fail (other)", () => {
    const findings: ConsentFinding[] = [
      { id: "transparency.unclear", title: "Test", severity: "fail", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.transparency).toBe(55);
  });

  it("deducts 15 points for symmetry warn", () => {
    const findings: ConsentFinding[] = [
      { id: "choice.symmetry.reject_missing", title: "Test", severity: "warn", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.choiceSymmetry).toBe(65);
  });

  it("deducts 10 points for transparency warn (other)", () => {
    const findings: ConsentFinding[] = [
      { id: "banner.missing", title: "Test", severity: "warn", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.transparency).toBe(70);
  });

  it("ignores info severity findings", () => {
    const findings: ConsentFinding[] = [
      { id: "transparency.banner_detected", title: "Test", severity: "info", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score).toEqual({
      choiceSymmetry: 80,
      preConsentSignals: 80,
      accessibility: 80,
      transparency: 80,
      overall: 80,
    });
  });

  it("accumulates multiple deductions", () => {
    const findings: ConsentFinding[] = [
      { id: "choice.symmetry.reject_missing", title: "Test", severity: "fail", detail: "" },
      { id: "preconsent.tracking.detected", title: "Test", severity: "fail", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.choiceSymmetry).toBe(45);
    expect(score.preConsentSignals).toBe(45);
    expect(score.overall).toBe(63); // (45+45+80+80)/4 = 62.5 rounded
  });

  it("clamps scores to minimum of 0", () => {
    const findings: ConsentFinding[] = [
      { id: "choice.symmetry.fail1", title: "Test", severity: "fail", detail: "" },
      { id: "choice.symmetry.fail2", title: "Test", severity: "fail", detail: "" },
      { id: "choice.symmetry.fail3", title: "Test", severity: "fail", detail: "" },
    ];
    const score = scoreFromFindings(findings);
    expect(score.choiceSymmetry).toBe(0); // 80 - 35 - 35 - 35 = -25 clamped to 0
  });
});

// ============================================================================
// Test: detectBannerByText()
// ============================================================================

describe("detectBannerByText", () => {
  it("detects cookie keyword", () => {
    expect(detectBannerByText(FIXTURES.onetrust)).toBe(true);
    expect(detectBannerByText(FIXTURES.textOnly)).toBe(true);
  });

  it("detects consent keyword", () => {
    expect(detectBannerByText('<div>Please give your consent</div>')).toBe(true);
  });

  it("detects gdpr keyword", () => {
    expect(detectBannerByText(FIXTURES.gdprExplicit)).toBe(true);
  });

  it("detects privacy keyword", () => {
    expect(detectBannerByText('<div>Privacy settings</div>')).toBe(true);
  });

  it("detects preferences keyword", () => {
    expect(detectBannerByText('<div>Cookie preferences</div>')).toBe(true);
  });

  it("detects 'your choices' phrase", () => {
    expect(detectBannerByText(FIXTURES.gdprExplicit)).toBe(true);
  });

  it("is case insensitive", () => {
    expect(detectBannerByText('<div>COOKIE POLICY</div>')).toBe(true);
    expect(detectBannerByText('<div>GdPr CoMpLiAnCe</div>')).toBe(true);
  });

  it("returns false when no hints present", () => {
    expect(detectBannerByText(FIXTURES.noBanner)).toBe(false);
    expect(detectBannerByText('<html><body>Hello World</body></html>')).toBe(false);
  });

  it("detects hints in attributes (class/id)", () => {
    expect(detectBannerByText('<div class="cookie-banner">Hi</div>')).toBe(true);
    expect(detectBannerByText('<div id="consent-modal">Hi</div>')).toBe(true);
  });
});

// ============================================================================
// Test: classifyButtonText()
// ============================================================================

describe("classifyButtonText", () => {
  describe("accept buttons", () => {
    it.each([
      ["Accept", "accept"],
      ["Accept All", "accept"],
      ["Accept all cookies", "accept"],
      ["Allow All", "accept"],
      ["Allow all", "accept"],
      ["I Agree", "accept"],
      ["agree", "accept"],
      ["OK", "accept"],
      ["ok", "accept"],
      ["Got it", "accept"],
      ["GOT IT", "accept"],
    ])('classifies "%s" as accept', (text, expected) => {
      expect(classifyButtonText(text)).toBe(expected);
    });
  });

  describe("reject buttons", () => {
    it.each([
      ["Reject", "reject"],
      ["Reject All", "reject"],
      ["Decline", "reject"],
      ["Deny", "reject"],
      ["Disallow", "reject"],
      ["No thanks", "reject"],
      ["NO THANKS", "reject"],
      ["Only necessary", "reject"],
      ["Necessary only", "reject"],
      ["Only Necessary Cookies", "reject"],
    ])('classifies "%s" as reject', (text, expected) => {
      expect(classifyButtonText(text)).toBe(expected);
    });
  });

  describe("manage buttons", () => {
    it.each([
      ["Preferences", "manage"],
      ["Cookie Preferences", "manage"],
      ["Manage", "manage"],
      ["Manage Cookies", "manage"],
      ["Settings", "manage"],
      ["Cookie Settings", "manage"],
      ["Customize", "manage"],
      ["Choices", "manage"],
      ["More Options", "manage"],
      ["MORE OPTIONS", "manage"],
    ])('classifies "%s" as manage', (text, expected) => {
      expect(classifyButtonText(text)).toBe(expected);
    });
  });

  describe("unclassified", () => {
    it.each([
      ["Learn More", null],
      ["Privacy Policy", null],
      ["Close", null],
      ["X", null],
      ["", null],
      ["   ", null],
      ["Continue Shopping", null],
      ["Submit", null],
    ])('classifies "%s" as null', (text, expected) => {
      expect(classifyButtonText(text)).toBe(expected);
    });
  });

  it("handles whitespace", () => {
    expect(classifyButtonText("  Accept  ")).toBe("accept");
    expect(classifyButtonText("\tReject\n")).toBe("reject");
  });
});

// ============================================================================
// Test: calculateBannerConfidence()
// ============================================================================

describe("calculateBannerConfidence", () => {
  it("returns 0 when no signals detected", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: false,
      matchedSelectors: [],
      acceptButtons: [],
      rejectButtons: [],
    });
    expect(confidence).toBe(0);
  });

  it("adds 0.3 for text detection", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: true,
      matchedSelectors: [],
      acceptButtons: [],
      rejectButtons: [],
    });
    expect(confidence).toBe(0.3);
  });

  it("adds 0.45 for matched selectors", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: false,
      matchedSelectors: ["#cookie-banner"],
      acceptButtons: [],
      rejectButtons: [],
    });
    expect(confidence).toBe(0.45);
  });

  it("adds 0.15 for accept buttons", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: false,
      matchedSelectors: [],
      acceptButtons: ["Accept"],
      rejectButtons: [],
    });
    expect(confidence).toBe(0.15);
  });

  it("adds 0.1 for reject buttons", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: false,
      matchedSelectors: [],
      acceptButtons: [],
      rejectButtons: ["Reject"],
    });
    expect(confidence).toBe(0.1);
  });

  it("returns 1.0 for all signals (clamped)", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: true,
      matchedSelectors: ["#cookie-banner"],
      acceptButtons: ["Accept"],
      rejectButtons: ["Reject"],
    });
    expect(confidence).toBe(1.0); // 0.3 + 0.45 + 0.15 + 0.1 = 1.0
  });

  it("clamps to 1.0 even with multiple selectors", () => {
    const confidence = calculateBannerConfidence({
      detectedByText: true,
      matchedSelectors: ["#cookie-banner", "[id*='cookie']", "[class*='consent']"],
      acceptButtons: ["Accept", "Allow All"],
      rejectButtons: ["Reject"],
    });
    expect(confidence).toBe(1.0);
  });
});

// ============================================================================
// Test: estimateFriction()
// ============================================================================

describe("estimateFriction", () => {
  it("returns undefined clicks when no buttons", () => {
    const result = estimateFriction({
      acceptButtons: [],
      rejectButtons: [],
      managePrefsButtons: [],
    });
    expect(result.acceptClicks).toBeUndefined();
    expect(result.rejectClicks).toBeUndefined();
    expect(result.notes).toEqual([]);
  });

  it("returns 1 accept click when accept button present", () => {
    const result = estimateFriction({
      acceptButtons: ["Accept"],
      rejectButtons: [],
      managePrefsButtons: [],
    });
    expect(result.acceptClicks).toBe(1);
    expect(result.rejectClicks).toBeUndefined();
  });

  it("returns 1 reject click when reject button present", () => {
    const result = estimateFriction({
      acceptButtons: ["Accept"],
      rejectButtons: ["Reject"],
      managePrefsButtons: [],
    });
    expect(result.acceptClicks).toBe(1);
    expect(result.rejectClicks).toBe(1);
    expect(result.notes).toEqual([]);
  });

  it("returns 2 reject clicks when only manage present", () => {
    const result = estimateFriction({
      acceptButtons: ["Accept"],
      rejectButtons: [],
      managePrefsButtons: ["Preferences"],
    });
    expect(result.acceptClicks).toBe(1);
    expect(result.rejectClicks).toBe(2);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toContain("2+ step rejection");
  });

  it("does not estimate reject clicks if no accept button", () => {
    const result = estimateFriction({
      acceptButtons: [],
      rejectButtons: [],
      managePrefsButtons: ["Preferences"],
    });
    expect(result.acceptClicks).toBeUndefined();
    expect(result.rejectClicks).toBeUndefined();
  });

  it("prefers direct reject over manage path", () => {
    const result = estimateFriction({
      acceptButtons: ["Accept"],
      rejectButtons: ["Reject All"],
      managePrefsButtons: ["Preferences"],
    });
    expect(result.rejectClicks).toBe(1);
    expect(result.notes).toEqual([]);
  });
});

// ============================================================================
// Test: generateBannerFindings()
// ============================================================================

describe("generateBannerFindings", () => {
  describe("banner.missing", () => {
    it("generates warning when no banner detected", () => {
      const findings = generateBannerFindings({
        bannerDetected: false,
        acceptButtons: [],
        rejectButtons: [],
        managePrefsButtons: [],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe("banner.missing");
      expect(findings[0].severity).toBe("warn");
    });

    it("does not generate when banner detected", () => {
      const findings = generateBannerFindings({
        bannerDetected: true,
        acceptButtons: ["Accept"],
        rejectButtons: ["Reject"],
        managePrefsButtons: [],
      });
      const missing = findings.find((f) => f.id === "banner.missing");
      expect(missing).toBeUndefined();
    });
  });

  describe("choice.symmetry.reject_missing", () => {
    it("generates fail when accept but no reject or manage", () => {
      const findings = generateBannerFindings({
        bannerDetected: true,
        acceptButtons: ["Accept All"],
        rejectButtons: [],
        managePrefsButtons: [],
      });
      const symmetry = findings.find((f) => f.id === "choice.symmetry.reject_missing");
      expect(symmetry).toBeDefined();
      expect(symmetry!.severity).toBe("fail");
      expect(symmetry!.evidence?.value).toContain("Accept All");
    });

    it("generates warn when accept and manage but no reject", () => {
      const findings = generateBannerFindings({
        bannerDetected: true,
        acceptButtons: ["Accept All"],
        rejectButtons: [],
        managePrefsButtons: ["Preferences"],
      });
      const symmetry = findings.find((f) => f.id === "choice.symmetry.reject_missing");
      expect(symmetry).toBeDefined();
      expect(symmetry!.severity).toBe("warn");
    });

    it("does not generate when reject present", () => {
      const findings = generateBannerFindings({
        bannerDetected: true,
        acceptButtons: ["Accept All"],
        rejectButtons: ["Reject All"],
        managePrefsButtons: [],
      });
      const symmetry = findings.find((f) => f.id === "choice.symmetry.reject_missing");
      expect(symmetry).toBeUndefined();
    });

    it("does not generate when no accept buttons", () => {
      const findings = generateBannerFindings({
        bannerDetected: true,
        acceptButtons: [],
        rejectButtons: [],
        managePrefsButtons: [],
      });
      const symmetry = findings.find((f) => f.id === "choice.symmetry.reject_missing");
      expect(symmetry).toBeUndefined();
    });
  });

  describe("transparency.banner_detected", () => {
    it("generates info when banner detected", () => {
      const findings = generateBannerFindings({
        bannerDetected: true,
        acceptButtons: [],
        rejectButtons: [],
        managePrefsButtons: [],
      });
      const detected = findings.find((f) => f.id === "transparency.banner_detected");
      expect(detected).toBeDefined();
      expect(detected!.severity).toBe("info");
    });

    it("does not generate when no banner", () => {
      const findings = generateBannerFindings({
        bannerDetected: false,
        acceptButtons: [],
        rejectButtons: [],
        managePrefsButtons: [],
      });
      const detected = findings.find((f) => f.id === "transparency.banner_detected");
      expect(detected).toBeUndefined();
    });
  });
});

// ============================================================================
// Test: generateCookieFindings()
// ============================================================================

describe("generateCookieFindings", () => {
  it("returns empty array when no cookies", () => {
    expect(generateCookieFindings([])).toEqual([]);
  });

  it("generates fail finding for marketing cookies", () => {
    const cookies: CategorizedCookie[] = [
      { name: "_fbp", category: "marketing", vendor: "Facebook" },
    ];
    const findings = generateCookieFindings(cookies);
    const tracking = findings.find((f) => f.id === "preconsent.tracking.detected");
    expect(tracking).toBeDefined();
    expect(tracking!.severity).toBe("fail");
    expect(tracking!.evidence?.value).toContain("_fbp");
    expect(tracking!.evidence?.value).toContain("Facebook");
  });

  it("generates warn finding for analytics cookies", () => {
    const cookies: CategorizedCookie[] = [
      { name: "_ga", category: "analytics", vendor: "Google Analytics" },
    ];
    const findings = generateCookieFindings(cookies);
    const tracking = findings.find((f) => f.id === "preconsent.tracking.detected");
    expect(tracking).toBeDefined();
    expect(tracking!.severity).toBe("warn");
  });

  it("generates unknown cookie finding when only unknown cookies", () => {
    const cookies: CategorizedCookie[] = [
      { name: "xyz_custom_cookie", category: "unknown" },
    ];
    const findings = generateCookieFindings(cookies);
    const unknown = findings.find((f) => f.id === "preconsent.cookies.unknown");
    expect(unknown).toBeDefined();
    expect(unknown!.severity).toBe("warn");
    expect(unknown!.evidence?.value).toContain("xyz_custom_cookie");
  });

  it("generates essential cookies info finding", () => {
    const cookies: CategorizedCookie[] = [
      { name: "session_id", category: "necessary" },
      { name: "language", category: "functional" },
    ];
    const findings = generateCookieFindings(cookies);
    const essential = findings.find((f) => f.id === "preconsent.cookies.essential");
    expect(essential).toBeDefined();
    expect(essential!.severity).toBe("info");
    expect(essential!.detail).toContain("1 necessary");
    expect(essential!.detail).toContain("1 functional");
  });

  it("prioritizes tracking over unknown", () => {
    const cookies: CategorizedCookie[] = [
      { name: "_ga", category: "analytics", vendor: "Google Analytics" },
      { name: "xyz_custom", category: "unknown" },
    ];
    const findings = generateCookieFindings(cookies);
    const tracking = findings.find((f) => f.id === "preconsent.tracking.detected");
    const unknown = findings.find((f) => f.id === "preconsent.cookies.unknown");
    expect(tracking).toBeDefined();
    expect(unknown).toBeUndefined(); // Should not show unknown when tracking exists
  });

  it("limits evidence to 6 cookies", () => {
    const cookies: CategorizedCookie[] = Array(10)
      .fill(null)
      .map((_, i) => ({ name: `_ga_${i}`, category: "analytics" as const }));
    const findings = generateCookieFindings(cookies);
    const tracking = findings.find((f) => f.id === "preconsent.tracking.detected");
    expect(tracking!.evidence?.value.split(", ")).toHaveLength(6);
  });
});

// ============================================================================
// Test: generateGCMFindings()
// ============================================================================

describe("generateGCMFindings", () => {
  it("returns empty array when GCM not detected", () => {
    expect(generateGCMFindings({ detected: false, issues: [] })).toEqual([]);
  });

  it("generates info finding for complete v2", () => {
    const findings = generateGCMFindings({
      detected: true,
      version: "v2",
      issues: [],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("gcm.v2.complete");
    expect(findings[0].severity).toBe("info");
  });

  it("generates warn finding for incomplete v2", () => {
    const findings = generateGCMFindings({
      detected: true,
      version: "v2",
      issues: ["Missing ad_user_data signal"],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("gcm.v2.incomplete");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].detail).toContain("Missing ad_user_data signal");
  });

  it("generates warn finding for v1 (upgrade recommended)", () => {
    const findings = generateGCMFindings({
      detected: true,
      version: "v1",
      issues: [],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("gcm.v1.detected");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].detail).toContain("v2 is now required");
  });
});

// ============================================================================
// Test: Constants exported correctly
// ============================================================================

describe("constants", () => {
  it("exports BANNER_HINTS with expected values", () => {
    expect(BANNER_HINTS).toContain("cookie");
    expect(BANNER_HINTS).toContain("consent");
    expect(BANNER_HINTS).toContain("gdpr");
  });

  it("exports ACCEPT_HINTS with expected values", () => {
    expect(ACCEPT_HINTS).toContain("accept");
    expect(ACCEPT_HINTS).toContain("allow all");
    expect(ACCEPT_HINTS).toContain("agree");
  });

  it("exports REJECT_HINTS with expected values", () => {
    expect(REJECT_HINTS).toContain("reject");
    expect(REJECT_HINTS).toContain("decline");
    expect(REJECT_HINTS).toContain("only necessary");
  });

  it("exports MANAGE_HINTS with expected values", () => {
    expect(MANAGE_HINTS).toContain("preferences");
    expect(MANAGE_HINTS).toContain("manage");
    expect(MANAGE_HINTS).toContain("settings");
  });

  it("exports BANNER_SELECTORS with expected values", () => {
    expect(BANNER_SELECTORS).toContain("#onetrust-banner-sdk");
    expect(BANNER_SELECTORS).toContain("#cookie-banner");
    expect(BANNER_SELECTORS).toContain("[id*='cookie']");
  });
});
