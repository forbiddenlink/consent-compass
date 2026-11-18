import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetAllRateLimits } from "@/lib/rateLimit";
import { acquireScanSlot, resetScanSlots, MAX_CONCURRENT_SCANS } from "@/lib/scanGate";

vi.mock("@/lib/ssrf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ssrf")>();
  return {
    ...actual,
    assertPublicHost: (host: string) =>
      actual.assertPublicHost(host, async () => [{ address: "93.184.216.34", family: 4 }]),
  };
});

vi.mock("@/lib/scan", () => ({ scanUrl: vi.fn() }));
vi.mock("@/lib/pdf", () => ({ generatePdfFromHtml: vi.fn() }));

import { scanUrl } from "@/lib/scan";
const mockScanUrl = vi.mocked(scanUrl);

const req = (ip: string, url = "https://example.com") =>
  new Request(`http://localhost:3000/api/report?format=json&url=${encodeURIComponent(url)}`, {
    headers: { "x-forwarded-for": ip },
  });

describe("GET /api/report gate", () => {
  beforeEach(() => {
    resetAllRateLimits();
    resetScanSlots();
    mockScanUrl.mockReset();
    mockScanUrl.mockResolvedValue({ status: "ok" } as never);
  });

  it("returns 429 RATE_LIMITED when the client limit is exhausted", async () => {
    let res = await GET(req("10.1.0.1", "https://a0.example.com"));
    for (let i = 1; i < 100 && res.status !== 429; i++) {
      res = await GET(req("10.1.0.1", `https://a${i}.example.com`));
    }
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 503 SERVER_BUSY and does not launch a browser at the concurrency cap", async () => {
    Array.from({ length: MAX_CONCURRENT_SCANS }, () => acquireScanSlot());
    const res = await GET(req("10.1.0.2"));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("SERVER_BUSY");
    expect(mockScanUrl).not.toHaveBeenCalled();
  });

  it("returns 429 DOMAIN_COOLDOWN for a repeated domain", async () => {
    expect((await GET(req("10.1.0.3"))).status).toBe(200);
    const res = await GET(req("10.1.0.3"));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("DOMAIN_COOLDOWN");
  });

  it("releases the slot after a scan failure", async () => {
    mockScanUrl.mockRejectedValue(new Error("boom"));
    expect((await GET(req("10.1.0.4", "https://b.example.com"))).status).toBe(500);
    mockScanUrl.mockResolvedValue({ status: "ok" } as never);
    for (let i = 0; i < MAX_CONCURRENT_SCANS; i++) {
      expect((await GET(req("10.1.0.5", `https://c${i}.example.com`))).status).toBe(200);
    }
  });
});
