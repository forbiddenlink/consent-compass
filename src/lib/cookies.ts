import type { CookieCategory, CategorizedCookie } from "./types";
import { COOKIE_EXACT_MATCHES, COOKIE_PREFIX_PATTERNS } from "./cookie-database";

/**
 * Cookie categorization database
 *
 * Primary source: Open Cookie Database (2,249 cookies)
 * https://github.com/jkwakman/Open-Cookie-Database
 *
 * Fallback: Local regex patterns for common patterns not in OCD
 *
 * Categories:
 * - necessary: Essential for site functionality (auth, security, load balancing)
 * - functional: Enhanced functionality (language, preferences, A/B testing)
 * - analytics: Usage tracking and analytics (Google Analytics, Mixpanel, etc.)
 * - marketing: Advertising and cross-site tracking (Facebook, Google Ads, etc.)
 */

interface CookiePattern {
  pattern: RegExp | string;
  category: CookieCategory;
  vendor?: string;
  description?: string;
}

// Fallback patterns for cookies not in Open Cookie Database
const FALLBACK_PATTERNS: CookiePattern[] = [
  // ===== NECESSARY =====
  // Session & Security
  { pattern: /^__cf/, category: "necessary", vendor: "Cloudflare", description: "Cloudflare security" },
  { pattern: /^cf_/, category: "necessary", vendor: "Cloudflare", description: "Cloudflare functionality" },
  { pattern: /^__cfduid$/, category: "necessary", vendor: "Cloudflare", description: "Cloudflare bot protection" },
  { pattern: /^JSESSIONID$/, category: "necessary", description: "Java session" },
  { pattern: /^PHPSESSID$/, category: "necessary", description: "PHP session" },
  { pattern: /^ASP\.NET_SessionId$/, category: "necessary", description: "ASP.NET session" },
  { pattern: /^AWSALB/, category: "necessary", vendor: "AWS", description: "AWS load balancer" },
  { pattern: /^AWSELB/, category: "necessary", vendor: "AWS", description: "AWS load balancer" },
  { pattern: /^csrf/i, category: "necessary", description: "CSRF protection" },
  { pattern: /^_csrf/i, category: "necessary", description: "CSRF protection" },
  { pattern: /^XSRF-TOKEN$/i, category: "necessary", description: "XSRF protection" },
  { pattern: /^__Host-/, category: "necessary", description: "Secure host cookie" },
  { pattern: /^__Secure-/, category: "necessary", description: "Secure cookie" },

  // Auth
  { pattern: /^auth/i, category: "necessary", description: "Authentication" },
  { pattern: /^session/i, category: "necessary", description: "Session management" },
  { pattern: /^token$/i, category: "necessary", description: "Auth token" },
  { pattern: /^access_token$/i, category: "necessary", description: "Access token" },
  { pattern: /^refresh_token$/i, category: "necessary", description: "Refresh token" },
  { pattern: /^logged_in$/i, category: "necessary", description: "Login state" },

  // Consent
  { pattern: /^cookieconsent/, category: "necessary", description: "Cookie consent state" },
  { pattern: /^CookieConsent$/, category: "necessary", vendor: "Cookiebot", description: "Consent preferences" },
  { pattern: /^OptanonConsent$/, category: "necessary", vendor: "OneTrust", description: "Consent preferences" },
  { pattern: /^OptanonAlertBoxClosed$/, category: "necessary", vendor: "OneTrust", description: "Consent UI state" },
  { pattern: /^euconsent/i, category: "necessary", description: "EU consent string" },
  { pattern: /^__tcfapi/, category: "necessary", description: "TCF consent" },
  { pattern: /^gdpr/i, category: "necessary", description: "GDPR consent" },

  // ===== FUNCTIONAL =====
  // Language & Locale
  { pattern: /^lang$/i, category: "functional", description: "Language preference" },
  { pattern: /^locale$/i, category: "functional", description: "Locale preference" },
  { pattern: /^language$/i, category: "functional", description: "Language preference" },
  { pattern: /^country$/i, category: "functional", description: "Country preference" },
  { pattern: /^currency$/i, category: "functional", description: "Currency preference" },
  { pattern: /^timezone$/i, category: "functional", description: "Timezone preference" },

  // UI Preferences
  { pattern: /^theme$/i, category: "functional", description: "Theme preference" },
  { pattern: /^dark_mode$/i, category: "functional", description: "Dark mode preference" },
  { pattern: /^sidebar/i, category: "functional", description: "Sidebar state" },
  { pattern: /^layout/i, category: "functional", description: "Layout preference" },

  // A/B Testing (first-party)
  { pattern: /^ab_test/i, category: "functional", description: "A/B test variant" },
  { pattern: /^experiment/i, category: "functional", description: "Experiment variant" },
  { pattern: /^variant/i, category: "functional", description: "Test variant" },

  // ===== ANALYTICS =====
  // Google Analytics
  { pattern: /^_ga$/, category: "analytics", vendor: "Google Analytics", description: "User ID" },
  { pattern: /^_ga_/, category: "analytics", vendor: "Google Analytics 4", description: "Session data" },
  { pattern: /^_gid$/, category: "analytics", vendor: "Google Analytics", description: "Session ID" },
  { pattern: /^_gat/, category: "analytics", vendor: "Google Analytics", description: "Throttle requests" },
  { pattern: /^_gac_/, category: "analytics", vendor: "Google Analytics", description: "Campaign info" },
  { pattern: /^__utm/, category: "analytics", vendor: "Google Analytics", description: "UTM tracking" },
  { pattern: /^_gcl_au$/, category: "analytics", vendor: "Google", description: "Conversion linker" },

  // Other Analytics
  { pattern: /^mp_/, category: "analytics", vendor: "Mixpanel", description: "Analytics tracking" },
  { pattern: /^mixpanel/, category: "analytics", vendor: "Mixpanel", description: "Analytics tracking" },
  { pattern: /^amplitude/, category: "analytics", vendor: "Amplitude", description: "Analytics tracking" },
  { pattern: /^ajs_/, category: "analytics", vendor: "Segment", description: "Analytics tracking" },
  { pattern: /^_hjSession/, category: "analytics", vendor: "Hotjar", description: "Session recording" },
  { pattern: /^_hjid$/, category: "analytics", vendor: "Hotjar", description: "User ID" },
  { pattern: /^_hjFirstSeen$/, category: "analytics", vendor: "Hotjar", description: "First visit" },
  { pattern: /^_hjIncludedInPageviewSample$/, category: "analytics", vendor: "Hotjar", description: "Sampling" },
  { pattern: /^_hjAbsoluteSessionInProgress$/, category: "analytics", vendor: "Hotjar", description: "Session tracking" },
  { pattern: /^_hp2_/, category: "analytics", vendor: "Heap", description: "Analytics tracking" },
  { pattern: /^_pk_/, category: "analytics", vendor: "Matomo/Piwik", description: "Analytics tracking" },
  { pattern: /^_clck$/, category: "analytics", vendor: "Microsoft Clarity", description: "User ID" },
  { pattern: /^_clsk$/, category: "analytics", vendor: "Microsoft Clarity", description: "Session data" },
  { pattern: /^CLID$/, category: "analytics", vendor: "Microsoft Clarity", description: "User tracking" },
  { pattern: /^hubspotutk$/, category: "analytics", vendor: "HubSpot", description: "Visitor tracking" },
  { pattern: /^__hstc$/, category: "analytics", vendor: "HubSpot", description: "Visitor tracking" },
  { pattern: /^__hssc$/, category: "analytics", vendor: "HubSpot", description: "Session tracking" },
  { pattern: /^__hssrc$/, category: "analytics", vendor: "HubSpot", description: "Session state" },
  { pattern: /^intercom-/, category: "analytics", vendor: "Intercom", description: "User tracking" },
  { pattern: /^fs_uid$/, category: "analytics", vendor: "FullStory", description: "User tracking" },
  { pattern: /^_lr_/, category: "analytics", vendor: "LogRocket", description: "Session recording" },
  { pattern: /^ln_or$/, category: "analytics", vendor: "LinkedIn", description: "Origin tracking" },
  { pattern: /^_uetsid$/, category: "analytics", vendor: "Microsoft Ads", description: "Session ID" },
  { pattern: /^_uetvid$/, category: "analytics", vendor: "Microsoft Ads", description: "User ID" },
  { pattern: /^plausible_/, category: "analytics", vendor: "Plausible", description: "Privacy-friendly analytics" },
  { pattern: /^_fathom/, category: "analytics", vendor: "Fathom", description: "Privacy-friendly analytics" },

  // ===== MARKETING =====
  // Facebook/Meta
  { pattern: /^_fbp$/, category: "marketing", vendor: "Facebook", description: "Browser ID" },
  { pattern: /^_fbc$/, category: "marketing", vendor: "Facebook", description: "Click ID" },
  { pattern: /^fr$/, category: "marketing", vendor: "Facebook", description: "Advertising" },
  { pattern: /^tr$/, category: "marketing", vendor: "Facebook", description: "Pixel tracking" },
  { pattern: /^_fbq/, category: "marketing", vendor: "Facebook", description: "Pixel tracking" },

  // Google Ads
  { pattern: /^_gcl_aw$/, category: "marketing", vendor: "Google Ads", description: "Click tracking" },
  { pattern: /^_gcl_dc$/, category: "marketing", vendor: "Google Ads", description: "Campaign tracking" },
  { pattern: /^_gcl_gb$/, category: "marketing", vendor: "Google Ads", description: "Campaign tracking" },
  { pattern: /^gclid$/, category: "marketing", vendor: "Google Ads", description: "Click ID" },
  { pattern: /^GCLB$/, category: "marketing", vendor: "Google Ads", description: "Load balancer" },
  { pattern: /^IDE$/, category: "marketing", vendor: "Google DoubleClick", description: "Advertising" },
  { pattern: /^DSID$/, category: "marketing", vendor: "Google DoubleClick", description: "Advertising" },
  { pattern: /^__gads$/, category: "marketing", vendor: "Google Ads", description: "Advertising" },
  { pattern: /^__gpi$/, category: "marketing", vendor: "Google Publisher", description: "Advertising" },
  { pattern: /^NID$/, category: "marketing", vendor: "Google", description: "Preferences/Ads" },
  { pattern: /^DV$/, category: "marketing", vendor: "Google", description: "Preferences tracking" },
  { pattern: /^1P_JAR$/, category: "marketing", vendor: "Google", description: "Cookie sync" },
  { pattern: /^AEC$/, category: "marketing", vendor: "Google", description: "Fraud prevention" },
  { pattern: /^APISID$/, category: "marketing", vendor: "Google", description: "Personalization" },
  { pattern: /^HSID$/, category: "marketing", vendor: "Google", description: "Security" },
  { pattern: /^SAPISID$/, category: "marketing", vendor: "Google", description: "Personalization" },
  { pattern: /^SID$/, category: "marketing", vendor: "Google", description: "Personalization" },
  { pattern: /^SIDCC$/, category: "marketing", vendor: "Google", description: "Security" },
  { pattern: /^SSID$/, category: "marketing", vendor: "Google", description: "Personalization" },

  // LinkedIn
  { pattern: /^li_/, category: "marketing", vendor: "LinkedIn", description: "Advertising" },
  { pattern: /^bcookie$/, category: "marketing", vendor: "LinkedIn", description: "Browser ID" },
  { pattern: /^lidc$/, category: "marketing", vendor: "LinkedIn", description: "Routing" },
  { pattern: /^UserMatchHistory$/, category: "marketing", vendor: "LinkedIn", description: "Ad targeting" },
  { pattern: /^AnalyticsSyncHistory$/, category: "marketing", vendor: "LinkedIn", description: "Analytics sync" },
  { pattern: /^bscookie$/, category: "marketing", vendor: "LinkedIn", description: "Security" },

  // Twitter/X
  { pattern: /^twid$/, category: "marketing", vendor: "Twitter", description: "User tracking" },
  { pattern: /^personalization_id$/, category: "marketing", vendor: "Twitter", description: "Personalization" },
  { pattern: /^guest_id$/, category: "marketing", vendor: "Twitter", description: "Guest tracking" },
  { pattern: /^muc_ads$/, category: "marketing", vendor: "Twitter", description: "Advertising" },

  // TikTok
  { pattern: /^_ttp$/, category: "marketing", vendor: "TikTok", description: "Pixel tracking" },
  { pattern: /^_tt_/, category: "marketing", vendor: "TikTok", description: "Tracking" },
  { pattern: /^tt_/, category: "marketing", vendor: "TikTok", description: "Tracking" },

  // Pinterest
  { pattern: /^_pinterest_/, category: "marketing", vendor: "Pinterest", description: "Advertising" },
  { pattern: /^_pin_/, category: "marketing", vendor: "Pinterest", description: "Advertising" },

  // Snapchat
  { pattern: /^_scid$/, category: "marketing", vendor: "Snapchat", description: "Pixel tracking" },
  { pattern: /^sc_at$/, category: "marketing", vendor: "Snapchat", description: "Advertising" },

  // Other Ad Tech
  { pattern: /^_rdt_uuid$/, category: "marketing", vendor: "Reddit", description: "Advertising" },
  { pattern: /^taboola/, category: "marketing", vendor: "Taboola", description: "Content recommendation" },
  { pattern: /^outbrain/, category: "marketing", vendor: "Outbrain", description: "Content recommendation" },
  { pattern: /^criteo/, category: "marketing", vendor: "Criteo", description: "Retargeting" },
  { pattern: /^_cc_/, category: "marketing", vendor: "Criteo", description: "Retargeting" },
  { pattern: /^adroll/, category: "marketing", vendor: "AdRoll", description: "Retargeting" },
  { pattern: /^__adroll/, category: "marketing", vendor: "AdRoll", description: "Retargeting" },
  { pattern: /^_mkto_/, category: "marketing", vendor: "Marketo", description: "Marketing automation" },
  { pattern: /^munchkin$/, category: "marketing", vendor: "Marketo", description: "Visitor tracking" },
  { pattern: /^pardot$/, category: "marketing", vendor: "Pardot", description: "Marketing automation" },
  { pattern: /^visitor_id/, category: "marketing", vendor: "Pardot", description: "Visitor tracking" },
  { pattern: /^eloqua/, category: "marketing", vendor: "Oracle Eloqua", description: "Marketing automation" },
  { pattern: /^_kuid_$/, category: "marketing", vendor: "Krux/Salesforce DMP", description: "Audience targeting" },
  { pattern: /^__lt__sid$/, category: "marketing", vendor: "LiveChat", description: "Session tracking" },
  { pattern: /^drift/, category: "marketing", vendor: "Drift", description: "Chat/Marketing" },
  { pattern: /^_vwo_/, category: "marketing", vendor: "VWO", description: "A/B testing" },
  { pattern: /^optimizely/, category: "marketing", vendor: "Optimizely", description: "Experimentation" },
  { pattern: /^_biz/, category: "marketing", vendor: "Bizible", description: "Attribution" },
];

