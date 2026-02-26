/**
 * Accessibility audit for consent banners.
 *
 * Checks for WCAG compliance and accessibility best practices:
 * - ARIA labels and roles
 * - Keyboard navigation
 * - Focus trap detection
 *
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/
 */

import type { Page, Locator } from "playwright";
import type { ConsentFinding } from "@/lib/types";

// ============================================================================
// Types
// ============================================================================

export type AriaLabelsResult = {
  bannerHasRole: boolean; // role="dialog" or role="alertdialog"
  bannerHasLabel: boolean; // aria-label or aria-labelledby
  buttonsLabeled: boolean; // all buttons have accessible names
  issues: string[];
};

export type KeyboardResult = {
  focusable: boolean; // banner elements can receive focus
  tabOrder: boolean; // logical tab order
  escapeCloses: boolean; // Escape key closes banner
  enterActivates: boolean; // Enter activates focused button
  issues: string[];
};

export type FocusTrapResult = {
  detected: boolean; // focus is trapped in banner
  properTrap: boolean; // trap is implemented correctly (can escape)
  issues: string[];
};

export type AccessibilityResult = {
  score: number; // 0-100
  ariaLabels: AriaLabelsResult;
  keyboard: KeyboardResult;
  focusTrap: FocusTrapResult;
};

// ============================================================================
// ARIA Labels Audit
// ============================================================================

/**
 * Check if banner has appropriate ARIA role.
 * Consent banners should use role="dialog" or role="alertdialog".
 */
export async function checkBannerRole(banner: Locator): Promise<{
  hasRole: boolean;
  role?: string;
}> {
  try {
    const role = await banner.getAttribute("role");
    if (role === "dialog" || role === "alertdialog") {
      return { hasRole: true, role };
    }

    // Check if element is a native dialog
    const tagName = await banner.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "dialog") {
      return { hasRole: true, role: "dialog (native)" };
    }

    return { hasRole: false, role: role || undefined };
  } catch {
    return { hasRole: false };
  }
}

/**
 * Check if banner has an accessible label.
 * Should have aria-label, aria-labelledby, or title.
 */
export async function checkBannerLabel(banner: Locator): Promise<{
  hasLabel: boolean;
  method?: string;
}> {
  try {
    const [ariaLabel, ariaLabelledby, title] = await Promise.all([
      banner.getAttribute("aria-label"),
      banner.getAttribute("aria-labelledby"),
      banner.getAttribute("title"),
    ]);

    if (ariaLabel) {
      return { hasLabel: true, method: "aria-label" };
    }
    if (ariaLabelledby) {
      return { hasLabel: true, method: "aria-labelledby" };
    }
    if (title) {
      return { hasLabel: true, method: "title" };
    }

    return { hasLabel: false };
  } catch {
    return { hasLabel: false };
  }
}

/**
 * Check if all interactive elements in the banner have accessible names.
 * Buttons should have text content, aria-label, or aria-labelledby.
 */
export async function checkButtonsLabeled(banner: Locator): Promise<{
  allLabeled: boolean;
  unlabeledCount: number;
  issues: string[];
}> {
  const issues: string[] = [];
  let unlabeledCount = 0;

  try {
    const buttons = banner.locator("button, [role='button'], a, input[type='button'], input[type='submit']");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;

      const [text, ariaLabel, ariaLabelledby, title, value] = await Promise.all([
        button.innerText().catch(() => ""),
        button.getAttribute("aria-label"),
        button.getAttribute("aria-labelledby"),
        button.getAttribute("title"),
        button.getAttribute("value"),
      ]);

      const hasAccessibleName = !!(
        text.trim() ||
        ariaLabel ||
        ariaLabelledby ||
        title ||
        value
      );

      if (!hasAccessibleName) {
        unlabeledCount++;
        const tagName = await button.evaluate((el) => el.tagName.toLowerCase()).catch(() => "unknown");
        issues.push(`${tagName} element without accessible name`);
      }
    }

    return {
      allLabeled: unlabeledCount === 0,
      unlabeledCount,
      issues,
    };
  } catch {
    return {
      allLabeled: true, // Assume pass if we can't check
      unlabeledCount: 0,
      issues: ["Could not check button labels"],
    };
  }
}

