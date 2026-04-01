/**
 * Cookie Database - Open Cookie Database Integration
 *
 * Provides lookup functionality for the Open Cookie Database (OCD).
 * The database contains categorization information for thousands of known cookies.
 *
 * Source: https://github.com/jkwakman/Open-Cookie-Database
 */

import type { CookieCategory } from "@/lib/types";

// Re-export the existing database entries from the auto-generated file
import { COOKIE_EXACT_MATCHES, COOKIE_PREFIX_PATTERNS } from "@/lib/cookie-database";

export { COOKIE_EXACT_MATCHES, COOKIE_PREFIX_PATTERNS };

export interface CookieEntry {
  category: CookieCategory;
  vendor?: string;
  description?: string;
}

export interface CookiePrefixPattern extends CookieEntry {
  prefix: string;
}

/**
 * Lookup a cookie by exact name match in the Open Cookie Database
 */
export function lookupCookieExact(name: string): CookieEntry | undefined {
  return COOKIE_EXACT_MATCHES.get(name);
}

/**
 * Lookup a cookie by prefix pattern in the Open Cookie Database
 * Returns the first matching prefix pattern (patterns are sorted by length, longest first)
 */
export function lookupCookieByPrefix(name: string): CookiePrefixPattern | undefined {
  for (const entry of COOKIE_PREFIX_PATTERNS) {
    if (name.startsWith(entry.prefix)) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Get all cookies from the database that match a vendor
 */
export function getCookiesByVendor(vendor: string): Array<{ name: string; entry: CookieEntry }> {
  const results: Array<{ name: string; entry: CookieEntry }> = [];
  const lowerVendor = vendor.toLowerCase();

  for (const [name, entry] of COOKIE_EXACT_MATCHES.entries()) {
    if (entry.vendor?.toLowerCase().includes(lowerVendor)) {
      results.push({ name, entry });
    }
  }

  return results;
}

/**
 * Get all cookies from the database that match a category
 */
export function getCookiesByCategory(category: CookieCategory): Array<{ name: string; entry: CookieEntry }> {
  const results: Array<{ name: string; entry: CookieEntry }> = [];

  for (const [name, entry] of COOKIE_EXACT_MATCHES.entries()) {
    if (entry.category === category) {
      results.push({ name, entry });
    }
  }

  return results;
}

/**
 * Search cookies in the database by name pattern
 */
export function searchCookies(
  pattern: string,
  options?: { limit?: number }
): Array<{ name: string; entry: CookieEntry }> {
  const results: Array<{ name: string; entry: CookieEntry }> = [];
  const limit = options?.limit ?? 100;
  const lowerPattern = pattern.toLowerCase();

  for (const [name, entry] of COOKIE_EXACT_MATCHES.entries()) {
    if (name.toLowerCase().includes(lowerPattern)) {
      results.push({ name, entry });
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  totalExactMatches: number;
  totalPrefixPatterns: number;
  byCategory: Record<CookieCategory, number>;
  topVendors: Array<{ vendor: string; count: number }>;
} {
  const byCategory: Record<CookieCategory, number> = {
    necessary: 0,
    functional: 0,
    analytics: 0,
    marketing: 0,
    unknown: 0,
  };

  const vendorCounts = new Map<string, number>();

  for (const entry of COOKIE_EXACT_MATCHES.values()) {
    byCategory[entry.category]++;
    if (entry.vendor) {
      vendorCounts.set(entry.vendor, (vendorCounts.get(entry.vendor) ?? 0) + 1);
    }
  }

  // Sort vendors by count
  const topVendors = Array.from(vendorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([vendor, count]) => ({ vendor, count }));

  return {
    totalExactMatches: COOKIE_EXACT_MATCHES.size,
    totalPrefixPatterns: COOKIE_PREFIX_PATTERNS.length,
    byCategory,
    topVendors,
  };
}

/**
 * Check if a cookie is known in the database
 */
export function isKnownCookie(name: string): boolean {
  if (COOKIE_EXACT_MATCHES.has(name)) return true;

  for (const entry of COOKIE_PREFIX_PATTERNS) {
    if (name.startsWith(entry.prefix)) return true;
  }

  return false;
}
