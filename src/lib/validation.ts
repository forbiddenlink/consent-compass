import { z } from "zod";
import { assertPublicHost, isBlockedHostname, type LookupFn } from "./ssrf";

/**
 * Normalize and validate a URL for scanning
 */
export function validateAndNormalizeUrl(input: string): {
  valid: true; url: string
} | {
  valid: false; error: string
} {
  let url: URL;

  try {
    // Check for non-http(s) protocols first and reject them
    if (input.match(/^[a-z][a-z0-9+.-]*:/i) && !input.match(/^https?:\/\//i)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    // Add https:// if no protocol specified
    const withProtocol = input.match(/^https?:\/\//i) ? input : `https://${input}`;
    url = new URL(withProtocol);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow http/https (double-check after parsing)
  if (!["http:", "https:"].includes(url.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  // Block private/internal hosts
  if (isBlockedHostname(url.hostname)) {
    return { valid: false, error: "Scanning private/internal addresses is not allowed" };
  }

  // Block scanning our own domain (prevent SSRF)
  if (url.hostname.includes("consent-compass") || url.hostname.includes("consentcompass")) {
    return { valid: false, error: "Cannot scan self" };
  }

  // Normalize: always use https, strip hash
  url.protocol = "https:";
  url.hash = "";

  return { valid: true, url: url.toString() };
}

/**
 * validateAndNormalizeUrl plus DNS resolution: every A/AAAA record must be public.
 */
export async function validateAndResolveUrl(
  input: string,
  lookup?: LookupFn,
): Promise<{ valid: true; url: string } | { valid: false; error: string }> {
  const result = validateAndNormalizeUrl(input);
  if (!result.valid) return result;
  const check = await assertPublicHost(new URL(result.url).hostname, lookup);
  return check.ok ? result : { valid: false, error: check.reason };
}

/**
 * Zod schema for scan request body
 */
export const ScanRequestSchema = z.object({
  url: z.string().min(1, "URL is required").max(2048, "URL too long"),
  options: z.object({
    timeout: z.number().min(5000).max(60000).optional(),
    screenshot: z.boolean().optional(),
  }).optional(),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/**
 * Custom error types for better error handling
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string = "Scan timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number = 60) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class BlockedError extends Error {
  constructor(message: string = "Request blocked") {
    super(message);
    this.name = "BlockedError";
  }
}
