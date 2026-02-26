import { describe, it, expect, vi } from "vitest";
import {
  checkWellKnownGpc,
  checkJsApiGpc,
  checkGpcSupport,
  verifyGpcHonored,
  analyzeGpc,
  generateGpcFindings,
  type GpcResult,
} from "./gpc";

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Playwright Page object
function createMockPage(options: {
  url?: string;
  wellKnownResponse?: {
    status: number;
    json?: unknown;
    error?: Error;
  };
  navigatorGpc?: boolean | undefined;
} = {}) {
  const mockResponse = {
    status: () => options.wellKnownResponse?.status ?? 404,
    json: async () => {
      if (options.wellKnownResponse?.error) {
        throw options.wellKnownResponse.error;
      }
      return options.wellKnownResponse?.json;
    },
  };

  return {
    url: () => options.url ?? "https://example.com/page",
    request: {
      get: vi.fn().mockResolvedValue(mockResponse),
    },
    evaluate: vi.fn().mockImplementation(async () => {
      // Return whether GPC is supported based on navigatorGpc option
      // navigatorGpc === true means supported, undefined means not supported
      return options.navigatorGpc !== undefined;
    }),
  };
}

// ============================================================================
// Test: checkWellKnownGpc
// ============================================================================

describe("checkWellKnownGpc", () => {
  it("returns found: true and gpc: true when valid gpc.json exists", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: true },
      },
    });

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(true);
    expect(result?.gpc).toBe(true);
    expect(result?.error).toBeUndefined();
  });

  it("returns found: true and gpc: false when gpc.json has gpc: false", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: false },
      },
    });

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(true);
    expect(result?.gpc).toBe(false);
  });

  it("returns found: true and gpc: false for invalid JSON", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        error: new Error("Invalid JSON"),
      },
    });

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(true);
    expect(result?.gpc).toBe(false);
    expect(result?.error).toBe("Invalid JSON in gpc.json");
  });

  it("returns found: false when gpc.json returns 404", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 404,
      },
    });

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(false);
    expect(result?.gpc).toBeUndefined();
  });

  it("returns found: false with error when request fails", async () => {
    const mockPage = {
      url: () => "https://example.com",
      request: {
        get: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    };

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(false);
    expect(result?.error).toBe("Network error");
  });

  it("handles empty JSON response", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: {},
      },
    });

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(true);
    expect(result?.gpc).toBe(false);
  });

  it("handles null gpc value", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: null },
      },
    });

    const result = await checkWellKnownGpc(mockPage as never);

    expect(result?.found).toBe(true);
    expect(result?.gpc).toBe(false);
  });
});

// ============================================================================
// Test: checkJsApiGpc
// ============================================================================

describe("checkJsApiGpc", () => {
  it("returns supported: true when navigator.globalPrivacyControl exists", async () => {
    const mockPage = createMockPage({
      navigatorGpc: true,
    });

    const result = await checkJsApiGpc(mockPage as never);

    expect(result?.supported).toBe(true);
  });

  it("returns supported: false when navigator.globalPrivacyControl is undefined", async () => {
    const mockPage = createMockPage({
      navigatorGpc: undefined,
    });

    const result = await checkJsApiGpc(mockPage as never);

    expect(result?.supported).toBe(false);
  });

  it("returns supported: false when evaluate throws", async () => {
    const mockPage = {
      evaluate: vi.fn().mockRejectedValue(new Error("Evaluation failed")),
    };

    const result = await checkJsApiGpc(mockPage as never);

    expect(result?.supported).toBe(false);
  });
});

// ============================================================================
// Test: checkGpcSupport
// ============================================================================

describe("checkGpcSupport", () => {
  it("returns detected: true with method: well-known when gpc.json found", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: true },
      },
      navigatorGpc: undefined,
    });

    const result = await checkGpcSupport(mockPage as never);

    expect(result.detected).toBe(true);
    expect(result.method).toBe("well-known");
    expect(result.wellKnown?.found).toBe(true);
    expect(result.wellKnown?.gpc).toBe(true);
  });

  it("returns detected: true with method: js-api when navigator.globalPrivacyControl exists", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: { status: 404 },
      navigatorGpc: true,
    });

    const result = await checkGpcSupport(mockPage as never);

    expect(result.detected).toBe(true);
    expect(result.method).toBe("js-api");
    expect(result.jsApi?.supported).toBe(true);
  });

  it("prefers well-known method when both are available", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: true },
      },
      navigatorGpc: true,
    });

    const result = await checkGpcSupport(mockPage as never);

    expect(result.detected).toBe(true);
    expect(result.method).toBe("well-known");
  });

  it("returns detected: false when neither method finds support", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: { status: 404 },
      navigatorGpc: undefined,
    });

    const result = await checkGpcSupport(mockPage as never);

    expect(result.detected).toBe(false);
    expect(result.method).toBeUndefined();
  });

  it("returns detected: false when gpc.json exists but gpc: false", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: false },
      },
      navigatorGpc: undefined,
    });

    const result = await checkGpcSupport(mockPage as never);

    expect(result.detected).toBe(false);
    expect(result.wellKnown?.found).toBe(true);
    expect(result.wellKnown?.gpc).toBe(false);
  });
});

// ============================================================================
// Test: verifyGpcHonored
// ============================================================================