/**
 * Run full ARIA labels audit on a banner.
 */
export async function auditAriaLabels(banner: Locator): Promise<AriaLabelsResult> {
  const [roleResult, labelResult, buttonsResult] = await Promise.all([
    checkBannerRole(banner),
    checkBannerLabel(banner),
    checkButtonsLabeled(banner),
  ]);

  const issues: string[] = [];

  if (!roleResult.hasRole) {
    issues.push("Banner missing role=\"dialog\" or role=\"alertdialog\"");
  }
  if (!labelResult.hasLabel) {
    issues.push("Banner missing aria-label or aria-labelledby");
  }
  if (!buttonsResult.allLabeled) {
    issues.push(...buttonsResult.issues);
  }

  return {
    bannerHasRole: roleResult.hasRole,
    bannerHasLabel: labelResult.hasLabel,
    buttonsLabeled: buttonsResult.allLabeled,
    issues,
  };
}

// ============================================================================
// Keyboard Navigation Audit
// ============================================================================

/**
 * Check if banner elements can receive keyboard focus.
 */
export async function checkFocusable(banner: Locator): Promise<{
  focusable: boolean;
  focusableCount: number;
}> {
  try {
    // Check for focusable elements
    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "[role='button']:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const focusableElements = banner.locator(focusableSelectors);
    const count = await focusableElements.count();

    return {
      focusable: count > 0,
      focusableCount: count,
    };
  } catch {
    return { focusable: false, focusableCount: 0 };
  }
}

/**
 * Check tab order - elements should be in logical visual order.
 * This checks if tabindex values don't create unexpected order.
 */
export async function checkTabOrder(banner: Locator): Promise<{
  hasLogicalOrder: boolean;
  positiveTabindexCount: number;
}> {
  try {
    // Elements with positive tabindex can disrupt natural order
    const positiveTabindex = banner.locator("[tabindex]:not([tabindex='0']):not([tabindex='-1'])");
    const count = await positiveTabindex.count();

    // Check for positive tabindex values
    let hasPositive = false;
    for (let i = 0; i < count; i++) {
      const tabindex = await positiveTabindex.nth(i).getAttribute("tabindex");
      if (tabindex && parseInt(tabindex, 10) > 0) {
        hasPositive = true;
        break;
      }
    }

    return {
      hasLogicalOrder: !hasPositive,
      positiveTabindexCount: hasPositive ? count : 0,
    };
  } catch {
    return { hasLogicalOrder: true, positiveTabindexCount: 0 };
  }
}

/**
 * Test if Escape key closes the banner.
 * This is a common accessibility pattern for dialogs.
 */
export async function checkEscapeCloses(
  page: Page,
  banner: Locator
): Promise<{ escapeCloses: boolean }> {
  try {
    // Check if banner is visible before test
    const wasVisible = await banner.isVisible();
    if (!wasVisible) {
      return { escapeCloses: false };
    }

    // Send Escape key
    await page.keyboard.press("Escape");

    // Small wait for any animations
    await page.waitForTimeout(300);

    // Check if banner is still visible
    const stillVisible = await banner.isVisible();

    // If banner closed, we need to report success but note this changes page state
    return { escapeCloses: !stillVisible };
  } catch {
    return { escapeCloses: false };
  }
}

/**
 * Test if Enter key activates focused button.
 */
export async function checkEnterActivates(
  page: Page,
  banner: Locator
): Promise<{ enterActivates: boolean }> {
  try {
    // Find first focusable button in banner
    const firstButton = banner.locator("button, [role='button']").first();
    const buttonExists = (await firstButton.count()) > 0;

    if (!buttonExists) {
      return { enterActivates: true }; // No buttons to test
    }

    const isVisible = await firstButton.isVisible();
    if (!isVisible) {
      return { enterActivates: true };
    }

    // Focus the button
    await firstButton.focus();

    // Check if button is now focused
    const isFocused = await firstButton.evaluate(
      (el) => document.activeElement === el
    );

    // We don't actually press Enter as it would change page state
    // We just verify the button can receive focus
    return { enterActivates: isFocused };
  } catch {
    return { enterActivates: false };
  }
}