/**
 * Categorize a single cookie
 *
 * Lookup order:
 * 1. Local regex patterns (critical categories: necessary, security, consent)
 * 2. Open Cookie Database exact matches
 * 3. Open Cookie Database prefix patterns
 * 4. Domain-based heuristics
 */
export function categorizeCookie(name: string, domain?: string): {
  category: CookieCategory;
  vendor?: string;
  description?: string;
} {
  // 1. Check local patterns first (we know these better than OCD for critical categories)
  for (const entry of FALLBACK_PATTERNS) {
    const pattern = entry.pattern;
    const matches = typeof pattern === "string"
      ? name === pattern
      : pattern.test(name);

    if (matches) {
      return {
        category: entry.category,
        vendor: entry.vendor,
        description: entry.description,
      };
    }
  }

  // 2. Check Open Cookie Database exact matches
  const exactMatch = COOKIE_EXACT_MATCHES.get(name);
  if (exactMatch) {
    return exactMatch;
  }

  // 3. Check Open Cookie Database prefix patterns (sorted by length, longest first)
  for (const entry of COOKIE_PREFIX_PATTERNS) {
    if (name.startsWith(entry.prefix)) {
      return {
        category: entry.category,
        vendor: entry.vendor,
        description: entry.description,
      };
    }
  }

  // 4. Domain-based heuristics for unknown cookies
  if (domain) {
    const lowerDomain = domain.toLowerCase();

    // Known tracker domains
    if (lowerDomain.includes("doubleclick") || lowerDomain.includes("googlesyndication")) {
      return { category: "marketing", vendor: "Google Ads" };
    }
    if (lowerDomain.includes("facebook") || lowerDomain.includes("fbcdn")) {
      return { category: "marketing", vendor: "Facebook" };
    }
    if (lowerDomain.includes("google-analytics") || lowerDomain.includes("googletagmanager")) {
      return { category: "analytics", vendor: "Google Analytics" };
    }
    if (lowerDomain.includes("linkedin")) {
      return { category: "marketing", vendor: "LinkedIn" };
    }
    if (lowerDomain.includes("twitter") || lowerDomain.includes("x.com")) {
      return { category: "marketing", vendor: "Twitter" };
    }
  }

  return { category: "unknown" };
}

