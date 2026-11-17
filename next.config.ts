import type { NextConfig } from "next";
import { withAxiom } from 'next-axiom';
import { withSentryConfig } from '@sentry/nextjs';
import withBundleAnalyzerInit from "@next/bundle-analyzer";
const withBundleAnalyzer = withBundleAnalyzerInit({ enabled: process.env.ANALYZE === "true" });


const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep the headless-Chromium packages out of the bundler so their runtime
  // files (playwright-core browsers.json, @sparticuz/chromium bin/*.br) resolve.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  // Neither package's dynamic file reads can be discovered by Next's tracer, so
  // include them explicitly for the routes that launch a browser.
  outputFileTracingIncludes: {
    "/api/scan": [
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
    "/api/report": [
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
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
