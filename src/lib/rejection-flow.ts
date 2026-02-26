/**
 * Multi-layer CMP rejection flow measurement.
 *
 * This module measures the actual click friction to reject tracking
 * by navigating through CMP preference layers.
 */

import type { Page, Locator } from "playwright";
import type { ConsentFinding } from "./types";
import { classifyButtonText, type ButtonClassification } from "./heuristics";

// ============================================================================
// Types
// ============================================================================

export interface RejectionStep {
  action: "click" | "toggle";
  target: string;        // Button text or toggle label
  selector: string;      // CSS selector for debugging
  depth: number;         // Layer depth (1 = first preferences layer)
}

export interface RejectionFlowResult {
  success: boolean;
  rejectClicks: number;   // Clicks on buttons (manage, reject, save, advanced)
  toggleClicks: number;   // Clicks to turn off toggles
  totalClicks: number;    // rejectClicks + toggleClicks
  path: RejectionStep[];
  maxDepthReached: boolean;
  error?: string;
}

export interface ToggleInfo {
  label: string;
  selector: string;
  isOn: boolean;
  locator: Locator;
}

interface LayerAnalysis {
  rejectButton?: { text: string; locator: Locator };
  saveButton?: { text: string; locator: Locator };
  advancedButton?: { text: string; locator: Locator };
  toggles: ToggleInfo[];
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  maxDepth: 4,
  layerWaitMs: 1000,
  clickTimeoutMs: 3000,
  totalTimeoutMs: 15000,
};

// Shadow DOM hosts for known CMPs
const SHADOW_HOSTS = [
  "#usercentrics-root",
  "#CybotCookiebotDialog",
  "[data-cmp-root]",
  "sp-message-container",
];

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Measure the actual clicks needed to reject all tracking.
 *
 * @param page - Playwright page instance
 * @param manageButton - Locator for the "Manage Preferences" button to click first
 * @returns RejectionFlowResult with click count and path taken
 */
