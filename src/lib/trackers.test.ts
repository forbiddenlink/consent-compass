import { describe, it, expect } from "vitest";
import {
  classifyTrackerDomain,
  isTrackerDomain,
  classifyTrackerDomains,
  countTrackersByCategory,
} from "./trackers";

describe("classifyTrackerDomain", () => {
  describe("advertising trackers", () => {
    it("identifies doubleclick.net as advertising", () => {
      const result = classifyTrackerDomain("doubleclick.net");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising");
    });

    it("identifies 2mdn.net as advertising (Google Marketing)", () => {
      const result = classifyTrackerDomain("2mdn.net");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising");
      expect(result?.tracker).toBe("Google Marketing Platform");
    });

    it("identifies facebook.com as advertising", () => {
      // Facebook is primarily an ad platform, WhoTracksMe classifies it as advertising
      const result = classifyTrackerDomain("facebook.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising");
    });

    it("identifies criteo.com as advertising", () => {
      const result = classifyTrackerDomain("criteo.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising");
    });
  });

  describe("analytics trackers", () => {
    it("identifies google-analytics.com as analytics", () => {
      const result = classifyTrackerDomain("google-analytics.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });

    it("identifies hotjar.com as analytics", () => {
      const result = classifyTrackerDomain("hotjar.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });

    it("identifies mixpanel.com as analytics", () => {
      const result = classifyTrackerDomain("mixpanel.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });
  });

  describe("social trackers", () => {
    it("identifies twitter.com as social", () => {
      const result = classifyTrackerDomain("twitter.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("social");
    });

    it("identifies cdninstagram.com as social", () => {
      const result = classifyTrackerDomain("cdninstagram.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("social");
      expect(result?.tracker).toBe("Instagram");
    });
  });

  describe("subdomain matching", () => {
    it("matches www.google-analytics.com", () => {
      const result = classifyTrackerDomain("www.google-analytics.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });

    it("matches pixel.facebook.com", () => {
      const result = classifyTrackerDomain("pixel.facebook.com");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising"); // Facebook is an ad platform
    });

    it("matches ads.doubleclick.net", () => {
      const result = classifyTrackerDomain("ads.doubleclick.net");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising");
    });

    it("matches deep subdomains like cdn.ads.example.doubleclick.net", () => {
      const result = classifyTrackerDomain("cdn.ads.example.doubleclick.net");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("advertising");
    });
  });

  describe("non-trackers", () => {
    it("returns null for example.com", () => {
      expect(classifyTrackerDomain("example.com")).toBeNull();
    });

    it("returns null for localhost", () => {
      expect(classifyTrackerDomain("localhost")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(classifyTrackerDomain("")).toBeNull();
    });

    it("returns null for github.com", () => {
      expect(classifyTrackerDomain("github.com")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles trailing dot in domain", () => {
      const result = classifyTrackerDomain("google-analytics.com.");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });

    it("handles uppercase domains", () => {
      const result = classifyTrackerDomain("GOOGLE-ANALYTICS.COM");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });

    it("handles mixed case domains", () => {
      const result = classifyTrackerDomain("Google-Analytics.COM");
      expect(result).not.toBeNull();
      expect(result?.category).toBe("analytics");
    });
  });
});

describe("isTrackerDomain", () => {
  it("returns true for known trackers", () => {
    expect(isTrackerDomain("google-analytics.com")).toBe(true);
    expect(isTrackerDomain("doubleclick.net")).toBe(true);
  });

  it("returns false for non-trackers", () => {
    expect(isTrackerDomain("example.com")).toBe(false);
    expect(isTrackerDomain("")).toBe(false);
  });
});

describe("classifyTrackerDomains", () => {
  it("classifies multiple domains", () => {
    const domains = [
      "google-analytics.com",
      "example.com",
      "doubleclick.net",
      "twitter.com",
    ];

    const result = classifyTrackerDomains(domains);

    expect(result.size).toBe(3); // example.com not a tracker
    expect(result.get("google-analytics.com")?.category).toBe("analytics");
    expect(result.get("doubleclick.net")?.category).toBe("advertising");
    expect(result.get("twitter.com")?.category).toBe("social");
    expect(result.has("example.com")).toBe(false);
  });

  it("handles empty array", () => {
    const result = classifyTrackerDomains([]);
    expect(result.size).toBe(0);
  });
});

describe("countTrackersByCategory", () => {
  it("counts trackers by category", () => {
    const domains = [
      "google-analytics.com",
      "hotjar.com",
      "doubleclick.net",
      "criteo.com",
      "twitter.com",
      "example.com", // not a tracker
    ];

    const counts = countTrackersByCategory(domains);

    expect(counts.analytics).toBe(2); // google-analytics, hotjar
    expect(counts.advertising).toBe(2); // doubleclick, criteo
    expect(counts.social).toBe(1); // twitter
    expect(counts.fingerprinting).toBe(0);
  });

  it("returns all zeros for non-tracker domains", () => {
    const domains = ["example.com", "github.com", "localhost"];
    const counts = countTrackersByCategory(domains);

    expect(counts.advertising).toBe(0);
    expect(counts.analytics).toBe(0);
    expect(counts.social).toBe(0);
    expect(counts.fingerprinting).toBe(0);
  });

  it("handles empty array", () => {
    const counts = countTrackersByCategory([]);

    expect(counts.advertising).toBe(0);
    expect(counts.analytics).toBe(0);
    expect(counts.social).toBe(0);
    expect(counts.fingerprinting).toBe(0);
  });
});
