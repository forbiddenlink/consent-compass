import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetAllRateLimits } from "@/lib/rateLimit";
import { tryAcquireScanSlot, resetScanSlots, MAX_CONCURRENT_SCANS } from "@/lib/scanGate";

vi.mock("@/lib/ssrf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ssrf")>();
  return {
    ...actual,
    assertPublicHost: (host: string) =>
      actual.assertPublicHost(host, async () => [{ address: "93.184.216.34", family: 4 }]),
  };
});

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: { trigger: vi.fn() },
  runs: { retrieve: vi.fn() },
}));
vi.mock("@/lib/pdf-report", () => ({
  generateReport: vi.fn(async () => Buffer.from("%PDF-fake")),
}));

import { tasks, runs } from "@trigger.dev/sdk/v3";
import { generateReport } from "@/lib/pdf-report";
const mockTrigger = vi.mocked(tasks.trigger);
const mockRetrieve = vi.mocked(runs.retrieve);

const RUN = "run_abc12345xyz";
const okResult = {
  status: "ok",
  url: "https://example.com/",
  scannedAt: "2026-11-17T00:00:00.000Z",
  score: { overall: 77, choiceSymmetry: 1, preConsentSignals: 1, accessibility: 1, transparency: 1 },
  preConsent: { cookies: [{ name: "a", domain: "x", category: "analytics" }], requests: [] },
  findings: [],
};

const byUrl = (ip: string, url = "https://example.com", format = "json") =>
  new Request(
    `http://localhost:3000/api/report?format=${format}&url=${encodeURIComponent(url)}`,
    { headers: { "x-forwarded-for": ip } }
  );
const byRun = (ip: string, runId = RUN, format = "json") =>
  new Request(`http://localhost:3000/api/report?format=${format}&runId=${runId}`, {
    headers: { "x-forwarded-for": ip },
  });

describe("GET /api/report", () => {
  beforeEach(() => {
    resetAllRateLimits();
    resetScanSlots();
    vi.clearAllMocks();
    mockTrigger.mockResolvedValue({ id: RUN } as never);
    mockRetrieve.mockResolvedValue({
      taskIdentifier: "scan-url-compliance",
      status: "COMPLETED",
      output: okResult,
    } as never);
  });

  describe("runId", () => {
    it("renders from the finished run without triggering a scan", async () => {
      const res = await GET(byRun("10.2.0.1"));
      expect(res.status).toBe(200);
      expect((await res.json()).score.overall).toBe(77);
      expect(mockTrigger).not.toHaveBeenCalled();
    });

    it("makes the PDF with the react-pdf report", async () => {
      const res = await GET(byRun("10.2.0.2", RUN, "pdf"));
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(generateReport).toHaveBeenCalledTimes(1);
    });

    it("returns 202 while the run is still executing", async () => {
      mockRetrieve.mockResolvedValue({ taskIdentifier: "scan-url-compliance", status: "EXECUTING" } as never);
      const res = await GET(byRun("10.2.0.3"));
      expect(res.status).toBe(202);
      expect((await res.json()).runId).toBe(RUN);
    });

    it("rejects a run from another task", async () => {
      mockRetrieve.mockResolvedValue({ taskIdentifier: "other", status: "COMPLETED", output: okResult } as never);
      expect((await GET(byRun("10.2.0.4"))).status).toBe(404);
    });

    it("rejects a malformed runId", async () => {
      expect((await GET(byRun("10.2.0.5", "nope"))).status).toBe(400);
      expect(mockRetrieve).not.toHaveBeenCalled();
    });
  });

  describe("url", () => {
    it("triggers the task and waits for the result", async () => {
      const res = await GET(byUrl("10.3.0.1"));
      expect(res.status).toBe(200);
      expect(mockTrigger).toHaveBeenCalledWith("scan-url-compliance", { url: "https://example.com/" });
    });

    it("requires url or runId", async () => {
      const res = await GET(new Request("http://localhost:3000/api/report", { headers: { "x-forwarded-for": "10.3.0.2" } }));
      expect(res.status).toBe(400);
    });

    it("returns 429 DOMAIN_COOLDOWN for a repeated domain", async () => {
      expect((await GET(byUrl("10.3.0.3"))).status).toBe(200);
      const res = await GET(byUrl("10.3.0.3"));
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("DOMAIN_COOLDOWN");
    });

    it("returns 503 SERVER_BUSY at the concurrency cap and does not trigger a scan", async () => {
      Array.from({ length: MAX_CONCURRENT_SCANS }, () => tryAcquireScanSlot()!);
      const res = await GET(byUrl("10.3.0.4"));
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe("SERVER_BUSY");
      expect(mockTrigger).not.toHaveBeenCalled();
    });

    it("releases the slot after a failure", async () => {
      mockTrigger.mockRejectedValueOnce(new Error("boom"));
      expect((await GET(byUrl("10.3.0.5", "https://b.example.com"))).status).toBe(500);
      for (let i = 0; i < MAX_CONCURRENT_SCANS; i++) {
        expect((await GET(byUrl("10.3.0.6", `https://c${i}.example.com`))).status).toBe(200);
      }
    });
  });

  it("returns 429 RATE_LIMITED when the client limit is exhausted", async () => {
    let res = await GET(byRun("10.4.0.1"));
    for (let i = 1; i < 100 && res.status !== 429; i++) res = await GET(byRun("10.4.0.1"));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