describe("verifyGpcHonored", () => {
  it("returns honored: true when Google Consent Mode defaults to denied", async () => {
    const mockPage = createMockPage();

    const result = await verifyGpcHonored(mockPage as never, {
      googleConsentMode: {
        detected: true,
        signals: {
          ad_storage: "denied",
          analytics_storage: "denied",
        },
      },
    });

    expect(result.honored).toBe(true);
    expect(result.method).toBe("consent-default");
    expect(result.evidence).toContain("denied");
  });

  it("returns honored: true when ad_storage is denied", async () => {
    const mockPage = createMockPage();

    const result = await verifyGpcHonored(mockPage as never, {
      googleConsentMode: {
        detected: true,
        signals: {
          ad_storage: "denied",
          analytics_storage: "granted",
        },
      },
    });

    expect(result.honored).toBe(true);
    expect(result.method).toBe("consent-default");
  });

  it("returns honored: true when no trackers detected", async () => {
    const mockPage = createMockPage();

    const result = await verifyGpcHonored(mockPage as never, {
      preConsentTrackerCount: 0,
    });

    expect(result.honored).toBe(true);
    expect(result.method).toBe("tracker-reduction");
  });

  it("returns honored: false when consent is granted and trackers exist", async () => {
    const mockPage = createMockPage();

    const result = await verifyGpcHonored(mockPage as never, {
      preConsentTrackerCount: 5,
      googleConsentMode: {
        detected: true,
        signals: {
          ad_storage: "granted",
          analytics_storage: "granted",
        },
      },
    });

    expect(result.honored).toBe(false);
    expect(result.evidence).toContain("Could not verify");
  });

  it("returns honored: false when no options provided", async () => {
    const mockPage = createMockPage();

    const result = await verifyGpcHonored(mockPage as never);

    expect(result.honored).toBe(false);
  });

  it("returns honored: false when Google Consent Mode not detected", async () => {
    const mockPage = createMockPage();

    const result = await verifyGpcHonored(mockPage as never, {
      preConsentTrackerCount: 3,
      googleConsentMode: {
        detected: false,
      },
    });

    expect(result.honored).toBe(false);
  });
});

// ============================================================================
// Test: analyzeGpc
// ============================================================================

describe("analyzeGpc", () => {
  it("returns full analysis with support and honoring when detected", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: true },
      },
    });

    const result = await analyzeGpc(mockPage as never, {
      preConsentTrackerCount: 0,
    });

    expect(result.detected).toBe(true);
    expect(result.honored).toBe(true);
    expect(result.support?.method).toBe("well-known");
    expect(result.honoredResult?.method).toBe("tracker-reduction");
  });

  it("returns detected: false and honored: false when not supported", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: { status: 404 },
      navigatorGpc: undefined,
    });

    const result = await analyzeGpc(mockPage as never);

    expect(result.detected).toBe(false);
    expect(result.honored).toBe(false);
    expect(result.honoredResult).toBeUndefined();
  });

  it("returns detected: true and honored: false when support exists but not honored", async () => {
    const mockPage = createMockPage({
      wellKnownResponse: {
        status: 200,
        json: { gpc: true },
      },
    });

    const result = await analyzeGpc(mockPage as never, {
      preConsentTrackerCount: 5,
      googleConsentMode: {
        detected: true,
        signals: {
          ad_storage: "granted",
          analytics_storage: "granted",
        },
      },
    });

    expect(result.detected).toBe(true);
    expect(result.honored).toBe(false);
  });
});

// ============================================================================
// Test: generateGpcFindings
// ============================================================================

describe("generateGpcFindings", () => {
  it("generates info finding when GPC is supported and honored", () => {
    const result: GpcResult = {
      detected: true,
      honored: true,
      support: {
        detected: true,
        method: "well-known",
        wellKnown: { found: true, gpc: true },
      },
      honoredResult: {
        honored: true,
        method: "consent-default",
        evidence: "Google Consent Mode defaults: ad_storage=denied",
      },
    };

    const findings = generateGpcFindings(result);

    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("gpc.honored");
    expect(findings[0].severity).toBe("info");
    expect(findings[0].title).toContain("supported and honored");
    expect(findings[0].evidence?.value).toContain("well-known");
  });

  it("generates warn finding when GPC is supported but not verified honored", () => {
    const result: GpcResult = {
      detected: true,
      honored: false,
      support: {
        detected: true,
        method: "js-api",
        jsApi: { supported: true },
      },
      honoredResult: {
        honored: false,
        evidence: "Could not verify GPC signal is being honored",
      },
    };

    const findings = generateGpcFindings(result);

    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("gpc.not_honored");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].title).toContain("may not be honored");
    expect(findings[0].evidence?.value).toContain("js-api");
  });

  it("generates info finding when GPC is not supported", () => {
    const result: GpcResult = {
      detected: false,
      honored: false,
      support: {
        detected: false,
        wellKnown: { found: false },
        jsApi: { supported: false },
      },
    };

    const findings = generateGpcFindings(result);

    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("gpc.not_supported");
    expect(findings[0].severity).toBe("info");
    expect(findings[0].title).toContain("No GPC support");
    expect(findings[0].detail).toContain("not a violation");
  });

  it("includes detail with evidence when honored", () => {
    const result: GpcResult = {
      detected: true,
      honored: true,
      support: { detected: true, method: "well-known" },
      honoredResult: {
        honored: true,
        evidence: "No trackers detected before consent with GPC signal",
      },
    };

    const findings = generateGpcFindings(result);

    expect(findings[0].detail).toContain("No trackers detected");
  });

  it("categorizes all findings as transparency", () => {
    const results: GpcResult[] = [
      { detected: true, honored: true, support: { detected: true, method: "well-known" } },
      { detected: true, honored: false, support: { detected: true, method: "js-api" } },
      { detected: false, honored: false },
    ];

    for (const result of results) {
      const findings = generateGpcFindings(result);
      expect(findings[0].category).toBe("transparency");
    }
  });
});
