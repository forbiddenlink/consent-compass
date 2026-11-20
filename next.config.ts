import type { NextConfig } from "next";
import { withAxiom } from 'next-axiom';
import { withSentryConfig } from '@sentry/nextjs';
import withBundleAnalyzerInit from "@next/bundle-analyzer";
const withBundleAnalyzer = withBundleAnalyzerInit({ enabled: process.env.ANALYZE === "true" });


const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright resolves browsers.json dynamically, so Next's tracer cannot discover it.
  // Keep the runtime package only with the scan route that imports Playwright.
  outputFileTracingIncludes: {
    "/api/scan": [
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(withSentryConfig(withAxiom(nextConfig), {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }));
