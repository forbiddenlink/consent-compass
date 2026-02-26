import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initDb, saveScan, getDomainsForRescan, getDomainLatestScan } from "./db";
import { detectRegression } from "./rescan";
import type { ScanResult } from "./types";

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

describe("detectRegression", () => {
  it("returns false when previous score is null", () => {
    const result = detectRegression(null, 75);
    expect(result.regression).toBe(false);
    expect(result.regressionAmount).toBeUndefined();
  });

  it("returns false when score improved", () => {
    const result = detectRegression(70, 80);
    expect(result.regression).toBe(false);
  });

  it("returns false when score stayed the same", () => {
    const result = detectRegression(75, 75);
    expect(result.regression).toBe(false);
  });

  it("returns false when score dropped less than 10 points", () => {
    const result = detectRegression(75, 70);
    expect(result.regression).toBe(false);
  });

  it("returns true when score dropped exactly 10 points", () => {
    const result = detectRegression(80, 70);
    expect(result.regression).toBe(true);
    expect(result.regressionAmount).toBe(10);
  });

  it("returns true when score dropped more than 10 points", () => {
    const result = detectRegression(90, 60);
    expect(result.regression).toBe(true);
    expect(result.regressionAmount).toBe(30);
  });

  it("handles edge case of score dropping to 0", () => {
    const result = detectRegression(50, 0);
    expect(result.regression).toBe(true);
    expect(result.regressionAmount).toBe(50);
  });
});

describe("getDomainsForRescan", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("returns empty array when no scans exist", () => {
    const domains = getDomainsForRescan(10, db);
    expect(domains).toHaveLength(0);
  });

  it("returns domains ordered by oldest scan first", () => {
    // Add scans in non-chronological order
    saveScan(
      createMockScanResult({
        url: "https://recent.com/",
        scannedAt: "2024-01-03T10:00:00Z",
      }),
      db
    );
    saveScan(
      createMockScanResult({
        url: "https://oldest.com/",
        scannedAt: "2024-01-01T10:00:00Z",
      }),
      db
    );
    saveScan(
      createMockScanResult({
        url: "https://middle.com/",
        scannedAt: "2024-01-02T10:00:00Z",
      }),
      db
    );

    const domains = getDomainsForRescan(10, db);

    expect(domains).toHaveLength(3);
    expect(domains[0].domain).toBe("oldest.com");
    expect(domains[1].domain).toBe("middle.com");
    expect(domains[2].domain).toBe("recent.com");
  });

  it("respects limit parameter", () => {
    saveScan(
      createMockScanResult({
        url: "https://a.com/",
        scannedAt: "2024-01-01T10:00:00Z",
      }),
      db
    );
    saveScan(
      createMockScanResult({
        url: "https://b.com/",
        scannedAt: "2024-01-02T10:00:00Z",
      }),
      db
    );
    saveScan(
      createMockScanResult({
        url: "https://c.com/",
        scannedAt: "2024-01-03T10:00:00Z",
      }),
      db
    );

    const domains = getDomainsForRescan(2, db);

    expect(domains).toHaveLength(2);
    expect(domains[0].domain).toBe("a.com");
    expect(domains[1].domain).toBe("b.com");
  });

  it("returns most recent scan for domains with multiple scans", () => {
    // Add multiple scans for same domain
    saveScan(
      createMockScanResult({
        url: "https://example.com/old",
        scannedAt: "2024-01-01T10:00:00Z",
        score: { overall: 60, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
      }),
      db
    );
    saveScan(
      createMockScanResult({
        url: "https://example.com/new",
        scannedAt: "2024-01-03T10:00:00Z",
        score: { overall: 80, choiceSymmetry: 85, preConsentSignals: 75, accessibility: 85, transparency: 75 },
      }),
      db
    );

    const domains = getDomainsForRescan(10, db);

    expect(domains).toHaveLength(1);
    expect(domains[0].domain).toBe("example.com");
    expect(domains[0].lastScanAt).toBe("2024-01-03T10:00:00Z");
    expect(domains[0].url).toBe("https://example.com/new");
    expect(domains[0].lastScore).toBe(80);
  });

  it("includes all required fields in result", () => {
    const scanId = saveScan(
      createMockScanResult({
        url: "https://test.com/page",
        scannedAt: "2024-01-15T12:00:00Z",
        score: { overall: 72, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
      }),
      db
    );

    const domains = getDomainsForRescan(10, db);

    expect(domains).toHaveLength(1);
    expect(domains[0]).toEqual({
      domain: "test.com",
      url: "https://test.com/page",
      lastScanAt: "2024-01-15T12:00:00Z",
      lastScanId: scanId,
      lastScore: 72,
    });
  });
});

describe("getDomainLatestScan", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("returns null for unknown domain", () => {
    const result = getDomainLatestScan("unknown.com", db);
    expect(result).toBeNull();
  });

  it("returns latest scan for known domain", () => {
    // Add multiple scans for same domain
    saveScan(
      createMockScanResult({
        url: "https://example.com/old",
        scannedAt: "2024-01-01T10:00:00Z",
        score: { overall: 60, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
      }),
      db
    );
    const latestId = saveScan(
      createMockScanResult({
        url: "https://example.com/latest",
        scannedAt: "2024-01-05T10:00:00Z",
        score: { overall: 85, choiceSymmetry: 85, preConsentSignals: 85, accessibility: 85, transparency: 85 },
      }),
      db
    );
    saveScan(
      createMockScanResult({
        url: "https://example.com/middle",
        scannedAt: "2024-01-03T10:00:00Z",
        score: { overall: 70, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
      }),
      db
    );

    const result = getDomainLatestScan("example.com", db);

    expect(result).not.toBeNull();
    expect(result!.lastScanId).toBe(latestId);
    expect(result!.url).toBe("https://example.com/latest");
    expect(result!.lastScore).toBe(85);
  });

  it("returns correct data for specific domain among many", () => {
    saveScan(
      createMockScanResult({
        url: "https://other.com/",
        scannedAt: "2024-01-01T10:00:00Z",
      }),
      db
    );
    const targetId = saveScan(
      createMockScanResult({
        url: "https://target.com/page",
        scannedAt: "2024-01-02T10:00:00Z",
        score: { overall: 77, choiceSymmetry: 80, preConsentSignals: 75, accessibility: 80, transparency: 73 },
      }),
      db
    );

    const result = getDomainLatestScan("target.com", db);

    expect(result).toEqual({
      domain: "target.com",
      url: "https://target.com/page",
      lastScanAt: "2024-01-02T10:00:00Z",
      lastScanId: targetId,
      lastScore: 77,
    });
  });
});
