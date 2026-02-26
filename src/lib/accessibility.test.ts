import { describe, it, expect, vi } from "vitest";
import {
  checkBannerRole,
  checkBannerLabel,
  checkButtonsLabeled,
  auditAriaLabels,
  checkFocusable,
  checkTabOrder,
  checkEnterActivates,
  auditKeyboard,
  calculateAccessibilityScore,
  auditAccessibility,
  generateAccessibilityFindings,
  type AccessibilityResult,
} from "./accessibility";

// ============================================================================
// Mock Setup
// ============================================================================

function createMockLocator(options: {
  attributes?: Record<string, string | null>;
  tagName?: string;
  visible?: boolean;
  count?: number;
  innerText?: string;
  childLocators?: Record<string, ReturnType<typeof createMockLocator>>;
} = {}) {
  const mockLocator = {
    getAttribute: vi.fn().mockImplementation(async (attr: string) => {
      return options.attributes?.[attr] ?? null;
    }),
    evaluate: vi.fn().mockImplementation(async (fn: (el: Element) => unknown) => {
      // Simulate the function based on what it's trying to get
      if (fn.toString().includes("tagName")) {
        return options.tagName ?? "div";
      }
      if (fn.toString().includes("activeElement")) {
        return true;
      }
      return undefined;
    }),
    isVisible: vi.fn().mockResolvedValue(options.visible ?? true),
    count: vi.fn().mockResolvedValue(options.count ?? 1),
    innerText: vi.fn().mockResolvedValue(options.innerText ?? ""),
    first: vi.fn().mockReturnThis(),
    nth: vi.fn().mockReturnThis(),
    focus: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockImplementation((selector: string) => {
      if (options.childLocators?.[selector]) {
        return options.childLocators[selector];
      }
      // Default child locator
      return createMockLocator({ count: 0 });
    }),
  };
  return mockLocator;
}

function createMockPage(options: {
  bannerLocator?: ReturnType<typeof createMockLocator>;
  evaluateResult?: unknown;
} = {}) {
  return {
    locator: vi.fn().mockReturnValue(
      options.bannerLocator ?? createMockLocator()
    ),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
    },
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(options.evaluateResult ?? true),
  };
}

// ============================================================================
// Test: checkBannerRole
// ============================================================================

describe("checkBannerRole", () => {
  it('returns hasRole: true for role="dialog"', async () => {
    const locator = createMockLocator({
      attributes: { role: "dialog" },
    });

    const result = await checkBannerRole(locator as never);

    expect(result.hasRole).toBe(true);
    expect(result.role).toBe("dialog");
  });

  it('returns hasRole: true for role="alertdialog"', async () => {
    const locator = createMockLocator({
      attributes: { role: "alertdialog" },
    });

    const result = await checkBannerRole(locator as never);

    expect(result.hasRole).toBe(true);
    expect(result.role).toBe("alertdialog");
  });

  it("returns hasRole: true for native dialog element", async () => {
    const locator = createMockLocator({
      attributes: { role: null },
      tagName: "dialog",
    });

    const result = await checkBannerRole(locator as never);

    expect(result.hasRole).toBe(true);
    expect(result.role).toBe("dialog (native)");
  });

  it("returns hasRole: false for no role", async () => {
    const locator = createMockLocator({
      attributes: { role: null },
      tagName: "div",
    });

    const result = await checkBannerRole(locator as never);

    expect(result.hasRole).toBe(false);
  });

  it("returns hasRole: false for incorrect role", async () => {
    const locator = createMockLocator({
      attributes: { role: "banner" },
      tagName: "div",
    });

    const result = await checkBannerRole(locator as never);

    expect(result.hasRole).toBe(false);
    expect(result.role).toBe("banner");
  });
});

// ============================================================================
// Test: checkBannerLabel
// ============================================================================

