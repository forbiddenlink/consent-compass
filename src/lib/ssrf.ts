import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard: classify IPs/hostnames and resolve DNS before the scanner's
 * browser touches a target. Node built-ins only.
 */

export type LookupFn = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: LookupFn = (hostname, options) => dnsLookup(hostname, options);

export type HostCheck = { ok: true } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "local",
  "internal",
  "intranet",
  "metadata",
  "instance-data",
  "metadata.google.internal",
]);

// Reserved-purpose suffixes that never name a public site.
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet"];

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIPv4(o: number[]): boolean {
  const [a, b, c] = o;
  return (
    a === 0 || // 0.0.0.0/8 "this" network
    a === 10 || // 10/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT (incl. Alibaba metadata)
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // 198.18/15 benchmarking
    a >= 224 // multicast 224/4, reserved 240/4, broadcast
  );
}

/** Expand an IPv6 literal to eight 16-bit groups, or null if malformed. */
function parseIPv6(input: string): number[] | null {
  let ip = input.split("%")[0]; // drop zone id
  // Embedded dotted IPv4 tail -> two hex groups
  const lastColon = ip.lastIndexOf(":");
  const tail = ip.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    ip = `${ip.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...Array(fill).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? Number.parseInt(g, 16) : Number.NaN));
  return nums.every((n) => Number.isInteger(n)) ? nums : null;
}

function v4FromGroups(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 255, lo >> 8, lo & 255];
}

function isBlockedIPv6(g: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
  const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // :: and ::1
  if (firstFiveZero && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true;
  // IPv4-mapped ::ffff:a.b.c.d
  if (firstFiveZero && g5 === 0xffff) return isBlockedIPv4(v4FromGroups(g6, g7));
  // Deprecated IPv4-compatible ::a.b.c.d (and anything else in ::/96)
  if (firstFiveZero && g5 === 0) return true;
  // NAT64 64:ff9b::/96 -> embedded IPv4
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIPv4(v4FromGroups(g6, g7));
  }
  // 6to4 2002::/16 -> embedded IPv4 in groups 1-2
  if (g0 === 0x2002) return isBlockedIPv4(v4FromGroups(g1, g2));
  if ((g0 & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique-local fc00::/7
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation 2001:db8::/32
  return false;
}

/**
 * True if the address is not a safe public destination. Accepts bracketed
 * IPv6, zone ids, and IPv4-mapped forms. Unparseable input fails closed.
 */
export function isBlockedIp(input: string): boolean {
  const ip = stripBrackets(input.trim());
  const family = isIP(ip.split("%")[0]);
  if (family === 4) {
    const o = parseIPv4(ip);
    return o ? isBlockedIPv4(o) : true;
  }
  if (family === 6) {
    const g = parseIPv6(ip);
    return g ? isBlockedIPv6(g) : true;
  }
  return true;
}

/** Static (no DNS) hostname check: literal IPs, reserved names, metadata hosts. */
export function isBlockedHostname(hostname: string): boolean {
  let host = stripBrackets(hostname.trim().toLowerCase());
  while (host.endsWith(".")) host = host.slice(0, -1);
  if (!host) return true;
  if (isIP(host.split("%")[0]) !== 0) return isBlockedIp(host);
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_SUFFIXES.some((s) => host.endsWith(s));
}

/**
 * Check a host for scanning: static checks, then resolve DNS and require
 * EVERY returned address to be public. Fails closed on lookup errors.
 */
export async function assertPublicHost(
  hostname: string,
  lookup: LookupFn = defaultLookup,
): Promise<HostCheck> {
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: "Scanning private/internal addresses is not allowed" };
  }
  const host = stripBrackets(hostname.trim());
  if (isIP(host.split("%")[0]) !== 0) return { ok: true }; // public literal, no DNS needed

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: "Could not resolve host" };
  }
  if (records.length === 0) return { ok: false, reason: "Could not resolve host" };
  if (records.some((r) => isBlockedIp(r.address))) {
    return { ok: false, reason: "Scanning private/internal addresses is not allowed" };
  }
  return { ok: true };
}

/**
 * Per-request guard for the browser: every navigation, redirect hop and
 * subresource must be a public http(s) destination (or an inert data/blob/about URL).
 */
export async function isRequestAllowed(
  rawUrl: string,
  lookup: LookupFn = defaultLookup,
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (["data:", "blob:", "about:"].includes(url.protocol)) return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return (await assertPublicHost(url.hostname, lookup)).ok;
}