/**
 * Categorize an array of cookies
 */
export function categorizeCookies(
  cookies: Array<{ name: string; domain?: string; path?: string; value?: string; expires?: string }>
): CategorizedCookie[] {
  return cookies.map((cookie) => {
    const { category, vendor, description } = categorizeCookie(cookie.name, cookie.domain);
    return {
      ...cookie,
      category,
      vendor,
      description,
    };
  });
}

/**
 * Summarize cookies by category
 */
export function summarizeCookiesByCategory(
  cookies: CategorizedCookie[]
): Record<CookieCategory, number> {
  const summary: Record<CookieCategory, number> = {
    necessary: 0,
    functional: 0,
    analytics: 0,
    marketing: 0,
    unknown: 0,
  };

  for (const cookie of cookies) {
    summary[cookie.category]++;
  }

  return summary;
}

/**
 * Get high-risk cookies (analytics + marketing)
 */
export function getHighRiskCookies(cookies: CategorizedCookie[]): CategorizedCookie[] {
  return cookies.filter(
    (c) => c.category === "analytics" || c.category === "marketing"
  );
}

/**
 * Check if cookies suggest pre-consent tracking
 */
export function hasPreConsentTracking(cookies: CategorizedCookie[]): {
  hasTracking: boolean;
  trackingCookies: CategorizedCookie[];
  severity: "none" | "warn" | "fail";
} {
  const trackingCookies = getHighRiskCookies(cookies);

  if (trackingCookies.length === 0) {
    return { hasTracking: false, trackingCookies: [], severity: "none" };
  }

  // Marketing cookies before consent is a bigger issue
  const hasMarketing = trackingCookies.some((c) => c.category === "marketing");

  return {
    hasTracking: true,
    trackingCookies,
    severity: hasMarketing ? "fail" : "warn",
  };
}
