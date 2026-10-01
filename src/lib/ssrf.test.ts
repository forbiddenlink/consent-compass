import { describe, expect, it, vi } from "vitest";
import {
  assertPublicHost,
  isBlockedHostname,
  isBlockedIp,
  isRequestAllowed,
} from "./ssrf";

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "169.254.169.254", "100.64.0.1", "100.127.255.255", "0.0.0.0",
    "0.1.2.3", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
    "192.0.0.1", "198.18.0.1",
  ])("blocks IPv4 %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.255.255", "100.128.0.1", "93.184.216.34"])(
    "allows public IPv4 %s",
    (ip) => expect(isBlockedIp(ip)).toBe(false),
  );

  it.each([
    "::1", "::", "[::1]", "fe80::1", "fe80::1%eth0", "febf::1", "fc00::1", "fd00::1",
    "fdff::1", "ff02::1", "ff00::", "::ffff:127.0.0.1", "::ffff:7f00:1",
    "::ffff:169.254.169.254", "::ffff:a9fe:a9fe", "[::ffff:10.0.0.1]",
    "0:0:0:0:0:ffff:192.168.0.1", "::127.0.0.1", "64:ff9b::7f00:1", "64:ff9b::a00:1",
    "2002:7f00:1::", "2002:a9fe:a9fe::1", "fd00:ec2::254", "2001:db8::1",
    "::ffff:100.64.0.1",
  ])("blocks IPv6 %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "2a00:1450:4001::200e"])(
    "allows public IPv6 %s",
    (ip) => expect(isBlockedIp(ip)).toBe(false),
  );

  it("treats unparseable input as blocked (fail closed)", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIp("")).toBe(true);
  });
});

describe("isBlockedHostname", () => {
  it.each([
    "localhost", "LOCALHOST", "localhost.", "foo.localhost", "a.local", "db.internal",
    "metadata.google.internal", "metadata", "instance-data", "169.254.169.254",
    "100.100.100.200", "[fd00:ec2::254]", "[::ffff:127.0.0.1]", "[fe80::1]",
  ])("blocks %s", (h) => expect(isBlockedHostname(h)).toBe(true));

  it.each(["example.com", "sub.example.co.uk", "8.8.8.8", "[2606:4700:4700::1111]"])(
    "allows %s",
    (h) => expect(isBlockedHostname(h)).toBe(false),
  );
});

describe("assertPublicHost (DNS)", () => {
  it("blocks a hostname resolving to a private IPv4 (rebinding-style)", async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const r = await assertPublicHost("evil.example.com", lookup);
    expect(r.ok).toBe(false);
    expect(lookup).toHaveBeenCalledWith("evil.example.com", { all: true, verbatim: true });
  });

  it("blocks when ANY resolved address is private (mixed A/AAAA)", async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "fd00::1", family: 6 },
    ]);
    expect((await assertPublicHost("mixed.example.com", lookup)).ok).toBe(false);
  });

  it("blocks a hostname resolving to an IPv4-mapped loopback", async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: "::ffff:127.0.0.1", family: 6 }]);
    expect((await assertPublicHost("mapped.example.com", lookup)).ok).toBe(false);
  });

  it("blocks cloud metadata via DNS", async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    expect((await assertPublicHost("meta.example.com", lookup)).ok).toBe(false);
  });

  it("allows a hostname whose addresses are all public", async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1::1", family: 6 },
    ]);
    expect((await assertPublicHost("example.com", lookup)).ok).toBe(true);
  });

  it("fails closed when DNS lookup throws", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    expect((await assertPublicHost("nx.example.com", lookup)).ok).toBe(false);
  });

  it("fails closed on an empty answer", async () => {
    const lookup = vi.fn().mockResolvedValue([]);
    expect((await assertPublicHost("empty.example.com", lookup)).ok).toBe(false);
  });

  it("does not call DNS for a literal IP and blocks it directly", async () => {
    const lookup = vi.fn();
    expect((await assertPublicHost("[::ffff:127.0.0.1]", lookup)).ok).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("allows a public literal IP without DNS", async () => {
    const lookup = vi.fn();
    expect((await assertPublicHost("8.8.8.8", lookup)).ok).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("isRequestAllowed (redirect / subrequest guard)", () => {
  const publicLookup = vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

  it("blocks a redirect hop to a private literal", async () => {
    expect(await isRequestAllowed("http://169.254.169.254/latest/meta-data/", publicLookup)).toBe(false);
    expect(await isRequestAllowed("https://[fd00::1]/", publicLookup)).toBe(false);
  });

  it("blocks a redirect hop to a hostname resolving private", async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: "192.168.0.10", family: 4 }]);
    expect(await isRequestAllowed("https://rebind.example.com/x", lookup)).toBe(false);
  });

  it("allows public http/https hops", async () => {
    expect(await isRequestAllowed("https://example.com/a", publicLookup)).toBe(true);
    expect(await isRequestAllowed("http://example.com/a", publicLookup)).toBe(true);
  });

  it("allows data:, blob:, about: and blocks file:, ftp:, and malformed URLs", async () => {
    expect(await isRequestAllowed("data:text/plain,hi", publicLookup)).toBe(true);
    expect(await isRequestAllowed("blob:https://example.com/uuid", publicLookup)).toBe(true);
    expect(await isRequestAllowed("about:blank", publicLookup)).toBe(true);
    expect(await isRequestAllowed("file:///etc/passwd", publicLookup)).toBe(false);
    expect(await isRequestAllowed("ftp://example.com/", publicLookup)).toBe(false);
    expect(await isRequestAllowed("not a url", publicLookup)).toBe(false);
  });
});
