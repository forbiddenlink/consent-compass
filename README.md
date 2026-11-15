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
- **History and diff** store scan results in a local SQLite file (`data/scans.db`, in memory under test) so you can compare two scans and see
  compliance regressions over time
- **Export** as PDF (annotated screenshots), JSON, or a CSV cookie inventory

## Quickstart

```bash
pnpm install
pnpm dev
```

Prerequisites: Node and pnpm (pinned by `packageManager` in `package.json`). Open http://localhost:3000. `scripts/run-baseline-scans.mjs` reads `CC_PORT` (default 3007) for the server it scans.

### Env vars

There is no `.env.example`. `src/env.ts` holds the validated schema. Required server-side: `GROQ_API_KEY`, `RESEND_API_KEY`, `TRIGGER_API_KEY`, `TRIGGER_SECRET_KEY`. Required client-side: `NEXT_PUBLIC_POSTHOG_KEY`. Optional: `AXIOM_TOKEN`, `NEXT_PUBLIC_AXIOM_DATASET`, `NEXT_PUBLIC_POSTHOG_HOST`, `TRIGGER_API_URL`, `TRIGGER_PROJECT_REF`. `GROQ_API_KEY` is in the schema but no code under `src/` or `lib/` reads it. Set `SKIP_ENV_VALIDATION=1` to bypass the schema for a quick local run.

## Scripts

```bash
pnpm dev
pnpm start            # serve the production build
pnpm build             # postbuild runs next-sitemap
pnpm lint              # eslint
pnpm biome:check / pnpm biome:fix / pnpm biome:format   # run separately from lint
pnpm test              # vitest watch
pnpm test:run / pnpm test:coverage
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

## License

MIT. See `LICENSE`.
