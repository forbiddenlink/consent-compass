# Consent Compass

Evidence-first consent scanning.

**Portfolio-first v0 goal:** URL → scan → a prosecutor-grade report UI (screenshots, signals, findings, and a score).

## What’s in v0 right now

- Next.js (App Router) + TypeScript + Tailwind
- `/api/scan` API route that uses **Playwright (Chromium)** to:
  - load the URL
  - take a full-page screenshot (saved to `/tmp/...png`)
  - run **heuristics** to detect a consent banner and common accept/reject actions
- A report-style UI on `/` that displays:
  - overall score + category scores
  - findings
  - detected signals + artifact path

## Run it

```bash
cd /Volumes/LizsDisk/consent-compass
pnpm install
pnpm dev --port 3007
```

Open: http://localhost:3007

## Notes / next upgrades (to make it “big swing”)

1. **Click-friction symmetry**
   - measure clicks to “Accept all” vs “Reject all”
   - flag hidden reject (second layer, tiny link, etc.)

2. **Pre-consent tracking evidence**
   - record cookies + network requests before any consent
   - generate a timeline of “tracking started at T+X ms”

3. **Evidence pack export**
   - PDF/markdown report with annotated screenshots and a reproducible run

4. **Dark Pattern modules** (platform direction)
   - cancellation flows
   - subscription dark patterns
   - pricing/fee reveal patterns
