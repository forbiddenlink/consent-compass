# Consent Compass

Evidence-first consent/cookie-banner scanning tool. Enter a URL and get a prosecutor-grade
report: screenshots, detected signals, findings, and a compliance score.

Live at https://consent-compass.vercel.app.

## How it works

`/api/scan` drives Playwright (Chromium) to load a URL, screenshot it, and run heuristics that
detect the consent banner and its accept/reject actions. From there:

- **Multi-layer CMP detection** clicks through preference layers, counts the real clicks needed
  to reject, and detects shadow-DOM consent banners
- **Friction scoring** combines click asymmetry (extra clicks to reject vs. accept) and dark
  pattern language detection into a 0-100 score
- **Cookie categorization** matches cookies against a pattern database of known vendors
- **History and diff** store scan results (SQLite/Postgres) so you can compare two scans and see
  compliance regressions over time
- **Export** as PDF (annotated screenshots), JSON, or a CSV cookie inventory

## Quickstart

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 (or set `CC_PORT` if you use `scripts/run-baseline-scans.mjs`).

### Env vars

See `src/env.ts` for the validated schema. `GROQ_API_KEY`, `RESEND_API_KEY`, `TRIGGER_API_KEY`,
and `TRIGGER_SECRET_KEY` are required server-side; `NEXT_PUBLIC_POSTHOG_KEY` and the Trigger.dev
project vars are optional. Set `SKIP_ENV_VALIDATION=1` to bypass the schema for a quick local run.

## Scripts

```bash
pnpm dev
pnpm build             # postbuild runs next-sitemap
pnpm lint              # eslint
pnpm biome:check / pnpm biome:fix / pnpm biome:format   # run separately from lint
pnpm test / pnpm test:run / pnpm test:coverage
pnpm analyze           # ANALYZE=true next build
```

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Playwright, Trigger.dev for background scan
jobs, better-sqlite3 for tracker/category data, Vitest + Testing Library. See `CLAUDE.md` for
the full architecture and API route layout.

## Resources

- [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)
- [WhoTracksMe](https://github.com/whotracksme/whotracks.me)
- [CNIL Dark Patterns Guide](https://www.cnil.fr/en/dark-patterns-cookie-banners)
- [Google Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent)
