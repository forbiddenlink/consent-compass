import { describe, it, expect, beforeEach } from "vitest";
import {
  checkClientGate,
  checkDomainGate,
  acquireScanSlot,
  resetScanSlots,
  MAX_CONCURRENT_SCANS,
} from "@/lib/scanGate";
import { resetAllRateLimits } from "@/lib/rateLimit";

const req = (ip = "10.0.0.1") =>
  new Request("http://localhost/x", { headers: { "x-forwarded-for": ip } });

describe("scanGate", () => {
  beforeEach(() => {
    resetAllRateLimits();
    resetScanSlots();
  });

  it("allows a fresh client", () => {
    expect(checkClientGate(req()).ok).toBe(true);
  });

  it("returns 503 SERVER_BUSY at the concurrency cap and recovers on release", async () => {
    const releases = Array.from({ length: MAX_CONCURRENT_SCANS }, () => acquireScanSlot());
    const gate = checkClientGate(req("10.0.0.2"));
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(503);
      expect((await gate.response.json()).code).toBe("SERVER_BUSY");
    }
    releases[0]();
    releases[0](); // double release is a no-op
    expect(checkClientGate(req("10.0.0.3")).ok).toBe(true);
  });

  it("returns 429 once the client rate limit is exhausted", async () => {
    let last = checkClientGate(req("10.0.0.4"));
    for (let i = 0; i < 100 && last.ok; i++) last = checkClientGate(req("10.0.0.4"));
    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.response.status).toBe(429);
      expect(last.response.headers.get("Retry-After")).toBeTruthy();
      expect((await last.response.json()).code).toBe("RATE_LIMITED");
    }
  });

  it("returns 429 DOMAIN_COOLDOWN for a repeated domain", async () => {
    expect(checkDomainGate("example.com", {})).toBeNull();
    const res = checkDomainGate("example.com", {});
    expect(res?.status).toBe(429);
    expect((await res!.json()).code).toBe("DOMAIN_COOLDOWN");
  });
});
