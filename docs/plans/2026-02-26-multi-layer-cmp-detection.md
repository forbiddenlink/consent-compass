# Multi-Layer CMP Detection Design

**Date:** 2026-02-26
**Phase:** 3.2
**Status:** Approved

## Goal

Measure actual rejection friction by clicking through CMP preference layers, counting real clicks needed to reject all tracking.

## Approach

**Click-to-reject flow** with greedy depth-first navigation. The accept path is already captured via post-consent comparison; dark patterns hide in the rejection path.

## Core Algorithm

```
1. Start: Banner detected, no direct "Reject All" button found
2. Click "Manage Preferences" / "Settings" / "Customize" button
3. Wait for DOM change (new layer appears)
4. Search new layer for:
   - "Reject All" button → click it, done
   - "Save" / "Confirm" with all toggles OFF → click it, done
   - Another "More Options" / "Advanced" button → go deeper (repeat step 3)
5. Max depth: 4 layers (covers all known CMPs)
6. Track: clicks made, DOM snapshots, path taken
```

## Button Classifications

Extend `classifyButtonText()` with:
- `"save"` - "Save", "Save preferences", "Confirm choices"
- `"advanced"` - "Advanced", "More options", "Show purposes"

## Shadow DOM Handling

Known CMP shadow hosts:
```typescript
const SHADOW_HOSTS = [
  "#usercentrics-root",
  "#CybotCookiebotDialog",
  "[data-cmp-root]",
  "#sp_message_container_*",  // Sourcepoint
];
```

Use Playwright's `>> shadow` combinator for piercing.

## Toggle Detection

1. **Detect toggles**: `input[type="checkbox"]`, `[role="switch"]`, `[class*="toggle"]`
2. **Check state**: `isChecked()`, `aria-checked`, or `.active/.on/.enabled` class
3. **Turn all OFF**: Click each ON toggle, then click Save

## Click Counting

| Scenario | Clicks |
|----------|--------|
| Direct "Reject All" on layer 1 | 1 |
| Prefs → Reject All | 2 |
| Prefs → Turn off 3 toggles → Save | 5 |
| Prefs → Advanced → Reject All | 3 |

## Implementation Structure

### New File: `src/lib/rejection-flow.ts`

```typescript
export interface RejectionStep {
  action: "click" | "toggle";
  target: string;
  selector: string;
  depth: number;
}

export interface RejectionFlowResult {
  success: boolean;
  rejectClicks: number;
  toggleClicks: number;
  totalClicks: number;
  path: RejectionStep[];
  maxDepthReached: boolean;
  error?: string;
}

export async function measureRejectionFlow(
  page: Page,
  manageButton: Locator
): Promise<RejectionFlowResult>

export function classifyLayerButtons(buttons: ButtonInfo[]): LayerAnalysis
export function detectToggles(page: Page): Promise<ToggleInfo[]>
export function areAllTogglesOff(toggles: ToggleInfo[]): boolean
```

### Integration Point: `src/lib/scan.ts`

```typescript
// Around line 178, after detecting managePrefsButtons
if (rejectButtons.length === 0 && managePrefsButtons.length > 0) {
  const flowResult = await measureRejectionFlow(page, manageButton);
  rejectClicks = flowResult.totalClicks;
  rejectPath = flowResult.path;
}
```

## Configuration

```typescript
const CONFIG = {
  maxDepth: 4,
  layerWaitMs: 1000,
  clickTimeoutMs: 3000,
  totalTimeoutMs: 15000,
};
```

## Safety Measures

- Abort if page navigates away
- Abort if banner disappears
- Catch click errors gracefully (element detached, overlay blocking)

## New Findings

| ID | Condition | Severity |
|----|-----------|----------|
| `friction.rejection.multi_layer` | 3+ clicks to reject | `warn` |
| `friction.rejection.excessive` | 5+ clicks to reject | `fail` |
| `friction.rejection.toggle_maze` | Must click 4+ toggles | `fail` |
| `friction.rejection.hidden` | Reject only at depth 3+ | `warn` |
| `friction.rejection.failed` | Couldn't complete flow | `info` |

## Test Strategy

- Mock page fixtures for common CMPs (OneTrust, Cookiebot, Didomi)
- Test each layer transition
- Test toggle scenarios
- Test shadow DOM cases

## Files to Create/Modify

1. **Create:** `src/lib/rejection-flow.ts` - Core rejection flow logic
2. **Create:** `src/lib/rejection-flow.test.ts` - Tests
3. **Modify:** `src/lib/heuristics.ts` - Add `save` and `advanced` button classifications
4. **Modify:** `src/lib/scan.ts` - Integrate rejection flow measurement
5. **Modify:** `src/lib/types.ts` - Add RejectionStep to friction types
6. **Modify:** `ROADMAP.md` - Check off Phase 3.2 items