describe("checkBannerLabel", () => {
  it("returns hasLabel: true for aria-label", async () => {
    const locator = createMockLocator({
      attributes: { "aria-label": "Cookie consent dialog" },
    });

    const result = await checkBannerLabel(locator as never);

    expect(result.hasLabel).toBe(true);
    expect(result.method).toBe("aria-label");
  });

  it("returns hasLabel: true for aria-labelledby", async () => {
    const locator = createMockLocator({
      attributes: { "aria-labelledby": "consent-title" },
    });

    const result = await checkBannerLabel(locator as never);

    expect(result.hasLabel).toBe(true);
    expect(result.method).toBe("aria-labelledby");
  });

  it("returns hasLabel: true for title", async () => {
    const locator = createMockLocator({
      attributes: { title: "Cookie Settings" },
    });

    const result = await checkBannerLabel(locator as never);

    expect(result.hasLabel).toBe(true);
    expect(result.method).toBe("title");
  });

  it("prefers aria-label over aria-labelledby", async () => {
    const locator = createMockLocator({
      attributes: {
        "aria-label": "Cookie consent",
        "aria-labelledby": "consent-title",
      },
    });

    const result = await checkBannerLabel(locator as never);

    expect(result.hasLabel).toBe(true);
    expect(result.method).toBe("aria-label");
  });

  it("returns hasLabel: false for no label", async () => {
    const locator = createMockLocator({
      attributes: {},
    });

    const result = await checkBannerLabel(locator as never);

    expect(result.hasLabel).toBe(false);
    expect(result.method).toBeUndefined();
  });
});

// ============================================================================
// Test: checkButtonsLabeled
// ============================================================================

