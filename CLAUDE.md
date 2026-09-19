# consent-compass

Evidence-first consent/cookie-banner scanning tool. URL in, prosecutor-grade
report out: screenshots, detected signals, findings, and a compliance score.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- Playwright (Chromium) drives `/api/scan`: loads the URL, screenshots it, runs
  heuristics to detect a consent banner and accept/reject actions
- Trigger.dev for background jobs (`src/trigger/compliance-scan.ts`)
- Sentry, Axiom, Langfuse for observability; Resend for email; Arcjet for
  request protection; PostHog for analytics
- better-sqlite3 for local tracker/category data (`scripts/generate-tracker-db.mjs`)
- pnpm (`packageManager: pnpm@10.34.5`)
- Vitest + Testing Library

## Commands

- `pnpm dev` - dev server (README uses `pnpm dev --port 3007`; the
  `CC_PORT` env var, default 3007, is read by `scripts/run-baseline-scans.mjs`,
  not by `next dev` itself)
- `pnpm build` - production build (`postbuild` runs `next-sitemap`)
- `pnpm lint` - ESLint (`eslint`)
- `pnpm biome:check` / `pnpm biome:fix` / `pnpm biome:format` - Biome, run
  separately from `pnpm lint`
- `pnpm test` / `pnpm test:run` / `pnpm test:coverage` - Vitest
- `pnpm analyze` - bundle analysis (`ANALYZE=true next build`)

## Layout

- `src/app/api/` - route handlers: `scan`, `rescan`, `report`, `history`,
  `compliance`, `categorize`, `diff`
- `src/components/`, `src/components/ui/`
- `src/lib/` - `cookies/`, `resend.ts`, plus the scan/compliance/heuristics
  logic covered by `src/lib/*.test.ts`
- `src/trigger/` - Trigger.dev task definitions
- `src/mocks/` - MSW mocks for tests
- `src/env.ts` - typed env schema (`@t3-oss/env-nextjs`)
- `scripts/generate-tracker-db.mjs`, `scripts/run-baseline-scans.mjs`

## Env vars

Validated in `src/env.ts` (server): `GROQ_API_KEY`, `RESEND_API_KEY`,
`TRIGGER_API_KEY`, `TRIGGER_SECRET_KEY`, `TRIGGER_API_URL` (optional),
`TRIGGER_PROJECT_REF` (optional), `AXIOM_TOKEN` (optional). Client:
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (optional),
`NEXT_PUBLIC_AXIOM_DATASET` (optional). Set `SKIP_ENV_VALIDATION` to bypass.

Read directly via `process.env` elsewhere (not in the `env.ts` schema):
`ARCJET_KEY`, `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `RESCAN_API_KEY`, `USE_MEMORY_DB`,
`CC_PORT`.

## Gotchas

- Both ESLint and Biome are configured; `pnpm lint` only runs ESLint, so run
  `pnpm biome:check` separately if you need Biome's checks.
- `GROQ_API_KEY` is required by `src/env.ts` but no source file under `src/`
  imports it or the `ai` / `@ai-sdk/*` packages.