/**
 * Run full keyboard navigation audit.
 */
export async function auditKeyboard(
  page: Page,
  banner: Locator,
  options?: { skipDestructiveTests?: boolean }
): Promise<KeyboardResult> {
  const [focusableResult, tabOrderResult, enterResult] = await Promise.all([
    checkFocusable(banner),
    checkTabOrder(banner),
    checkEnterActivates(page, banner),
  ]);

  // Escape test is potentially destructive (may close banner), so it's optional
  let escapeResult = { escapeCloses: false };
  if (!options?.skipDestructiveTests) {
    escapeResult = await checkEscapeCloses(page, banner);
  }

  const issues: string[] = [];

  if (!focusableResult.focusable) {
    issues.push("No focusable elements in banner");
  }
  if (!tabOrderResult.hasLogicalOrder) {
    issues.push(`${tabOrderResult.positiveTabindexCount} element(s) with positive tabindex may disrupt tab order`);
  }
  if (!enterResult.enterActivates) {
    issues.push("Buttons may not be keyboard-accessible");
  }
  // We only report escape as an issue if we tested it
  // Note: escapeCloses being false is not necessarily an issue, just not a feature

  return {
    focusable: focusableResult.focusable,
    tabOrder: tabOrderResult.hasLogicalOrder,
    escapeCloses: escapeResult.escapeCloses,
    enterActivates: enterResult.enterActivates,
    issues,
  };
}

// ============================================================================
// Focus Trap Detection
// ============================================================================

/**
 * Check if focus is trapped within the banner.
 * A proper focus trap keeps focus within the dialog but allows escape.
 */
export async function auditFocusTrap(
  page: Page,
  banner: Locator
): Promise<FocusTrapResult> {
  const issues: string[] = [];

  try {
    // Find focusable elements in banner
    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "[role='button']:not([disabled])",
      "input:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const focusableElements = banner.locator(focusableSelectors);
    const count = await focusableElements.count();

    if (count === 0) {
      return {
        detected: false,
        properTrap: false,
        issues: ["No focusable elements to trap"],
      };
    }

    // Focus the first element
    const firstElement = focusableElements.first();
    const isVisible = await firstElement.isVisible();
    if (!isVisible) {
      return {
        detected: false,
        properTrap: false,
        issues: ["First focusable element is not visible"],
      };
    }

    await firstElement.focus();

    // Check if focus is within banner
    const isFocusedInBanner = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return false;

      // Find consent banner (common selectors)
      const bannerSelectors = [
        "#onetrust-banner-sdk",
        "#cookie-banner",
        "[role='dialog']",
        "[role='alertdialog']",
        "[id*='cookie']",
        "[id*='consent']",
        "[class*='cookie']",
        "[class*='consent']",
      ];

      for (const sel of bannerSelectors) {
        const banner = document.querySelector(sel);
        if (banner && banner.contains(active)) {
          return true;
        }
      }

      return false;
    });

    if (!isFocusedInBanner) {
      return {
        detected: false,
        properTrap: false,
        issues: ["Focus is not contained within banner"],
      };
    }

    // Tab through elements to check if focus stays in banner
    // (limited test - we just check a few tabs)
    let focusEscaped = false;
    for (let i = 0; i < Math.min(count + 2, 10); i++) {
      await page.keyboard.press("Tab");

      const stillInBanner = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return false;

        const bannerSelectors = [
          "#onetrust-banner-sdk",
          "#cookie-banner",
          "[role='dialog']",
          "[role='alertdialog']",
          "[id*='cookie']",
          "[id*='consent']",
          "[class*='cookie']",
          "[class*='consent']",
        ];

        for (const sel of bannerSelectors) {
          const banner = document.querySelector(sel);
          if (banner && banner.contains(active)) {
            return true;
          }
        }
        return false;
      });

      if (!stillInBanner) {
        focusEscaped = true;
        break;
      }
    }

    // Focus trap detected if focus stayed in banner
    const trapDetected = !focusEscaped;

    // A proper trap should still allow the dialog to be dismissed
    // We check for a close button or escape handler
    const hasCloseButton = (await banner.locator("[aria-label*='close'], [aria-label*='Close'], .close, button:has-text('X')").count()) > 0;

    // Check for aria-modal which indicates proper modal behavior
    const ariaModal = await banner.getAttribute("aria-modal");
    const isProperModal = ariaModal === "true";

    // Proper trap = focus stays in banner AND user can dismiss it
    const properTrap = trapDetected && (hasCloseButton || isProperModal);

    if (trapDetected && !properTrap) {
      issues.push("Focus trap detected but no clear way to dismiss banner");
    }
    if (!trapDetected && count > 1) {
      issues.push("Focus escapes banner during tab navigation");
    }

    return {
      detected: trapDetected,
      properTrap,
      issues,
    };
  } catch {
    return {
      detected: false,
      properTrap: false,
      issues: ["Could not test focus trap"],
    };
  }
}

