import * as Sentry from "@sentry/nextjs";

// Next 15+ loads this file on the client. The SDK only injects the legacy
// sentry.client.config.ts through a webpack entry, so under Turbopack (this
// app's bundler) that file was never bundled and client errors went nowhere.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
