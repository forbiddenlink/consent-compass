import { describe, it, expect } from "vitest";
import { diffScans, type ScanDiff } from "./diff";
import type { ScanResult, CategorizedCookie, ConsentFinding, TrackedRequest } from "./types";

// Helper to create a minimal valid ScanResult
function createMockScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    status: "ok",
    url: "https://example.com/",
    scannedAt: new Date().toISOString(),
    score: {
      overall: 75,
      choiceSymmetry: 80,
      preConsentSignals: 70,
      accessibility: 85,
      transparency: 65,
    },
    banner: {
      detected: true,
      confidence: 0.95,
      selectors: [".cookie-banner"],
      acceptButtons: ["#accept"],
      rejectButtons: ["#reject"],
      managePrefsButtons: [],
    },
    friction: {
      acceptClicks: 1,
      rejectClicks: 2,
      acceptPath: ["#accept"],
      rejectPath: ["#manage", "#reject-all"],
      asymmetryScore: 30,
      notes: [],
    },
    preConsent: {
      cookies: [],
      requests: [],
    },
    artifacts: {},
    findings: [],
    meta: {
      userAgent: "test-agent",
      tookMs: 1234,
      scannerVersion: "1.0.0",
    },
    ...overrides,
  };
}

function createCookie(name: string, category: CategorizedCookie["category"] = "analytics", domain?: string): CategorizedCookie {
  return {
    name,
    category,
    domain,
  };
}

function createFinding(id: string, severity: ConsentFinding["severity"] = "warn"): ConsentFinding {
  return {
    id,
    title: `Finding: ${id}`,
    severity,
    detail: `Detail for ${id}`,
  };
}

function createTracker(url: string, domain: string, isTracker: boolean = true): TrackedRequest {
  return {
    url,
    domain,
    resourceType: "script",
    isTracker,
    trackerCategory: "analytics",
    vendor: "Analytics Co",
  };
}