export async function measureRejectionFlow(
  page: Page,
  manageButton: Locator
): Promise<RejectionFlowResult> {
  const startTime = Date.now();
  const path: RejectionStep[] = [];
  let rejectClicks = 0;
  let toggleClicks = 0;
  let depth = 0;

  try {
    // Step 1: Click the manage preferences button
    const manageText = await manageButton.innerText().catch(() => "Manage Preferences");
    await manageButton.click({ timeout: CONFIG.clickTimeoutMs });
    rejectClicks++;
    depth++;
    path.push({
      action: "click",
      target: manageText.trim().slice(0, 80),
      selector: "initial-manage-button",
      depth,
    });

    // Wait for layer to appear
    await page.waitForTimeout(CONFIG.layerWaitMs);

    // Step 2: Navigate through layers
    while (depth < CONFIG.maxDepth) {
      // Check timeout
      if (Date.now() - startTime > CONFIG.totalTimeoutMs) {
        return {
          success: false,
          rejectClicks,
          toggleClicks,
          totalClicks: rejectClicks + toggleClicks,
          path,
          maxDepthReached: false,
          error: "Timeout exceeded",
        };
      }

      // Analyze current layer
      const layer = await analyzeCurrentLayer(page);

      // Priority 1: Direct reject button
      if (layer.rejectButton) {
        await layer.rejectButton.locator.click({ timeout: CONFIG.clickTimeoutMs });
        rejectClicks++;
        path.push({
          action: "click",
          target: layer.rejectButton.text,
          selector: "reject-button",
          depth: depth + 1,
        });
        return {
          success: true,
          rejectClicks,
          toggleClicks,
          totalClicks: rejectClicks + toggleClicks,
          path,
          maxDepthReached: false,
        };
      }

      // Priority 2: Turn off all toggles and click save
      if (layer.toggles.length > 0 && layer.saveButton) {
        // Turn off any ON toggles
        const onToggles = layer.toggles.filter((t) => t.isOn);
        for (const toggle of onToggles) {
          await toggle.locator.click({ timeout: CONFIG.clickTimeoutMs });
          toggleClicks++;
          path.push({
            action: "toggle",
            target: toggle.label,
            selector: toggle.selector,
            depth: depth + 1,
          });
        }

        // Click save
        await layer.saveButton.locator.click({ timeout: CONFIG.clickTimeoutMs });
        rejectClicks++;
        path.push({
          action: "click",
          target: layer.saveButton.text,
          selector: "save-button",
          depth: depth + 1,
        });
        return {
          success: true,
          rejectClicks,
          toggleClicks,
          totalClicks: rejectClicks + toggleClicks,
          path,
          maxDepthReached: false,
        };
      }

      // Priority 3: Go deeper via advanced button
      if (layer.advancedButton) {
        await layer.advancedButton.locator.click({ timeout: CONFIG.clickTimeoutMs });
        rejectClicks++;
        depth++;
        path.push({
          action: "click",
          target: layer.advancedButton.text,
          selector: "advanced-button",
          depth,
        });
        await page.waitForTimeout(CONFIG.layerWaitMs);
        continue;
      }

      // Priority 4: Just save button (no toggles) - might work
      if (layer.saveButton) {
        await layer.saveButton.locator.click({ timeout: CONFIG.clickTimeoutMs });
        rejectClicks++;
        path.push({
          action: "click",
          target: layer.saveButton.text,
          selector: "save-button",
          depth: depth + 1,
        });
        return {
          success: true,
          rejectClicks,
          toggleClicks,
          totalClicks: rejectClicks + toggleClicks,
          path,
          maxDepthReached: false,
        };
      }

      // No useful buttons found - stuck
      return {
        success: false,
        rejectClicks,
        toggleClicks,
        totalClicks: rejectClicks + toggleClicks,
        path,
        maxDepthReached: false,
        error: "No actionable buttons found in layer",
      };
    }

    // Max depth reached
    return {
      success: false,
      rejectClicks,
      toggleClicks,
      totalClicks: rejectClicks + toggleClicks,
      path,
      maxDepthReached: true,
      error: `Max depth of ${CONFIG.maxDepth} reached`,
    };
  } catch (err) {
    return {
      success: false,
      rejectClicks,
      toggleClicks,
      totalClicks: rejectClicks + toggleClicks,
      path,
      maxDepthReached: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================================================
// Layer Analysis
// ============================================================================

/**
 * Analyze the current layer for buttons and toggles.
 */
async function analyzeCurrentLayer(page: Page): Promise<LayerAnalysis> {
  const result: LayerAnalysis = { toggles: [] };

  // Find buttons with shadow DOM piercing
  const buttons = await findButtonsWithShadow(page);

  for (const btn of buttons) {
    const text = btn.text.toLowerCase().trim();
    const classification = classifyButtonText(text);

    if (classification === "reject" && !result.rejectButton) {
      result.rejectButton = { text: btn.text.slice(0, 80), locator: btn.locator };
    } else if (classification === "save" && !result.saveButton) {
      result.saveButton = { text: btn.text.slice(0, 80), locator: btn.locator };
    } else if (classification === "advanced" && !result.advancedButton) {
      result.advancedButton = { text: btn.text.slice(0, 80), locator: btn.locator };
    }
  }

  // Find toggles
  result.toggles = await findToggles(page);

  return result;
}

/**
 * Find clickable buttons, including those in shadow DOM.
 */
async function findButtonsWithShadow(
  page: Page
): Promise<Array<{ text: string; locator: Locator }>> {
  const buttons: Array<{ text: string; locator: Locator }> = [];

  // Standard buttons first
  const standardButtons = page.locator("button, [role='button'], a");
  const count = await standardButtons.count();

  for (let i = 0; i < Math.min(count, 100); i++) {
    const btn = standardButtons.nth(i);
    try {
      const isVisible = await btn.isVisible();
      if (!isVisible) continue;

      const text = await btn.innerText().catch(() => "");
      if (!text.trim()) continue;

      buttons.push({ text: text.trim(), locator: btn });
    } catch {
      // Skip inaccessible elements
    }
  }

  // Try shadow DOM piercing for known CMPs
  for (const hostSelector of SHADOW_HOSTS) {
    try {
      const shadowButtons = page.locator(`${hostSelector} >> shadow >> button`);
      const shadowCount = await shadowButtons.count();

      for (let i = 0; i < Math.min(shadowCount, 50); i++) {
        const btn = shadowButtons.nth(i);
        try {
          const isVisible = await btn.isVisible();
          if (!isVisible) continue;

          const text = await btn.innerText().catch(() => "");
          if (!text.trim()) continue;

          buttons.push({ text: text.trim(), locator: btn });
        } catch {
          // Skip inaccessible elements
        }
      }
    } catch {
      // Shadow host doesn't exist or not supported
    }
  }

  return buttons;
}

/**
 * Find toggle switches in the current layer.
 */
async function findToggles(page: Page): Promise<ToggleInfo[]> {
  const toggles: ToggleInfo[] = [];

  // Common toggle selectors
  const toggleSelectors = [
    'input[type="checkbox"]',
    '[role="switch"]',
    '[class*="toggle"]',
    '[class*="switch"]',
  ];

  for (const selector of toggleSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < Math.min(count, 30); i++) {
        const el = elements.nth(i);
        try {
          const isVisible = await el.isVisible();
          if (!isVisible) continue;

          const isOn = await isToggleOn(el);
          const label = await getToggleLabel(el, page);

          toggles.push({
            label: label.slice(0, 80),
            selector: `${selector}:nth(${i})`,
            isOn,
            locator: el,
          });
        } catch {
          // Skip inaccessible elements
        }
      }
    } catch {
      // Selector failed
    }
  }

  return toggles;
}

/**
 * Determine if a toggle is currently ON.
 */
async function isToggleOn(toggle: Locator): Promise<boolean> {
  // Check checkbox state
  const isChecked = await toggle.isChecked().catch(() => null);
  if (isChecked !== null) return isChecked;

  // Check aria-checked
  const ariaChecked = await toggle.getAttribute("aria-checked");
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;

  // Check for active/on classes
  const classList = await toggle.evaluate((el) => Array.from(el.classList)).catch(() => []);
  const activeClasses = ["active", "on", "enabled", "checked", "selected"];
  return activeClasses.some((cls) => classList.some((c) => c.toLowerCase().includes(cls)));
}

/**
 * Get a human-readable label for a toggle.
 */
async function getToggleLabel(toggle: Locator, page: Page): Promise<string> {
  // Check aria-label
  const ariaLabel = await toggle.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // Check associated label element
  const id = await toggle.getAttribute("id");
  if (id) {
    const label = page.locator(`label[for="${id}"]`);
    const labelText = await label.innerText().catch(() => "");
    if (labelText) return labelText.trim();
  }

  // Check parent text
  const parent = toggle.locator("..");
  const parentText = await parent.innerText().catch(() => "");
  if (parentText) {
    // Take first line, max 80 chars
    return parentText.split("\n")[0].trim().slice(0, 80);
  }

  return "Unknown toggle";
}

// ============================================================================
// Findings Generation
// ============================================================================

/**
 * Generate findings based on rejection flow results.
 */
export function generateRejectionFindings(
  result: RejectionFlowResult
): ConsentFinding[] {
  const findings: ConsentFinding[] = [];

  if (!result.success) {
    findings.push({
      id: "friction.rejection.failed",
      title: "Could not complete rejection flow",
      severity: "info",
      category: "friction",
      detail: result.error || "Unknown error navigating preference layers",
    });
    return findings;
  }

  // Multi-layer warning (3+ clicks)
  if (result.totalClicks >= 3 && result.totalClicks < 5) {
    findings.push({
      id: "friction.rejection.multi_layer",
      title: `${result.totalClicks} clicks required to reject tracking`,
      severity: "warn",
      category: "friction",
      detail:
        "Rejecting all tracking requires navigating through multiple layers. " +
        "This adds friction compared to a single-click accept option.",
    });
  }

  // Excessive clicks (5+)
  if (result.totalClicks >= 5) {
    findings.push({
      id: "friction.rejection.excessive",
      title: `${result.totalClicks} clicks required to reject tracking`,
      severity: "fail",
      category: "friction",
      detail:
        "Excessive clicks required to reject tracking. This is a dark pattern " +
        "that violates the principle of equal ease for consent choices.",
    });
  }

  // Toggle maze (4+ toggle clicks)
  if (result.toggleClicks >= 4) {
    findings.push({
      id: "friction.rejection.toggle_maze",
      title: `${result.toggleClicks} toggles must be manually disabled`,
      severity: "fail",
      category: "friction",
      detail:
        "Users must manually disable multiple toggle switches to reject tracking. " +
        "This is a dark pattern - a 'Reject All' button should be provided.",
    });
  }

  // Hidden reject (depth 3+)
  const maxDepth = Math.max(...result.path.map((p) => p.depth), 0);
  if (maxDepth >= 3) {
    findings.push({
      id: "friction.rejection.hidden",
      title: "Reject option hidden in deep preference layers",
      severity: "warn",
      category: "friction",
      detail: `The reject option is located ${maxDepth} layers deep in the preference UI. ` +
        "This makes it difficult for users to find and exercise their right to refuse tracking.",
    });
  }

  return findings;
}