describe("checkButtonsLabeled", () => {
  it("returns allLabeled: true when all buttons have text", async () => {
    const buttonLocator = createMockLocator({
      count: 2,
      innerText: "Accept",
      visible: true,
    });
    const bannerLocator = createMockLocator({
      childLocators: {
        "button, [role='button'], a, input[type='button'], input[type='submit']": buttonLocator,
      },
    });

    const result = await checkButtonsLabeled(bannerLocator as never);

    expect(result.allLabeled).toBe(true);
    expect(result.unlabeledCount).toBe(0);
  });

  it("returns allLabeled: true when no buttons exist", async () => {
    const buttonLocator = createMockLocator({ count: 0 });
    const bannerLocator = createMockLocator({
      childLocators: {
        "button, [role='button'], a, input[type='button'], input[type='submit']": buttonLocator,
      },
    });

    const result = await checkButtonsLabeled(bannerLocator as never);

    expect(result.allLabeled).toBe(true);
  });

  it("returns allLabeled: false when button lacks accessible name", async () => {
    const buttonLocator = createMockLocator({
      count: 1,
      innerText: "",
      visible: true,
      attributes: {},
    });
    const bannerLocator = createMockLocator({
      childLocators: {
        "button, [role='button'], a, input[type='button'], input[type='submit']": buttonLocator,
      },
    });

    const result = await checkButtonsLabeled(bannerLocator as never);

    expect(result.allLabeled).toBe(false);
    expect(result.unlabeledCount).toBe(1);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("accepts buttons with aria-label", async () => {
    const buttonLocator = createMockLocator({
      count: 1,
      innerText: "",
      visible: true,
      attributes: { "aria-label": "Close" },
    });
    const bannerLocator = createMockLocator({
      childLocators: {
        "button, [role='button'], a, input[type='button'], input[type='submit']": buttonLocator,
      },
    });

    const result = await checkButtonsLabeled(bannerLocator as never);

    expect(result.allLabeled).toBe(true);
  });
});

// ============================================================================
// Test: auditAriaLabels
// ============================================================================

describe("auditAriaLabels", () => {
  it("returns clean result for properly labeled banner", async () => {
    const buttonLocator = createMockLocator({ count: 2, innerText: "Accept", visible: true });
    const locator = createMockLocator({
      attributes: { role: "dialog", "aria-label": "Cookie consent" },
      tagName: "div",
      childLocators: {
        "button, [role='button'], a, input[type='button'], input[type='submit']": buttonLocator,
      },
    });

    const result = await auditAriaLabels(locator as never);

    expect(result.bannerHasRole).toBe(true);
    expect(result.bannerHasLabel).toBe(true);
    expect(result.buttonsLabeled).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("reports issues for missing role and label", async () => {
    const buttonLocator = createMockLocator({ count: 1, innerText: "Accept", visible: true });
    const locator = createMockLocator({
      attributes: {},
      tagName: "div",
      childLocators: {
        "button, [role='button'], a, input[type='button'], input[type='submit']": buttonLocator,
      },
    });

    const result = await auditAriaLabels(locator as never);

    expect(result.bannerHasRole).toBe(false);
    expect(result.bannerHasLabel).toBe(false);
    expect(result.issues).toContain('Banner missing role="dialog" or role="alertdialog"');
    expect(result.issues).toContain("Banner missing aria-label or aria-labelledby");
  });
});

// ============================================================================
// Test: checkFocusable
// ============================================================================

describe("checkFocusable", () => {
  it("returns focusable: true when buttons exist", async () => {
    const focusableLocator = createMockLocator({ count: 3 });
    const bannerLocator = createMockLocator({
      childLocators: {
        "button:not([disabled]), a[href], [role='button']:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])": focusableLocator,
      },
    });

    const result = await checkFocusable(bannerLocator as never);

    expect(result.focusable).toBe(true);
    expect(result.focusableCount).toBe(3);
  });

  it("returns focusable: false when no focusable elements", async () => {
    const focusableLocator = createMockLocator({ count: 0 });
    const bannerLocator = createMockLocator({
      childLocators: {
        "button:not([disabled]), a[href], [role='button']:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])": focusableLocator,
      },
    });

    const result = await checkFocusable(bannerLocator as never);

    expect(result.focusable).toBe(false);
    expect(result.focusableCount).toBe(0);
  });
});

// ============================================================================
// Test: checkTabOrder
// ============================================================================

describe("checkTabOrder", () => {
  it("returns hasLogicalOrder: true when no positive tabindex", async () => {
    const tabindexLocator = createMockLocator({ count: 0 });
    const bannerLocator = createMockLocator({
      childLocators: {
        "[tabindex]:not([tabindex='0']):not([tabindex='-1'])": tabindexLocator,
      },
    });

    const result = await checkTabOrder(bannerLocator as never);

    expect(result.hasLogicalOrder).toBe(true);
    expect(result.positiveTabindexCount).toBe(0);
  });

  it("returns hasLogicalOrder: false when positive tabindex exists", async () => {
    const tabindexLocator = createMockLocator({
      count: 2,
      attributes: { tabindex: "1" },
    });
    const bannerLocator = createMockLocator({
      childLocators: {
        "[tabindex]:not([tabindex='0']):not([tabindex='-1'])": tabindexLocator,
      },
    });

    const result = await checkTabOrder(bannerLocator as never);

    expect(result.hasLogicalOrder).toBe(false);
    expect(result.positiveTabindexCount).toBe(2);
  });
});

// ============================================================================
// Test: checkEnterActivates
// ============================================================================

describe("checkEnterActivates", () => {
  it("returns enterActivates: true when button can be focused", async () => {
    const buttonLocator = createMockLocator({
      count: 1,
      visible: true,
    });
    // Mock evaluate to return true (button is focused)
    buttonLocator.evaluate.mockResolvedValue(true);

    const bannerLocator = createMockLocator({
      childLocators: { "button, [role='button']": buttonLocator },
    });

    const page = createMockPage({ bannerLocator });

    const result = await checkEnterActivates(page as never, bannerLocator as never);

    expect(result.enterActivates).toBe(true);
  });

  it("returns enterActivates: true when no buttons exist", async () => {
    const buttonLocator = createMockLocator({ count: 0 });
    const bannerLocator = createMockLocator({
      childLocators: { "button, [role='button']": buttonLocator },
    });

    const page = createMockPage({ bannerLocator });

    const result = await checkEnterActivates(page as never, bannerLocator as never);

    expect(result.enterActivates).toBe(true);
  });
});

// ============================================================================
// Test: auditKeyboard
// ============================================================================

describe("auditKeyboard", () => {
  it("reports no issues for keyboard-accessible banner", async () => {
    const focusableLocator = createMockLocator({ count: 3 });
    const tabindexLocator = createMockLocator({ count: 0 });
    const buttonLocator = createMockLocator({ count: 1, visible: true });
    buttonLocator.evaluate.mockResolvedValue(true);

    const bannerLocator = createMockLocator({
      childLocators: {
        "button:not([disabled]), a[href], [role='button']:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])": focusableLocator,
        "[tabindex]:not([tabindex='0']):not([tabindex='-1'])": tabindexLocator,
        "button, [role='button']": buttonLocator,
      },
    });

    const page = createMockPage({ bannerLocator });

    const result = await auditKeyboard(page as never, bannerLocator as never, {
      skipDestructiveTests: true,
    });

    expect(result.focusable).toBe(true);
    expect(result.tabOrder).toBe(true);
    expect(result.enterActivates).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("reports issues when not focusable", async () => {
    const focusableLocator = createMockLocator({ count: 0 });
    const tabindexLocator = createMockLocator({ count: 0 });
    const buttonLocator = createMockLocator({ count: 0 });

    const bannerLocator = createMockLocator({
      childLocators: {
        "button:not([disabled]), a[href], [role='button']:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])": focusableLocator,
        "[tabindex]:not([tabindex='0']):not([tabindex='-1'])": tabindexLocator,
        "button, [role='button']": buttonLocator,
      },
    });

    const page = createMockPage({ bannerLocator });

    const result = await auditKeyboard(page as never, bannerLocator as never, {
      skipDestructiveTests: true,
    });

    expect(result.focusable).toBe(false);
    expect(result.issues).toContain("No focusable elements in banner");
  });
});

// ============================================================================
// Test: calculateAccessibilityScore
// ============================================================================

describe("calculateAccessibilityScore", () => {
  it("returns 100 for perfect accessibility", () => {
    const result = calculateAccessibilityScore({
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: true, issues: [] },
    });

    expect(result).toBe(100);
  });

  it("deducts 10 points for missing role", () => {
    const result = calculateAccessibilityScore({
      ariaLabels: { bannerHasRole: false, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: true, issues: [] },
    });

    expect(result).toBe(90);
  });

  it("deducts 20 points for not focusable", () => {
    const result = calculateAccessibilityScore({
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: false, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    });

    expect(result).toBe(80);
  });

  it("deducts 15 points for improper focus trap", () => {
    const result = calculateAccessibilityScore({
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: false, issues: [] },
    });

    expect(result).toBe(85);
  });

  it("accumulates all deductions", () => {
    const result = calculateAccessibilityScore({
      ariaLabels: { bannerHasRole: false, bannerHasLabel: false, buttonsLabeled: false, issues: [] },
      keyboard: { focusable: false, tabOrder: false, escapeCloses: false, enterActivates: false, issues: [] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    });

    // 100 - 10 - 10 - 10 - 20 - 10 - 10 = 30
    expect(result).toBe(30);
  });

  it("never goes below 0", () => {
    const result = calculateAccessibilityScore({
      ariaLabels: { bannerHasRole: false, bannerHasLabel: false, buttonsLabeled: false, issues: [] },
      keyboard: { focusable: false, tabOrder: false, escapeCloses: false, enterActivates: false, issues: [] },
      focusTrap: { detected: true, properTrap: false, issues: [] },
    });

    // Would be 30 - 15 = 15, but with focus trap issues
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Test: auditAccessibility
// ============================================================================

describe("auditAccessibility", () => {
  it("returns zero score when banner not found", async () => {
    const bannerLocator = createMockLocator({ count: 0 });
    const page = createMockPage({ bannerLocator });

    const result = await auditAccessibility(page as never, "#cookie-banner");

    expect(result.score).toBe(0);
    expect(result.ariaLabels.issues).toContain("Banner not found");
  });

  it("returns zero score when banner not visible", async () => {
    const bannerLocator = createMockLocator({ count: 1, visible: false });
    const page = createMockPage({ bannerLocator });

    const result = await auditAccessibility(page as never, "#cookie-banner");

    expect(result.score).toBe(0);
    expect(result.ariaLabels.issues).toContain("Banner not visible");
  });
});

// ============================================================================
// Test: generateAccessibilityFindings
// ============================================================================

describe("generateAccessibilityFindings", () => {
  it("generates no failure findings for good accessibility", () => {
    const result: AccessibilityResult = {
      score: 100,
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: true, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.severity === "fail")).toBe(false);
    expect(findings.some(f => f.id === "a11y.overall.good")).toBe(true);
  });

  it("generates warn finding for missing role", () => {
    const result: AccessibilityResult = {
      score: 90,
      ariaLabels: { bannerHasRole: false, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: true, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.aria.missing_role")).toBe(true);
    expect(findings.find(f => f.id === "a11y.aria.missing_role")?.severity).toBe("warn");
  });

  it("generates warn finding for missing label", () => {
    const result: AccessibilityResult = {
      score: 90,
      ariaLabels: { bannerHasRole: true, bannerHasLabel: false, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: true, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.aria.missing_label")).toBe(true);
  });

  it("generates fail finding for unlabeled buttons", () => {
    const result: AccessibilityResult = {
      score: 90,
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: false, issues: ["button without accessible name"] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: true, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.aria.unlabeled_buttons")).toBe(true);
    expect(findings.find(f => f.id === "a11y.aria.unlabeled_buttons")?.severity).toBe("fail");
  });

  it("generates fail finding for not keyboard accessible", () => {
    const result: AccessibilityResult = {
      score: 80,
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: false, tabOrder: true, escapeCloses: false, enterActivates: false, issues: [] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.keyboard.not_focusable")).toBe(true);
    expect(findings.find(f => f.id === "a11y.keyboard.not_focusable")?.severity).toBe("fail");
  });

  it("generates warn finding for missing focus trap", () => {
    const result: AccessibilityResult = {
      score: 85,
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.focus.no_trap")).toBe(true);
    expect(findings.find(f => f.id === "a11y.focus.no_trap")?.severity).toBe("warn");
  });

  it("generates fail finding for improper focus trap", () => {
    const result: AccessibilityResult = {
      score: 85,
      ariaLabels: { bannerHasRole: true, bannerHasLabel: true, buttonsLabeled: true, issues: [] },
      keyboard: { focusable: true, tabOrder: true, escapeCloses: true, enterActivates: true, issues: [] },
      focusTrap: { detected: true, properTrap: false, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.focus.improper_trap")).toBe(true);
    expect(findings.find(f => f.id === "a11y.focus.improper_trap")?.severity).toBe("fail");
  });

  it("generates fail finding for low overall score", () => {
    const result: AccessibilityResult = {
      score: 40,
      ariaLabels: { bannerHasRole: false, bannerHasLabel: false, buttonsLabeled: false, issues: ["missing role", "missing label"] },
      keyboard: { focusable: false, tabOrder: false, escapeCloses: false, enterActivates: false, issues: ["not focusable"] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.some(f => f.id === "a11y.overall.poor")).toBe(true);
    expect(findings.find(f => f.id === "a11y.overall.poor")?.severity).toBe("fail");
  });

  it("categorizes all findings as accessibility", () => {
    const result: AccessibilityResult = {
      score: 50,
      ariaLabels: { bannerHasRole: false, bannerHasLabel: false, buttonsLabeled: false, issues: [] },
      keyboard: { focusable: false, tabOrder: false, escapeCloses: false, enterActivates: false, issues: [] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    expect(findings.every(f => f.category === "accessibility")).toBe(true);
  });

  it("includes evidence in overall.poor finding", () => {
    const result: AccessibilityResult = {
      score: 40,
      ariaLabels: { bannerHasRole: false, bannerHasLabel: false, buttonsLabeled: false, issues: ["missing role"] },
      keyboard: { focusable: false, tabOrder: false, escapeCloses: false, enterActivates: false, issues: ["not accessible"] },
      focusTrap: { detected: false, properTrap: false, issues: [] },
    };

    const findings = generateAccessibilityFindings(result);

    const poorFinding = findings.find(f => f.id === "a11y.overall.poor");
    expect(poorFinding?.evidence?.value).toContain("missing role");
  });
});