describe("diffScans", () => {
  describe("score changes", () => {
    it("detects score improvement", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        score: { overall: 60, choiceSymmetry: 60, preConsentSignals: 60, accessibility: 60, transparency: 60 },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        score: { overall: 80, choiceSymmetry: 80, preConsentSignals: 80, accessibility: 80, transparency: 80 },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.scoreChange.direction).toBe("improved");
      expect(diff.scoreChange.delta).toBe(20);
      expect(diff.scoreChange.oldScore).toBe(60);
      expect(diff.scoreChange.newScore).toBe(80);
    });

    it("detects score regression", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        score: { overall: 80, choiceSymmetry: 80, preConsentSignals: 80, accessibility: 80, transparency: 80 },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        score: { overall: 50, choiceSymmetry: 50, preConsentSignals: 50, accessibility: 50, transparency: 50 },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.scoreChange.direction).toBe("regressed");
      expect(diff.scoreChange.delta).toBe(-30);
    });

    it("detects unchanged score", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        score: { overall: 75, choiceSymmetry: 75, preConsentSignals: 75, accessibility: 75, transparency: 75 },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        score: { overall: 75, choiceSymmetry: 75, preConsentSignals: 75, accessibility: 75, transparency: 75 },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.scoreChange.direction).toBe("unchanged");
      expect(diff.scoreChange.delta).toBe(0);
    });

    it("handles non-ok status with zero score", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        status: "error",
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        score: { overall: 70, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.scoreChange.oldScore).toBe(0);
      expect(diff.scoreChange.newScore).toBe(70);
      expect(diff.scoreChange.direction).toBe("improved");
    });
  });

  describe("cookie changes", () => {
    it("detects added cookies", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: { cookies: [], requests: [] },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: {
          cookies: [
            createCookie("_ga", "analytics"),
            createCookie("_fbp", "marketing"),
          ],
          requests: [],
        },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.cookiesAdded).toHaveLength(2);
      expect(diff.cookiesAdded.map((c) => c.name)).toContain("_ga");
      expect(diff.cookiesAdded.map((c) => c.name)).toContain("_fbp");
      expect(diff.cookiesRemoved).toHaveLength(0);
    });

    it("detects removed cookies", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: {
          cookies: [
            createCookie("_ga", "analytics"),
            createCookie("tracking", "marketing"),
          ],
          requests: [],
        },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: { cookies: [], requests: [] },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.cookiesRemoved).toHaveLength(2);
      expect(diff.cookiesAdded).toHaveLength(0);
    });

    it("detects both added and removed cookies", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: {
          cookies: [createCookie("old_cookie", "analytics")],
          requests: [],
        },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: {
          cookies: [createCookie("new_cookie", "marketing")],
          requests: [],
        },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.cookiesAdded).toHaveLength(1);
      expect(diff.cookiesAdded[0].name).toBe("new_cookie");
      expect(diff.cookiesRemoved).toHaveLength(1);
      expect(diff.cookiesRemoved[0].name).toBe("old_cookie");
    });

    it("ignores unchanged cookies", () => {
      const sharedCookie = createCookie("session", "necessary");
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: { cookies: [sharedCookie], requests: [] },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: { cookies: [sharedCookie], requests: [] },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.cookiesAdded).toHaveLength(0);
      expect(diff.cookiesRemoved).toHaveLength(0);
    });

    it("distinguishes cookies by domain", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: {
          cookies: [createCookie("track", "analytics", "example.com")],
          requests: [],
        },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: {
          cookies: [createCookie("track", "analytics", "other.com")],
          requests: [],
        },
      });

      const diff = diffScans(scan1, scan2);

      // Same name but different domain = different cookies
      expect(diff.cookiesAdded).toHaveLength(1);
      expect(diff.cookiesAdded[0].domain).toBe("other.com");
      expect(diff.cookiesRemoved).toHaveLength(1);
      expect(diff.cookiesRemoved[0].domain).toBe("example.com");
    });
  });

  describe("finding changes", () => {
    it("detects new findings (added)", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        findings: [],
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        findings: [
          createFinding("dark-pattern-1", "fail"),
          createFinding("missing-reject", "warn"),
        ],
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.findingsAdded).toHaveLength(2);
      expect(diff.findingsAdded.map((f) => f.id)).toContain("dark-pattern-1");
      expect(diff.findingsResolved).toHaveLength(0);
    });

    it("detects resolved findings (removed)", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        findings: [
          createFinding("old-issue", "fail"),
        ],
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        findings: [],
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.findingsResolved).toHaveLength(1);
      expect(diff.findingsResolved[0].id).toBe("old-issue");
      expect(diff.findingsAdded).toHaveLength(0);
    });

    it("preserves finding severity in diff", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        findings: [createFinding("critical-issue", "fail")],
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        findings: [],
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.findingsResolved[0].severity).toBe("fail");
    });
  });

  describe("tracker changes", () => {
    it("detects added trackers", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: { cookies: [], requests: [] },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: {
          cookies: [],
          requests: [
            createTracker("https://analytics.com/track.js", "analytics.com"),
          ],
        },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.trackersAdded).toHaveLength(1);
      expect(diff.trackersAdded[0].domain).toBe("analytics.com");
      expect(diff.trackersRemoved).toHaveLength(0);
    });

    it("detects removed trackers", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: {
          cookies: [],
          requests: [
            createTracker("https://bad-tracker.com/spy.js", "bad-tracker.com"),
          ],
        },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: { cookies: [], requests: [] },
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.trackersRemoved).toHaveLength(1);
      expect(diff.trackersRemoved[0].domain).toBe("bad-tracker.com");
    });

    it("ignores non-tracker requests", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        preConsent: {
          cookies: [],
          requests: [
            createTracker("https://cdn.com/style.css", "cdn.com", false),
          ],
        },
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        preConsent: { cookies: [], requests: [] },
      });

      const diff = diffScans(scan1, scan2);

      // Non-tracker request should not appear in tracker diff
      expect(diff.trackersRemoved).toHaveLength(0);
    });
  });

  describe("summary", () => {
    it("correctly summarizes changes", () => {
      const scan1 = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
        score: { overall: 70, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
        preConsent: {
          cookies: [createCookie("old", "analytics")],
          requests: [createTracker("https://old.com/t.js", "old.com")],
        },
        findings: [createFinding("old-finding")],
      });
      const scan2 = createMockScanResult({
        scannedAt: "2024-01-02T10:00:00Z",
        score: { overall: 80, choiceSymmetry: 80, preConsentSignals: 80, accessibility: 80, transparency: 80 },
        preConsent: {
          cookies: [createCookie("new", "marketing")],
          requests: [createTracker("https://new.com/t.js", "new.com")],
        },
        findings: [createFinding("new-finding")],
      });

      const diff = diffScans(scan1, scan2);

      expect(diff.summary.hasScoreChange).toBe(true);
      expect(diff.summary.hasCookieChanges).toBe(true);
      expect(diff.summary.hasFindingChanges).toBe(true);
      expect(diff.summary.hasTrackerChanges).toBe(true);
      // 1 cookie added + 1 removed + 1 finding added + 1 resolved + 1 tracker added + 1 removed = 6
      expect(diff.summary.totalChanges).toBe(6);
    });

    it("correctly reports no changes", () => {
      const scan = createMockScanResult({
        scannedAt: "2024-01-01T10:00:00Z",
      });

      const diff = diffScans(scan, scan);

      expect(diff.summary.hasScoreChange).toBe(false);
      expect(diff.summary.hasCookieChanges).toBe(false);
      expect(diff.summary.hasFindingChanges).toBe(false);
      expect(diff.summary.hasTrackerChanges).toBe(false);
      expect(diff.summary.totalChanges).toBe(0);
    });
  });

  describe("metadata", () => {
    it("includes scan dates", () => {
      const scan1 = createMockScanResult({ scannedAt: "2024-01-01T10:00:00Z" });
      const scan2 = createMockScanResult({ scannedAt: "2024-01-02T10:00:00Z" });

      const diff = diffScans(scan1, scan2);

      expect(diff.scan1Date).toBe("2024-01-01T10:00:00Z");
      expect(diff.scan2Date).toBe("2024-01-02T10:00:00Z");
    });

    it("includes optional scan IDs", () => {
      const scan1 = createMockScanResult({ scannedAt: "2024-01-01T10:00:00Z" });
      const scan2 = createMockScanResult({ scannedAt: "2024-01-02T10:00:00Z" });

      const diff = diffScans(scan1, scan2, 1, 2);

      expect(diff.scan1Id).toBe(1);
      expect(diff.scan2Id).toBe(2);
    });
  });
});
