import { afterEach, beforeEach, it, expect, vi } from "vitest";
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
	vi.resetModules();
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});
it("enforces cooldown even at zero timestamp", async () => {
	const { checkDomainLimit } = await import("./rateLimit");
	expect(checkDomainLimit("example.test").allowed).toBe(true);
	expect(checkDomainLimit("example.test").allowed).toBe(false);
});
it("cleans up expired domains without needing IP checks", async () => {
	const del = vi.spyOn(Map.prototype, "delete");
	const { checkDomainLimit } = await import("./rateLimit");
	checkDomainLimit("example.test");
	vi.advanceTimersByTime(300001);
	expect(del).toHaveBeenCalledWith("example.test");
});
it("allows domains after cooldown", async () => {
	const { checkDomainLimit } = await import("./rateLimit");
	checkDomainLimit("example.test");
	vi.advanceTimersByTime(30001);
	expect(checkDomainLimit("example.test").allowed).toBe(true);
});
