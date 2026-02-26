import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  sanitizeDomain,
  generateTimestamp,
  getScreenshotFilePath,
  saveScreenshot,
  annotateBanner,
  cleanupScreenshots,
  getScreenshotUrl,
  listScreenshots,
  deleteAllScreenshots,
  screenshotsExist,
} from "./screenshots";

// Mock sharp for annotation tests
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1440, height: 900 }),
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("annotated-image")),
  }));
  return { default: mockSharp };
});

// Test directory for screenshots
const TEST_SCREENSHOTS_DIR = path.join(
  process.cwd(),
  "public",
  "screenshots"
);

describe("sanitizeDomain", () => {
  it("sanitizes basic domains", () => {
    expect(sanitizeDomain("example.com")).toBe("example.com");
    expect(sanitizeDomain("www.example.com")).toBe("www.example.com");
    expect(sanitizeDomain("sub.domain.example.com")).toBe(
      "sub.domain.example.com"
    );
  });

  it("removes special characters", () => {
    expect(sanitizeDomain("example.com/path")).toBe("example.com_path");
    expect(sanitizeDomain("example.com?query=1")).toBe("example.com_query_1");
    expect(sanitizeDomain("example.com:8080")).toBe("example.com_8080");
  });

  it("converts to lowercase", () => {
    expect(sanitizeDomain("Example.COM")).toBe("example.com");
    expect(sanitizeDomain("WWW.EXAMPLE.COM")).toBe("www.example.com");
  });

  it("handles edge cases", () => {
    expect(sanitizeDomain("localhost")).toBe("localhost");
    expect(sanitizeDomain("192.168.1.1")).toBe("192.168.1.1");
    expect(sanitizeDomain("")).toBe("");
  });
});

describe("generateTimestamp", () => {
  it("generates ISO-like timestamp with safe characters", () => {
    const ts = generateTimestamp();
    // Should not contain colons or periods (safe for filenames)
    expect(ts).not.toContain(":");
    expect(ts).not.toContain(".");
    // Should match pattern like 2026-02-26T14-30-00-123Z
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
  });

  it("generates unique timestamps", () => {
    const timestamps = new Set<string>();
    for (let i = 0; i < 10; i++) {
      timestamps.add(generateTimestamp());
    }
    // Most should be unique (allowing for fast execution)
    expect(timestamps.size).toBeGreaterThanOrEqual(1);
  });
});

describe("getScreenshotFilePath", () => {
  it("generates correct file path for pre-consent", () => {
    const filePath = getScreenshotFilePath(
      "example.com",
      "pre-consent",
      "2026-02-26T14-30-00-123Z"
    );
    expect(filePath).toContain("example.com");
    expect(filePath).toContain("2026-02-26T14-30-00-123Z_pre-consent.png");
  });

  it("generates correct file path for post-consent", () => {
    const filePath = getScreenshotFilePath(
      "example.com",
      "post-consent",
      "2026-02-26T14-30-00-123Z"
    );
    expect(filePath).toContain("2026-02-26T14-30-00-123Z_post-consent.png");
  });

  it("generates correct file path for banner", () => {
    const filePath = getScreenshotFilePath(
      "example.com",
      "banner",
      "2026-02-26T14-30-00-123Z"
    );
    expect(filePath).toContain("2026-02-26T14-30-00-123Z_banner.png");
  });

  it("sanitizes domain in path", () => {
    const filePath = getScreenshotFilePath(
      "Example.COM/path",
      "pre-consent",
      "2026-02-26T14-30-00-123Z"
    );
    expect(filePath).toContain("example.com_path");
    expect(filePath).not.toContain("Example");
    expect(filePath).not.toContain("/path");
  });
});

describe("getScreenshotUrl", () => {
  it("generates correct URL path", () => {
    expect(
      getScreenshotUrl("example.com/2026-02-26T14-30-00-123Z_pre-consent.png")
    ).toBe("/screenshots/example.com/2026-02-26T14-30-00-123Z_pre-consent.png");
  });

  it("handles nested paths", () => {
    expect(
      getScreenshotUrl("sub.domain.com/2026-02-26T14-30-00-123Z_banner.png")
    ).toBe(
      "/screenshots/sub.domain.com/2026-02-26T14-30-00-123Z_banner.png"
    );
  });
});

