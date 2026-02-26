/**
 * Tests for multi-layer CMP rejection flow measurement.
 */

import { describe, it, expect } from "vitest";
import { generateRejectionFindings, type RejectionFlowResult, type RejectionStep } from "./rejection-flow";

// ============================================================================
// Test: generateRejectionFindings()
// ============================================================================

describe("generateRejectionFindings", () => {
  describe("failure cases", () => {
    it("returns info finding when flow failed", () => {
      const result: RejectionFlowResult = {
        success: false,
        rejectClicks: 1,
        toggleClicks: 0,
        totalClicks: 1,
        path: [{ action: "click", target: "Manage", selector: "btn", depth: 1 }],
        maxDepthReached: false,
        error: "No actionable buttons found",
      };

      const findings = generateRejectionFindings(result);

      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe("friction.rejection.failed");
      expect(findings[0].severity).toBe("info");
      expect(findings[0].detail).toContain("No actionable buttons found");
    });

    it("includes error message in finding detail", () => {
      const result: RejectionFlowResult = {
        success: false,
        rejectClicks: 0,
        toggleClicks: 0,
        totalClicks: 0,
        path: [],
        maxDepthReached: true,
        error: "Max depth of 4 reached",
      };

      const findings = generateRejectionFindings(result);

      expect(findings[0].detail).toBe("Max depth of 4 reached");
    });
  });

  describe("multi-layer warning (3-4 clicks)", () => {
    it("warns when 3 clicks required", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 3,
        toggleClicks: 0,
        totalClicks: 3,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Advanced", selector: "btn", depth: 2 },
          { action: "click", target: "Reject All", selector: "btn", depth: 3 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const multiLayer = findings.find((f) => f.id === "friction.rejection.multi_layer");
      expect(multiLayer).toBeDefined();
      expect(multiLayer!.severity).toBe("warn");
      expect(multiLayer!.title).toContain("3 clicks");
    });

    it("warns when 4 clicks required", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 4,
        toggleClicks: 0,
        totalClicks: 4,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Advanced", selector: "btn", depth: 2 },
          { action: "click", target: "Options", selector: "btn", depth: 3 },
          { action: "click", target: "Reject", selector: "btn", depth: 4 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const multiLayer = findings.find((f) => f.id === "friction.rejection.multi_layer");
      expect(multiLayer).toBeDefined();
      expect(multiLayer!.title).toContain("4 clicks");
    });

    it("does not warn for 2 clicks", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 2,
        toggleClicks: 0,
        totalClicks: 2,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Reject All", selector: "btn", depth: 2 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      expect(findings.find((f) => f.id === "friction.rejection.multi_layer")).toBeUndefined();
    });
  });

  describe("excessive clicks (5+)", () => {
    it("fails when 5 clicks required", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 3,
        toggleClicks: 2,
        totalClicks: 5,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "toggle", target: "Marketing", selector: "chk", depth: 2 },
          { action: "toggle", target: "Analytics", selector: "chk", depth: 2 },
          { action: "click", target: "Advanced", selector: "btn", depth: 2 },
          { action: "click", target: "Save", selector: "btn", depth: 3 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const excessive = findings.find((f) => f.id === "friction.rejection.excessive");
      expect(excessive).toBeDefined();
      expect(excessive!.severity).toBe("fail");
      expect(excessive!.title).toContain("5 clicks");
    });

    it("fails when 7 clicks required", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 3,
        toggleClicks: 4,
        totalClicks: 7,
        path: [],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const excessive = findings.find((f) => f.id === "friction.rejection.excessive");
      expect(excessive).toBeDefined();
      expect(excessive!.title).toContain("7 clicks");
    });
  });

  describe("toggle maze (4+ toggles)", () => {
    it("fails when 4 toggles must be disabled", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 2,
        toggleClicks: 4,
        totalClicks: 6,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "toggle", target: "Marketing", selector: "chk", depth: 2 },
          { action: "toggle", target: "Analytics", selector: "chk", depth: 2 },
          { action: "toggle", target: "Personalization", selector: "chk", depth: 2 },
          { action: "toggle", target: "Social", selector: "chk", depth: 2 },
          { action: "click", target: "Save", selector: "btn", depth: 2 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const toggleMaze = findings.find((f) => f.id === "friction.rejection.toggle_maze");
      expect(toggleMaze).toBeDefined();
      expect(toggleMaze!.severity).toBe("fail");
      expect(toggleMaze!.title).toContain("4 toggles");
    });

    it("does not fail for 3 toggles", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 2,
        toggleClicks: 3,
        totalClicks: 5,
        path: [],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      expect(findings.find((f) => f.id === "friction.rejection.toggle_maze")).toBeUndefined();
    });
  });

  describe("hidden reject (depth 3+)", () => {
    it("warns when reject is at depth 3", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 3,
        toggleClicks: 0,
        totalClicks: 3,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Advanced", selector: "btn", depth: 2 },
          { action: "click", target: "Reject All", selector: "btn", depth: 3 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const hidden = findings.find((f) => f.id === "friction.rejection.hidden");
      expect(hidden).toBeDefined();
      expect(hidden!.severity).toBe("warn");
      expect(hidden!.detail).toContain("3 layers deep");
    });

    it("warns when reject is at depth 4", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 4,
        toggleClicks: 0,
        totalClicks: 4,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Advanced", selector: "btn", depth: 2 },
          { action: "click", target: "Options", selector: "btn", depth: 3 },
          { action: "click", target: "Reject", selector: "btn", depth: 4 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      const hidden = findings.find((f) => f.id === "friction.rejection.hidden");
      expect(hidden).toBeDefined();
      expect(hidden!.detail).toContain("4 layers deep");
    });

    it("does not warn when reject is at depth 2", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 2,
        toggleClicks: 0,
        totalClicks: 2,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Reject All", selector: "btn", depth: 2 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      expect(findings.find((f) => f.id === "friction.rejection.hidden")).toBeUndefined();
    });
  });

  describe("combined findings", () => {
    it("can produce multiple findings for egregious UX", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 4,
        toggleClicks: 5,
        totalClicks: 9,
        path: [
          { action: "click", target: "Manage", selector: "btn", depth: 1 },
          { action: "click", target: "Advanced", selector: "btn", depth: 2 },
          { action: "click", target: "Options", selector: "btn", depth: 3 },
          { action: "toggle", target: "Marketing", selector: "chk", depth: 4 },
          { action: "toggle", target: "Analytics", selector: "chk", depth: 4 },
          { action: "toggle", target: "Social", selector: "chk", depth: 4 },
          { action: "toggle", target: "Personalization", selector: "chk", depth: 4 },
          { action: "toggle", target: "Partners", selector: "chk", depth: 4 },
          { action: "click", target: "Save", selector: "btn", depth: 4 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      // Should have excessive, toggle_maze, and hidden findings
      expect(findings.find((f) => f.id === "friction.rejection.excessive")).toBeDefined();
      expect(findings.find((f) => f.id === "friction.rejection.toggle_maze")).toBeDefined();
      expect(findings.find((f) => f.id === "friction.rejection.hidden")).toBeDefined();
      expect(findings.length).toBe(3);
    });

    it("returns empty array for ideal 2-click rejection", () => {
      const result: RejectionFlowResult = {
        success: true,
        rejectClicks: 2,
        toggleClicks: 0,
        totalClicks: 2,
        path: [
          { action: "click", target: "Manage Preferences", selector: "btn", depth: 1 },
          { action: "click", target: "Reject All", selector: "btn", depth: 2 },
        ],
        maxDepthReached: false,
      };

      const findings = generateRejectionFindings(result);

      expect(findings).toHaveLength(0);
    });
  });
});

