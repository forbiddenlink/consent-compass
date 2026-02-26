---
date: 2026-02-26T09:56:16-08:00
session_name: general
researcher: Claude
git_commit: 6401a14
branch: main
repository: consent-compass
topic: "Post-Consent Comparison and Heuristics Testing"
tags: [testing, vitest, heuristics, post-consent, gdpr, cookies]
status: complete
last_updated: 2026-02-26
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: Post-Consent Comparison Implementation

## Task(s)

1. **Resume from previous handoff** - COMPLETED
   - Resumed from `thoughts/shared/handoffs/general/2026-02-26_09-33-42_testing-components-ci.md`
   - Previous session had completed testing infrastructure, component extraction, and CI setup

2. **Fixture-based tests for heuristics** - COMPLETED
   - Extracted pure functions from scan.ts to heuristics.ts for testability
   - Created 101 tests covering scoring, button detection, friction analysis
   - Fixed bug: "ok" incorrectly matched "cookie" via substring
   - heuristics.ts achieves 97.87% test coverage

3. **Post-consent comparison (Phase 2.2)** - COMPLETED
   - Click accept button after initial scan
   - Capture cookies after consent
   - Diff pre vs post consent state
   - Generate violation findings for tracking cookies set before consent

## Critical References
- `ROADMAP.md` - Feature roadmap with phase checkboxes
- `src/lib/scan.ts` - Main scanner with post-consent logic (lines 215-295)

## Recent changes

- `src/lib/heuristics.ts:1-290` - New extracted heuristics module with pure functions
- `src/lib/heuristics.ts:375-460` - Added compareCookies() and generatePostConsentFindings()
- `src/lib/heuristics.test.ts:1-850` - 114 tests for all heuristics functions
- `src/lib/scan.ts:1-15` - Updated imports to use heuristics module
- `src/lib/scan.ts:215-295` - Post-consent click and comparison logic
- `src/lib/types.ts:108-125` - Added postConsent type to ScanResult
- `ROADMAP.md` - Updated Phase 1.4 and 2.2 as complete

## Learnings

1. **Button classification edge case** - "ok" matches "cookie" via substring. Fixed with word-boundary checking for short hints (<=3 chars) using regex `\b${hint}\b`.

2. **Classification order matters** - Must check reject hints before accept hints, otherwise "only necessary" could match if "accept" appeared first.

3. **Post-consent timing** - 2 second wait after clicking accept is needed for cookies to be set by CMPs.

4. **Cookie key uniqueness** - Cookies are identified by `name@domain`, not just name. Same cookie name can exist on different domains.

## Post-Mortem (Required for Artifact Index)

### What Worked
- Extracting pure functions to heuristics.ts made testing possible without Playwright
- Inline HTML fixtures in test file keep tests self-contained
- Word-boundary regex for short hints prevents false positives
- compareCookies() cleanly separates new vs persisted vs violation cookies

### What Failed
- Tried: Simple substring matching for all hints -> Failed because: "ok" in "cookie" caused false positives
- Error: TypeScript errors when importing unused functions -> Fixed by: Only importing what's used in scan.ts

### Key Decisions
- Decision: Extract heuristics to separate module
  - Alternatives considered: Mock Playwright in tests
  - Reason: Pure functions are faster to test, no browser dependencies

- Decision: Check reject hints before accept hints in classifyButtonText
  - Alternatives considered: Keep original order
  - Reason: "only necessary" should be classified as reject, not matched by accept patterns

- Decision: 2 second wait after accept click
  - Alternatives considered: 1 second, network idle
  - Reason: CMPs often have async cookie setting, 2s balances speed vs reliability

## Artifacts

- `src/lib/heuristics.ts` - Extracted pure heuristics functions (97.87% coverage)
- `src/lib/heuristics.test.ts` - 114 tests with inline HTML fixtures
- `src/lib/types.ts:108-125` - postConsent type definition
- `src/lib/scan.ts:215-295` - Post-consent comparison implementation
- `ROADMAP.md` - Updated progress

## Action Items & Next Steps

From ROADMAP.md, recommended next:

1. **Integrate Open Cookie Database** (Phase 2.1) - Expand from 189 patterns to 10,000+
2. **WhoTracksMe integration** (Phase 2.4) - Classify trackers by type
3. **Visual button analysis** (Phase 3.1) - Capture button sizes/colors, check WCAG contrast
4. **Multi-layer CMP detection** (Phase 3.2) - Click through preference layers
5. **OpenAPI spec** - Document /api/scan endpoint

## Other Notes

- **Test command**: `pnpm test:run` (217 tests, ~250ms)
- **Coverage command**: `pnpm test:coverage`
- **Scanner version**: Bumped to 0.3.0 for post-consent feature
- **Commits this session**:
  - `aca4e24` - Testing infrastructure, components, CI
  - `b4e6b2f` - Heuristics extraction with 101 tests
  - `6401a14` - Post-consent comparison
