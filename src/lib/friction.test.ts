import { describe, it, expect } from "vitest";
import {
  analyzeCognitiveFriction,
  calculateClickAsymmetry,
  calculateFrictionScore,
  generateFrictionFindings,
  checkHiddenReject,
} from "./friction";

describe("analyzeCognitiveFriction", () => {
  describe("guilt-tripping patterns", () => {
    it("detects 'you'll miss out' language", () => {
      const result = analyzeCognitiveFriction("You'll miss out on personalized content");
      expect(result.patterns.some(p => p.type === "guilt_trip")).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it("detects 'limited experience' language", () => {
      const result = analyzeCognitiveFriction("Without consent you'll have a limited experience");
      expect(result.patterns.some(p => p.type === "guilt_trip")).toBe(true);
    });

    it("detects 'are you sure' language", () => {
      const result = analyzeCognitiveFriction("Are you sure you want to reject?");
      expect(result.patterns.some(p => p.type === "guilt_trip")).toBe(true);
    });
  });

  describe("confusing terminology", () => {
    it("detects 'legitimate interest'", () => {
      const result = analyzeCognitiveFriction("We process data based on legitimate interest");
      expect(result.patterns.some(p => p.type === "confusing_terms")).toBe(true);
    });

    it("detects partner count language", () => {
      const result = analyzeCognitiveFriction("We share data with 147 partners");
      expect(result.patterns.some(p => p.type === "confusing_terms")).toBe(true);
    });

    it("detects 'third party' language", () => {
      const result = analyzeCognitiveFriction("Third-party cookies help us serve ads");
      expect(result.patterns.some(p => p.type === "confusing_terms")).toBe(true);
    });

    it("detects 'personalized ads' language", () => {
      const result = analyzeCognitiveFriction("Accept to receive personalized ads");
      expect(result.patterns.some(p => p.type === "confusing_terms")).toBe(true);
    });
  });

  describe("double negatives", () => {
    it("detects 'don't opt out'", () => {
      const result = analyzeCognitiveFriction("Don't opt out of our newsletters");
      expect(result.patterns.some(p => p.type === "double_negative")).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(20); // Double negatives score 20
    });

    it("detects 'don't reject'", () => {
      const result = analyzeCognitiveFriction("Please don't reject all cookies");
      expect(result.patterns.some(p => p.type === "double_negative")).toBe(true);
    });
  });

  describe("false urgency", () => {
    it("detects 'act now'", () => {
      const result = analyzeCognitiveFriction("Act now to save your preferences!");
      expect(result.patterns.some(p => p.type === "false_urgency")).toBe(true);
    });

    it("detects 'limited time'", () => {
      const result = analyzeCognitiveFriction("Limited time offer on premium content");
      expect(result.patterns.some(p => p.type === "false_urgency")).toBe(true);
    });
  });

  describe("score calculation", () => {
    it("returns 0 for clean text", () => {
      const result = analyzeCognitiveFriction("We use cookies. Accept or Reject.");
      expect(result.score).toBe(0);
      expect(result.patterns).toHaveLength(0);
    });

    it("returns 0 for empty text", () => {
      const result = analyzeCognitiveFriction("");
      expect(result.score).toBe(0);
    });

    it("caps score at 100", () => {
      // Text with many patterns
      const result = analyzeCognitiveFriction(
        "You'll miss out! Don't opt out! Act now! Our 500 partners use legitimate interest for personalized ads."
      );
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("accumulates points from multiple patterns", () => {
      const singlePattern = analyzeCognitiveFriction("You'll miss out");
      const multiplePatterns = analyzeCognitiveFriction("You'll miss out and our partners share data");
      expect(multiplePatterns.score).toBeGreaterThan(singlePattern.score);
    });
  });
});

describe("checkHiddenReject", () => {
  it("returns null when no reject button", () => {
    expect(checkHiddenReject(false, false)).toBeNull();
  });

  it("returns null when reject is a proper button", () => {
    expect(checkHiddenReject(true, false)).toBeNull();
  });

  it("returns pattern when reject is a link", () => {
    const result = checkHiddenReject(true, true);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("hidden_reject");
    expect(result?.points).toBe(15);
  });
});

describe("calculateClickAsymmetry", () => {
  it("returns 0 when clicks are equal", () => {
    expect(calculateClickAsymmetry(1, 1)).toBe(0);
  });

  it("returns 0 when reject is easier", () => {
    expect(calculateClickAsymmetry(2, 1)).toBe(0);
  });

  it("returns 33 for 1 extra click", () => {
    expect(calculateClickAsymmetry(1, 2)).toBe(33);
  });

  it("returns 66 for 2 extra clicks", () => {
    expect(calculateClickAsymmetry(1, 3)).toBe(66);
  });

  it("caps at 100 for 4+ extra clicks", () => {
    expect(calculateClickAsymmetry(1, 4)).toBe(99); // 3 * 33 = 99
    expect(calculateClickAsymmetry(1, 5)).toBe(100); // 4 * 33 = 132, capped to 100
  });

  it("returns 0 for undefined values", () => {
    expect(calculateClickAsymmetry(undefined, 1)).toBe(0);
    expect(calculateClickAsymmetry(1, undefined)).toBe(0);
    expect(calculateClickAsymmetry(undefined, undefined)).toBe(0);
  });

  it("returns 0 when both are 0", () => {
    expect(calculateClickAsymmetry(0, 0)).toBe(0);
  });
});

describe("calculateFrictionScore", () => {
  it("returns 0 for no friction", () => {
    const result = calculateFrictionScore(1, 1, 0, { score: 0, patterns: [] });
    expect(result.overall).toBe(0);
    expect(result.clickAsymmetry).toBe(0);
    expect(result.visualAsymmetry).toBe(0);
    expect(result.cognitive).toBe(0);
  });

  it("weights click asymmetry at 40%", () => {
    const result = calculateFrictionScore(1, 2, 0, { score: 0, patterns: [] });
    // 33 * 0.4 = 13.2, rounded to 13
    expect(result.overall).toBe(13);
    expect(result.clickAsymmetry).toBe(33);
  });

  it("weights visual asymmetry at 30%", () => {
    const result = calculateFrictionScore(1, 1, 100, { score: 0, patterns: [] });
    // 100 * 0.3 = 30
    expect(result.overall).toBe(30);
    expect(result.visualAsymmetry).toBe(100);
  });

  it("weights cognitive at 30%", () => {
    const result = calculateFrictionScore(1, 1, 0, { score: 100, patterns: [] });
    // 100 * 0.3 = 30
    expect(result.overall).toBe(30);
    expect(result.cognitive).toBe(100);
  });

  it("combines all factors", () => {
    const result = calculateFrictionScore(1, 2, 50, { score: 50, patterns: [] });
    // (33 * 0.4) + (50 * 0.3) + (50 * 0.3) = 13.2 + 15 + 15 = 43.2 → 43
    expect(result.overall).toBe(43);
  });
});

describe("generateFrictionFindings", () => {
  it("generates no findings for low friction", () => {
    const findings = generateFrictionFindings(
      { overall: 20, clickAsymmetry: 0, visualAsymmetry: 20, cognitive: 0 },
      { score: 0, patterns: [] }
    );
    expect(findings).toHaveLength(0);
  });

  it("generates warn finding for moderate friction (31-60)", () => {
    const findings = generateFrictionFindings(
      { overall: 45, clickAsymmetry: 33, visualAsymmetry: 30, cognitive: 20 },
      { score: 20, patterns: [] }
    );
    expect(findings.some(f => f.id === "friction.overall.moderate")).toBe(true);
    expect(findings.some(f => f.severity === "warn")).toBe(true);
  });

  it("generates fail finding for high friction (61+)", () => {
    const findings = generateFrictionFindings(
      { overall: 75, clickAsymmetry: 66, visualAsymmetry: 60, cognitive: 50 },
      { score: 50, patterns: [] }
    );
    expect(findings.some(f => f.id === "friction.overall.high")).toBe(true);
    expect(findings.some(f => f.severity === "fail")).toBe(true);
  });

  it("generates finding for guilt-trip patterns", () => {
    const findings = generateFrictionFindings(
      { overall: 15, clickAsymmetry: 0, visualAsymmetry: 0, cognitive: 15 },
      { score: 15, patterns: [{ type: "guilt_trip", match: "You'll miss out", points: 15 }] }
    );
    expect(findings.some(f => f.id === "friction.cognitive.guilt_trip")).toBe(true);
  });

  it("generates finding for confusing terms", () => {
    const findings = generateFrictionFindings(
      { overall: 10, clickAsymmetry: 0, visualAsymmetry: 0, cognitive: 10 },
      { score: 10, patterns: [{ type: "confusing_terms", match: "legitimate interest", points: 10 }] }
    );
    expect(findings.some(f => f.id === "friction.cognitive.confusing")).toBe(true);
  });

  it("generates fail finding for double negatives", () => {
    const findings = generateFrictionFindings(
      { overall: 20, clickAsymmetry: 0, visualAsymmetry: 0, cognitive: 20 },
      { score: 20, patterns: [{ type: "double_negative", match: "Don't opt out", points: 20 }] }
    );
    const doubleNegFinding = findings.find(f => f.id === "friction.cognitive.double_negative");
    expect(doubleNegFinding).toBeDefined();
    expect(doubleNegFinding?.severity).toBe("fail");
  });

  it("includes evidence with matched text", () => {
    const findings = generateFrictionFindings(
      { overall: 15, clickAsymmetry: 0, visualAsymmetry: 0, cognitive: 15 },
      { score: 15, patterns: [{ type: "guilt_trip", match: "You'll miss out", points: 15 }] }
    );
    const finding = findings.find(f => f.id === "friction.cognitive.guilt_trip");
    expect(finding?.evidence?.value).toBe("You'll miss out");
  });
});
