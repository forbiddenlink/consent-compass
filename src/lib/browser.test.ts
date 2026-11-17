import { describe, it, expect, vi } from "vitest";

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--no-sandbox", "--single-process"],
    executablePath: vi.fn(async () => "/tmp/chromium"),
  },
}));

import { getLaunchOptions, isServerlessRuntime } from "@/lib/browser";

describe("browser launch options", () => {
  it("uses the local Playwright browser outside serverless", async () => {
    const opts = await getLaunchOptions({} as NodeJS.ProcessEnv);
    expect(opts).toEqual({ headless: true });
    expect(opts.executablePath).toBeUndefined();
  });

  it("uses the bundled Chromium on Vercel", async () => {
    const opts = await getLaunchOptions({ VERCEL: "1" } as unknown as NodeJS.ProcessEnv);
    expect(opts.headless).toBe(true);
    expect(opts.executablePath).toBe("/tmp/chromium");
    expect(opts.args).toContain("--no-sandbox");
  });

  it("detects serverless env vars", () => {
    expect(isServerlessRuntime({ VERCEL: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isServerlessRuntime({} as NodeJS.ProcessEnv)).toBe(false);
  });
});
