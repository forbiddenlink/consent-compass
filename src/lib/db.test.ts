import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  initDb,
  saveScan,
  getScansByDomain,
  getScanById,
  getAllDomains,
  extractDomain,
  deleteScan,
} from "./db";
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

describe("extractDomain", () => {
  it("extracts domain from valid HTTPS URL", () => {
    expect(extractDomain("https://example.com/page")).toBe("example.com");
  });

  it("extracts domain from valid HTTP URL", () => {
    expect(extractDomain("http://example.com/page?q=1")).toBe("example.com");
  });

  it("handles URLs with subdomains", () => {
    expect(extractDomain("https://www.subdomain.example.com/")).toBe(
      "www.subdomain.example.com"
    );
  });

  it("handles URLs with ports", () => {
    // Note: extractDomain uses URL.hostname which excludes port
    // This is intentional for grouping - same domain on different ports should group together
    expect(extractDomain("https://example.com:8080/path")).toBe("example.com");
  });

  it("handles invalid URLs gracefully", () => {
    expect(extractDomain("not-a-url")).toBe("not-a-url");
  });
});

describe("Database operations", () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = initDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("initDb", () => {
    it("creates scans table", () => {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='scans'"
        )
        .get();
      expect(tables).toEqual({ name: "scans" });
    });

    it("creates index on domain and scanned_at", () => {
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_domain_date'"
        )
        .get();
      expect(indexes).toEqual({ name: "idx_domain_date" });
    });
  });

  describe("saveScan", () => {
    it("saves a scan result and returns ID", () => {
      const result = createMockScanResult();
      const id = saveScan(result, db);

      expect(id).toBe(1);
    });

    it("saves multiple scans with incrementing IDs", () => {
      const result1 = createMockScanResult({ url: "https://example1.com/" });
      const result2 = createMockScanResult({ url: "https://example2.com/" });

      const id1 = saveScan(result1, db);
      const id2 = saveScan(result2, db);

      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    it("stores null score for non-ok status", () => {
      const result = createMockScanResult({
        status: "error",
        url: "https://error.com/",
      });
      const id = saveScan(result, db);

      const row = db
        .prepare("SELECT score FROM scans WHERE id = ?")
        .get(id) as { score: number | null };
      expect(row.score).toBeNull();
    });

    it("stores the full result as JSON", () => {
      const result = createMockScanResult({
        findings: [
          {
            id: "test-finding",
            title: "Test Finding",
            severity: "warn",
            detail: "A test finding",
          },
        ],
      });
      const id = saveScan(result, db);

      const row = db.prepare("SELECT result FROM scans WHERE id = ?").get(id) as {
        result: string;
      };
      const parsed = JSON.parse(row.result);

      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0].id).toBe("test-finding");
    });
  });

  describe("getScanById", () => {
    it("returns full ScanResult for existing ID", () => {
      const originalResult = createMockScanResult({
        url: "https://test.com/",
        score: { overall: 80, choiceSymmetry: 85, preConsentSignals: 75, accessibility: 90, transparency: 70 },
      });
      const id = saveScan(originalResult, db);

      const retrieved = getScanById(id, db);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.url).toBe("https://test.com/");
      expect(retrieved!.score.overall).toBe(80);
    });

    it("returns null for non-existent ID", () => {
      const result = getScanById(999, db);
      expect(result).toBeNull();
    });
  });

  describe("getScansByDomain", () => {
    beforeEach(() => {
      // Add multiple scans for the same domain
      const dates = [
        "2024-01-01T10:00:00Z",
        "2024-01-02T10:00:00Z",
        "2024-01-03T10:00:00Z",
      ];

      dates.forEach((date, i) => {
        saveScan(
          createMockScanResult({
            url: "https://example.com/page" + i,
            scannedAt: date,
            score: { overall: 60 + i * 10, choiceSymmetry: 70, preConsentSignals: 70, accessibility: 70, transparency: 70 },
          }),
          db
        );
      });

      // Add scan for different domain
      saveScan(
        createMockScanResult({
          url: "https://other.com/",
          scannedAt: "2024-01-04T10:00:00Z",
        }),
        db
      );
    });

    it("returns scans for specified domain", () => {
      const scans = getScansByDomain("example.com", undefined, db);

      expect(scans).toHaveLength(3);
      scans.forEach((scan) => {
        expect(scan.domain).toBe("example.com");
      });
    });

    it("returns scans ordered by date descending", () => {
      const scans = getScansByDomain("example.com", undefined, db);

      expect(scans[0].scannedAt).toBe("2024-01-03T10:00:00Z");
      expect(scans[1].scannedAt).toBe("2024-01-02T10:00:00Z");
      expect(scans[2].scannedAt).toBe("2024-01-01T10:00:00Z");
    });

    it("respects limit parameter", () => {
      const scans = getScansByDomain("example.com", 2, db);

      expect(scans).toHaveLength(2);
      // Should be most recent ones
      expect(scans[0].scannedAt).toBe("2024-01-03T10:00:00Z");
      expect(scans[1].scannedAt).toBe("2024-01-02T10:00:00Z");
    });

    it("returns empty array for unknown domain", () => {
      const scans = getScansByDomain("unknown.com", undefined, db);
      expect(scans).toHaveLength(0);
    });

    it("returns StoredScan shape (not full result)", () => {
      const scans = getScansByDomain("example.com", 1, db);

      expect(scans[0]).toHaveProperty("id");
      expect(scans[0]).toHaveProperty("url");
      expect(scans[0]).toHaveProperty("domain");
      expect(scans[0]).toHaveProperty("scannedAt");
      expect(scans[0]).toHaveProperty("score");
      expect(scans[0]).toHaveProperty("status");
      expect(scans[0]).not.toHaveProperty("findings");
      expect(scans[0]).not.toHaveProperty("meta");
    });
  });

  describe("getAllDomains", () => {
    beforeEach(() => {
      // Add scans for multiple domains
      saveScan(
        createMockScanResult({
          url: "https://example.com/1",
          scannedAt: "2024-01-01T10:00:00Z",
        }),
        db
      );
      saveScan(
        createMockScanResult({
          url: "https://example.com/2",
          scannedAt: "2024-01-03T10:00:00Z",
        }),
        db
      );
      saveScan(
        createMockScanResult({
          url: "https://other.com/",
          scannedAt: "2024-01-02T10:00:00Z",
        }),
        db
      );
    });

    it("returns all unique domains", () => {
      const domains = getAllDomains(db);

      expect(domains).toHaveLength(2);
      const domainNames = domains.map((d) => d.domain);
      expect(domainNames).toContain("example.com");
      expect(domainNames).toContain("other.com");
    });

    it("returns scan count per domain", () => {
      const domains = getAllDomains(db);

      const exampleDomain = domains.find((d) => d.domain === "example.com");
      const otherDomain = domains.find((d) => d.domain === "other.com");

      expect(exampleDomain!.scanCount).toBe(2);
      expect(otherDomain!.scanCount).toBe(1);
    });

    it("returns latest scan date per domain", () => {
      const domains = getAllDomains(db);

      const exampleDomain = domains.find((d) => d.domain === "example.com");
      expect(exampleDomain!.latestScan).toBe("2024-01-03T10:00:00Z");
    });

    it("orders domains by latest scan descending", () => {
      const domains = getAllDomains(db);

      // example.com has latest scan on Jan 3, so it should be first
      expect(domains[0].domain).toBe("example.com");
      expect(domains[1].domain).toBe("other.com");
    });
  });

  describe("deleteScan", () => {
    it("deletes existing scan and returns true", () => {
      const result = createMockScanResult();
      const id = saveScan(result, db);

      const deleted = deleteScan(id, db);

      expect(deleted).toBe(true);
      expect(getScanById(id, db)).toBeNull();
    });

    it("returns false for non-existent ID", () => {
      const deleted = deleteScan(999, db);
      expect(deleted).toBe(false);
    });
  });
});