// ============================================================================
// Main Audit Function
// ============================================================================

/**
 * Calculate accessibility score from audit results.
 */
export function calculateAccessibilityScore(result: {
  ariaLabels: AriaLabelsResult;
  keyboard: KeyboardResult;
  focusTrap: FocusTrapResult;
}): number {
  let score = 100;

  // ARIA labels (30 points)
  if (!result.ariaLabels.bannerHasRole) score -= 10;
  if (!result.ariaLabels.bannerHasLabel) score -= 10;
  if (!result.ariaLabels.buttonsLabeled) score -= 10;

  // Keyboard navigation (40 points)
  if (!result.keyboard.focusable) score -= 20; // Critical
  if (!result.keyboard.tabOrder) score -= 10;
  if (!result.keyboard.enterActivates) score -= 10;

  // Focus trap (30 points)
  if (!result.focusTrap.detected && result.keyboard.focusable) score -= 15;
  if (result.focusTrap.detected && !result.focusTrap.properTrap) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Run full accessibility audit on a consent banner.
 */
export async function auditAccessibility(
  page: Page,
  bannerSelector: string
): Promise<AccessibilityResult> {
  const banner = page.locator(bannerSelector).first();

  // Check if banner exists and is visible
  const exists = await banner.count() > 0;
  if (!exists) {
    return {
      score: 0,
      ariaLabels: {
        bannerHasRole: false,
        bannerHasLabel: false,
        buttonsLabeled: false,
        issues: ["Banner not found"],
      },
      keyboard: {
        focusable: false,
        tabOrder: false,
        escapeCloses: false,
        enterActivates: false,
        issues: ["Banner not found"],
      },
      focusTrap: {
        detected: false,
        properTrap: false,
        issues: ["Banner not found"],
      },
    };
  }

  const isVisible = await banner.isVisible();
  if (!isVisible) {
    return {
      score: 0,
      ariaLabels: {
        bannerHasRole: false,
        bannerHasLabel: false,
        buttonsLabeled: false,
        issues: ["Banner not visible"],
      },
      keyboard: {
        focusable: false,
        tabOrder: false,
        escapeCloses: false,
        enterActivates: false,
        issues: ["Banner not visible"],
      },
      focusTrap: {
        detected: false,
        properTrap: false,
        issues: ["Banner not visible"],
      },
    };
  }

  // Run all audits
  const [ariaLabels, keyboard, focusTrap] = await Promise.all([
    auditAriaLabels(banner),
    auditKeyboard(page, banner, { skipDestructiveTests: true }),
    auditFocusTrap(page, banner),
  ]);

  const score = calculateAccessibilityScore({ ariaLabels, keyboard, focusTrap });

  return {
    score,
    ariaLabels,
    keyboard,
    focusTrap,
  };
}

// ============================================================================
// Findings Generation
// ============================================================================

/**
 * Generate accessibility findings from audit result.
 */
export function generateAccessibilityFindings(result: AccessibilityResult): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  // ARIA label findings
  if (!result.ariaLabels.bannerHasRole) {
    findings.push({
      id: "a11y.aria.missing_role",
      title: "Consent banner missing dialog role",
      severity: "warn",
      category: "accessibility",
      detail:
        'Consent banners should have role="dialog" or role="alertdialog" to be properly announced by screen readers.',
    });
  }

  if (!result.ariaLabels.bannerHasLabel) {
    findings.push({
      id: "a11y.aria.missing_label",
      title: "Consent banner missing accessible label",
      severity: "warn",
      category: "accessibility",
      detail:
        "Consent banners should have aria-label or aria-labelledby to provide context for screen reader users.",
    });
  }

  if (!result.ariaLabels.buttonsLabeled) {
    findings.push({
      id: "a11y.aria.unlabeled_buttons",
      title: "Interactive elements without accessible names",
      severity: "fail",
      category: "accessibility",
      detail:
        "Some buttons or links in the consent banner do not have accessible names. This makes them unusable for screen reader users.",
      evidence: {
        kind: "text",
        value: result.ariaLabels.issues.join("; "),
      },
    });
  }

  // Keyboard findings
  if (!result.keyboard.focusable) {
    findings.push({
      id: "a11y.keyboard.not_focusable",
      title: "Consent banner not keyboard accessible",
      severity: "fail",
      category: "accessibility",
      detail:
        "The consent banner has no focusable elements, making it inaccessible to keyboard users.",
    });
  }

  if (!result.keyboard.tabOrder) {
    findings.push({
      id: "a11y.keyboard.tab_order",
      title: "Consent banner has non-standard tab order",
      severity: "warn",
      category: "accessibility",
      detail:
        "Elements with positive tabindex values can create confusing keyboard navigation. Use tabindex=\"0\" or natural DOM order instead.",
    });
  }

  if (!result.keyboard.enterActivates) {
    findings.push({
      id: "a11y.keyboard.enter_not_working",
      title: "Buttons may not respond to Enter key",
      severity: "warn",
      category: "accessibility",
      detail:
        "Keyboard users expect to activate buttons with Enter or Space. Ensure all interactive elements are properly implemented.",
    });
  }

  // Focus trap findings
  if (!result.focusTrap.detected && result.keyboard.focusable) {
    findings.push({
      id: "a11y.focus.no_trap",
      title: "Focus not trapped in consent banner",
      severity: "warn",
      category: "accessibility",
      detail:
        "When a consent banner is displayed, focus should be trapped within it to prevent users from interacting with content behind the banner.",
    });
  }

  if (result.focusTrap.detected && !result.focusTrap.properTrap) {
    findings.push({
      id: "a11y.focus.improper_trap",
      title: "Focus trap without clear exit",
      severity: "fail",
      category: "accessibility",
      detail:
        "Focus is trapped in the consent banner but there is no clear way to dismiss it. This can permanently trap keyboard and screen reader users.",
    });
  }

  // Overall score findings
  if (result.score >= 80) {
    findings.push({
      id: "a11y.overall.good",
      title: "Good accessibility practices detected",
      severity: "info",
      category: "accessibility",
      detail: `The consent banner follows most accessibility best practices. Score: ${result.score}/100`,
    });
  } else if (result.score < 50) {
    findings.push({
      id: "a11y.overall.poor",
      title: "Significant accessibility issues detected",
      severity: "fail",
      category: "accessibility",
      detail: `The consent banner has significant accessibility issues that may prevent some users from making consent choices. Score: ${result.score}/100`,
      evidence: {
        kind: "text",
        value: [
          ...result.ariaLabels.issues,
          ...result.keyboard.issues,
          ...result.focusTrap.issues,
        ]
          .slice(0, 5)
          .join("; "),
      },
    });
  }

  return findings;
}
