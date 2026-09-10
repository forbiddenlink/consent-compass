import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Without this, errors thrown in server components and route handlers are
// rendered by Next and never reach Sentry.
export const onRequestError = Sentry.captureRequestError;

