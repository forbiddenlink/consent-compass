import { defineConfig } from "@trigger.dev/sdk/v3";
import { playwright } from "@trigger.dev/build/extensions/playwright";

export default defineConfig({
  // Project refs are public identifiers, not secrets. A literal fallback keeps CI deploys working
  // without TRIGGER_PROJECT_REF set; the env var still overrides it.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_ipnltqacrdncgincejpt",
  runtime: "node-24",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [playwright()],
  },
});
