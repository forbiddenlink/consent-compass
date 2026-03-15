---
date: 2026-02-26T13:32:00-05:00
session_name: general
researcher: Claude
git_commit: 6047656
branch: main
repository: consent-compass
topic: "Multi-Layer CMP Rejection Flow Implementation"
tags: [friction, dark-patterns, cmp, shadow-dom, toggles]
status: complete
last_updated: 2026-02-26
last_updated_by: Claude
type: implementation
root_span_id:
turn_span_id:
---

# Handoff: Multi-Layer CMP Rejection Flow (Phase 3.2)

## Task(s)

1. **Resume from previous handoff** - COMPLETED
   - Resumed from `thoughts/shared/handoffs/general/2026-02-26_12-59-52_whotrackme-friction-scoring.md`

2. **Multi-Layer CMP Detection (Phase 3.2)** - COMPLETED
   - Designed via brainstorming session
   - Created `rejection-flow.ts` with greedy depth-first navigation
   - Shadow DOM piercing for Usercentrics, Cookiebot, Sourcepoint
   - Toggle detection and counting
   - Integrated into scan.ts

## Critical References
- `docs/plans/2026-02-26-multi-layer-cmp-detection.md` - Design document
- `ROADMAP.md` - Feature roadmap with phase checkboxes

## Recent changes

- `src/lib/rejection-flow.ts:1-350` - Core rejection flow algorithm
- `src/lib/rejection-flow.test.ts:1-280` - 18 tests for rejection flow
- `src/lib/heuristics.ts:32-54` - Added SAVE_HINTS, ADVANCED_HINTS arrays
- `src/lib/heuristics.ts:158-175` - Extended classifyButtonText() for save/advanced
- `src/lib/heuristics.test.ts:400-430` - 16 new tests for button classification
- `src/lib/scan.ts:16-24` - Import rejection-flow module, bump to v0.7.0
- `src/lib/scan.ts:93-112` - Store first manage button locator
- `src/lib/scan.ts:175-220` - Replace estimate with actual rejection flow measurement
- `src/lib/scan.ts:600` - Include rejectPath in friction output
- `ROADMAP.md:69-73` - Phase 3.2 marked complete

## Learnings

1. **Greedy depth-first is sufficient** - CMPs follow predictable patterns (2-3 layers max)
2. **Shadow DOM piercing** - Use Playwright's `>> shadow` combinator with known hosts
3. **Toggle state detection** - Check `isChecked()`, `aria-checked`, and active classes
4. **Re-navigate after flow** - Must reload page for post-consent comparison since rejection flow modifies state

## Post-Mortem (Required for Artifact Index)

### What Worked
- Brainstorming session clarified approach before coding
- Same test-first pattern as friction.ts - pure functions for findings generation
- Locator capture in button loop - minimal code change for integration

### What Failed
- None - clean implementation

### Key Decisions
- Decision: Click-to-reject only (not bidirectional)
  - Alternatives considered: Full bidirectional flow
  - Reason: Accept path already captured via post-consent comparison

- Decision: Greedy depth-first navigation
  - Alternatives considered: Exhaustive tree exploration
  - Reason: CMPs are predictable; simpler, faster, less error-prone

- Decision: Max depth of 4 layers
  - Alternatives considered: Unlimited, 3 layers
  - Reason: All known CMPs are 2-3 layers; 4 provides safety margin

## Artifacts

- `docs/plans/2026-02-26-multi-layer-cmp-detection.md` - Design document
- `src/lib/rejection-flow.ts` - Core algorithm
- `src/lib/rejection-flow.test.ts` - 18 tests
- `ROADMAP.md` - Updated Phase 3.2 as complete

## Action Items & Next Steps

From ROADMAP.md, recommended next:

1. **Data Persistence (Phase 4.1)** - SQLite/Postgres for scan history
2. **Export Formats (Phase 4.2)** - PDF report, JSON export, CSV cookie inventory
3. **Historical Comparison (Phase 4.3)** - Diff view between scans
4. **OpenAPI spec (Technical Debt)** - Document /api/scan endpoint

## Other Notes

- **Test command**: `pnpm test:run` (338 tests, ~440ms)
- **Scanner version**: Bumped to 0.7.0 for multi-layer CMP detection
- **Commits this session**:
  - `d7ebc37` - docs: add multi-layer CMP detection design
  - `6047656` - Implement multi-layer CMP rejection flow (Phase 3.2)
  - `1b7e1d8` - Add PDF report export
  - `0212151` - Add JSON/CSV exports (Phase 4.2 complete)
  - `dbf51d6` - Add OpenAPI spec (Tech Debt complete)
- **Phase 3 complete**: All dark pattern detection items now checked off
- **Phase 4.2 complete**: All export formats done
- **Export API**: `GET /api/report?url=X&format=pdf|json|csv`