// ============================================================================
// Test: RejectionStep type structure
// ============================================================================

describe("RejectionStep", () => {
  it("supports click action", () => {
    const step: RejectionStep = {
      action: "click",
      target: "Reject All",
      selector: "#reject-btn",
      depth: 2,
    };
    expect(step.action).toBe("click");
  });

  it("supports toggle action", () => {
    const step: RejectionStep = {
      action: "toggle",
      target: "Marketing cookies",
      selector: 'input[type="checkbox"]:nth(0)',
      depth: 2,
    };
    expect(step.action).toBe("toggle");
  });
});

// ============================================================================
// Test: RejectionFlowResult type structure
// ============================================================================

describe("RejectionFlowResult", () => {
  it("tracks click counts correctly", () => {
    const result: RejectionFlowResult = {
      success: true,
      rejectClicks: 2,
      toggleClicks: 3,
      totalClicks: 5,
      path: [],
      maxDepthReached: false,
    };

    expect(result.rejectClicks + result.toggleClicks).toBe(result.totalClicks);
  });

  it("includes error for failed flows", () => {
    const result: RejectionFlowResult = {
      success: false,
      rejectClicks: 1,
      toggleClicks: 0,
      totalClicks: 1,
      path: [],
      maxDepthReached: false,
      error: "Element detached from DOM",
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
