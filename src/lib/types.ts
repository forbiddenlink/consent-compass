export type ScanStatus = "ok" | "error" | "timeout" | "blocked";

export type CookieCategory = "necessary" | "functional" | "analytics" | "marketing" | "unknown";

export type Severity = "info" | "warn" | "fail";

export type ConsentFinding = {
  id: string;
  title: string;
  severity: Severity;
  detail: string;
  category?: "friction" | "pre-consent" | "transparency" | "accessibility" | "dark-pattern" | "gcm";
  evidence?: {
    kind: "text" | "selector" | "cookie" | "request" | "screenshot";
    value: string;
  };
};

export type CategorizedCookie = {
  name: string;
  domain?: string;
  path?: string;
  value?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  category: CookieCategory;
  vendor?: string;
  description?: string;
};

export type TrackedRequest = {
  url: string;
  resourceType: string;
  domain: string;
  isTracker: boolean;
  trackerCategory?: "analytics" | "advertising" | "fingerprinting" | "social";
  vendor?: string;
};

export type GoogleConsentMode = {
  detected: boolean;
  version?: "v1" | "v2";
  signals?: {
    ad_storage?: "granted" | "denied";
    analytics_storage?: "granted" | "denied";
    ad_user_data?: "granted" | "denied";
    ad_personalization?: "granted" | "denied";
  };
  issues: string[];
};

export type ButtonAnalysis = {
  text: string;
  selector: string;
  role: "accept" | "reject" | "manage" | "unknown";
  // Visual analysis
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  contrastRatio?: number;
  isProminent?: boolean;
};

export type FrictionAnalysis = {
  acceptClicks: number;
  rejectClicks: number;
  acceptPath: string[];
  rejectPath: string[];
  asymmetryScore: number; // 0-100, higher = more asymmetric (worse)
  notes: string[];
};

export type ScanResult = {
  status: ScanStatus;
  url: string;
  scannedAt: string;

  score: {
    overall: number; // 0-100
    choiceSymmetry: number;
    preConsentSignals: number;
    accessibility: number;
    transparency: number;
    // New compliance scores
    gdprCompliance?: "pass" | "warn" | "fail";
  };

  banner: {
    detected: boolean;
    confidence: number; // 0-1
    vendor?: string; // OneTrust, Cookiebot, etc.
    selectors: string[];
    acceptButtons: string[];
    rejectButtons: string[];
    managePrefsButtons: string[];
    buttons?: ButtonAnalysis[];
  };

  friction: FrictionAnalysis | {
    acceptClicks?: number;
    rejectClicks?: number;
    notes?: string[];
  };

  preConsent: {
    cookies: CategorizedCookie[];
    requests: TrackedRequest[];
    // Summaries
    cookiesByCategory?: Record<CookieCategory, number>;
    trackerCount?: number;
  };

  // Post-consent comparison
  postConsent?: {
    cookies: CategorizedCookie[];
    cookiesByCategory?: Record<CookieCategory, number>;
    // Cookies that appeared after consent (expected behavior)
    newCookies: CategorizedCookie[];
    // Cookies that were present before AND after (potential violation if tracking)
    persistedCookies: CategorizedCookie[];
    // Did we successfully click accept?
    acceptClicked: boolean;
    // Error if click failed
    clickError?: string;
  };

  // New: Google Consent Mode analysis
  googleConsentMode?: GoogleConsentMode;

  // New: Global Privacy Control
  gpcSupport?: {
    detected: boolean;
    honored: boolean;
  };

  // Dark pattern detection results
  darkPatterns?: {
    visualAsymmetry: number; // 0-100, higher = more asymmetric
    sizeRatio?: number; // accept area / reject area
    contrastDifference?: number; // accept contrast - reject contrast
    issues: string[];
  };

  artifacts: {
    screenshotPath?: string;
    bannerScreenshotPath?: string;
  };

  findings: ConsentFinding[];

  meta: {
    userAgent: string;
    tookMs: number;
    scannerVersion: string;
  };
};

// API response types
export type ScanError = {
  status: "error" | "timeout" | "blocked";
  error: string;
  code?: string;
  retryAfter?: number;
};

export type ScanResponse = ScanResult | ScanError;