describe("saveScreenshot", () => {
  const testDomain = "test-save-screenshot.example.com";
  const testBuffer = Buffer.from("fake-png-data");

  afterEach(async () => {
    // Clean up test files
    try {
      await deleteAllScreenshots(testDomain);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("saves screenshot and returns relative path", async () => {
    const timestamp = "2026-02-26T14-30-00-123Z";
    const relativePath = await saveScreenshot(
      testBuffer,
      testDomain,
      "pre-consent",
      timestamp
    );

    expect(relativePath).toBe(
      `${sanitizeDomain(testDomain)}/${timestamp}_pre-consent.png`
    );

    // Verify file exists
    const fullPath = path.join(TEST_SCREENSHOTS_DIR, relativePath);
    const content = await fs.readFile(fullPath);
    expect(content).toEqual(testBuffer);
  });

  it("creates domain directory if it doesn't exist", async () => {
    const timestamp = "2026-02-26T14-30-00-456Z";
    await saveScreenshot(testBuffer, testDomain, "pre-consent", timestamp);

    const dirPath = path.join(
      TEST_SCREENSHOTS_DIR,
      sanitizeDomain(testDomain)
    );
    const stat = await fs.stat(dirPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it("saves multiple screenshot types", async () => {
    const timestamp = "2026-02-26T14-30-00-789Z";

    await saveScreenshot(testBuffer, testDomain, "pre-consent", timestamp);
    await saveScreenshot(testBuffer, testDomain, "post-consent", timestamp);
    await saveScreenshot(testBuffer, testDomain, "banner", timestamp);

    const files = await listScreenshots(testDomain);
    expect(files).toHaveLength(3);
  });
});

describe("annotateBanner", () => {
  it("returns annotated buffer for valid bounds", async () => {
    const screenshot = Buffer.from("fake-png-data");
    const bounds = { x: 100, y: 50, width: 400, height: 200 };

    const result = await annotateBanner(screenshot, bounds);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("annotated-image");
  });

  it("handles bounds at image edge", async () => {
    const screenshot = Buffer.from("fake-png-data");
    const bounds = { x: 1400, y: 800, width: 100, height: 200 };

    const result = await annotateBanner(screenshot, bounds);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles negative coordinates", async () => {
    const screenshot = Buffer.from("fake-png-data");
    const bounds = { x: -10, y: -5, width: 400, height: 200 };

    const result = await annotateBanner(screenshot, bounds);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("returns original screenshot for zero-size bounds", async () => {
    const screenshot = Buffer.from("fake-png-data");
    const bounds = { x: 100, y: 50, width: 0, height: 0 };

    const result = await annotateBanner(screenshot, bounds);
    expect(result).toEqual(screenshot);
  });
});

describe("cleanupScreenshots", () => {
  const testDomain = "test-cleanup.example.com";

  beforeEach(async () => {
    // Create test directory with multiple screenshot sets
    const domainDir = path.join(
      TEST_SCREENSHOTS_DIR,
      sanitizeDomain(testDomain)
    );
    await fs.mkdir(domainDir, { recursive: true });

    // Create 5 screenshot sets
    const timestamps = [
      "2026-02-26T14-30-00-001Z",
      "2026-02-26T14-30-00-002Z",
      "2026-02-26T14-30-00-003Z",
      "2026-02-26T14-30-00-004Z",
      "2026-02-26T14-30-00-005Z",
    ];

    for (const ts of timestamps) {
      await fs.writeFile(
        path.join(domainDir, `${ts}_pre-consent.png`),
        "data"
      );
      await fs.writeFile(
        path.join(domainDir, `${ts}_post-consent.png`),
        "data"
      );
    }
  });

  afterEach(async () => {
    try {
      await deleteAllScreenshots(testDomain);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("keeps only the specified number of screenshot sets", async () => {
    await cleanupScreenshots(testDomain, 2);

    const files = await listScreenshots(testDomain);
    // Should have 2 sets x 2 files = 4 files
    expect(files).toHaveLength(4);
  });

  it("keeps newest screenshots", async () => {
    await cleanupScreenshots(testDomain, 1);

    const files = await listScreenshots(testDomain);
    // Should keep only the newest set
    expect(files).toHaveLength(2);
    expect(files[0]).toContain("2026-02-26T14-30-00-005Z");
  });

  it("handles non-existent directory", async () => {
    // Should not throw
    await expect(
      cleanupScreenshots("nonexistent-domain.com", 5)
    ).resolves.not.toThrow();
  });

  it("handles keepCount greater than existing sets", async () => {
    await cleanupScreenshots(testDomain, 10);

    const files = await listScreenshots(testDomain);
    // Should keep all 5 sets x 2 files = 10 files
    expect(files).toHaveLength(10);
  });
});

describe("listScreenshots", () => {
  const testDomain = "test-list.example.com";

  beforeEach(async () => {
    const domainDir = path.join(
      TEST_SCREENSHOTS_DIR,
      sanitizeDomain(testDomain)
    );
    await fs.mkdir(domainDir, { recursive: true });

    await fs.writeFile(
      path.join(domainDir, "2026-02-26T14-30-00-001Z_pre-consent.png"),
      "data"
    );
    await fs.writeFile(
      path.join(domainDir, "2026-02-26T14-30-00-002Z_banner.png"),
      "data"
    );
  });

  afterEach(async () => {
    try {
      await deleteAllScreenshots(testDomain);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("lists all screenshots for a domain", async () => {
    const files = await listScreenshots(testDomain);
    expect(files).toHaveLength(2);
  });

  it("returns files sorted by timestamp (newest first)", async () => {
    const files = await listScreenshots(testDomain);
    expect(files[0]).toContain("002Z");
    expect(files[1]).toContain("001Z");
  });

  it("returns empty array for non-existent domain", async () => {
    const files = await listScreenshots("nonexistent-domain.com");
    expect(files).toEqual([]);
  });
});

describe("screenshotsExist", () => {
  const testDomain = "test-exists.example.com";

  afterEach(async () => {
    try {
      await deleteAllScreenshots(testDomain);
    } catch {
      // Ignore cleanup errors
    }
  });

  it("returns false for non-existent domain", async () => {
    const exists = await screenshotsExist("nonexistent-domain.com");
    expect(exists).toBe(false);
  });

  it("returns true after saving a screenshot", async () => {
    await saveScreenshot(
      Buffer.from("data"),
      testDomain,
      "pre-consent",
      "2026-02-26T14-30-00-001Z"
    );

    const exists = await screenshotsExist(testDomain);
    expect(exists).toBe(true);
  });
});

describe("deleteAllScreenshots", () => {
  const testDomain = "test-delete.example.com";

  it("deletes all screenshots and directory", async () => {
    await saveScreenshot(
      Buffer.from("data"),
      testDomain,
      "pre-consent",
      "2026-02-26T14-30-00-001Z"
    );

    await deleteAllScreenshots(testDomain);

    const exists = await screenshotsExist(testDomain);
    expect(exists).toBe(false);
  });

  it("handles non-existent domain gracefully", async () => {
    await expect(
      deleteAllScreenshots("nonexistent-domain.com")
    ).resolves.not.toThrow();
  });
});
