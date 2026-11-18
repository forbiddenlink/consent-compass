import { describe, it, expect, afterEach, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/rescan", () => ({
  rescanDomain: vi.fn(async () => null),
  rescanDomains: vi.fn(async () => []),
}));
import { rescanDomains } from "@/lib/rescan";

const req = (auth?: string) =>
  new Request("http://localhost/api/rescan", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });

describe("POST /api/rescan auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 503 in production when RESCAN_API_KEY is unset (fails closed)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESCAN_API_KEY", "");
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("NOT_CONFIGURED");
    expect(rescanDomains).not.toHaveBeenCalled();
  });

  it("still allows access outside production when the key is unset", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("RESCAN_API_KEY", "");
    expect((await POST(req())).status).toBe(200);
  });

  it("returns 401 for a wrong key and 200 for the right key", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESCAN_API_KEY", "secret");
    expect((await POST(req("Bearer nope"))).status).toBe(401);
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("Bearer secret"))).status).toBe(200);
  });
});
