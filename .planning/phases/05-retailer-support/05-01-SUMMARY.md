---
phase: 05-retailer-support
plan: "01"
subsystem: api
tags: [claude, anthropic, ynab, typescript, vitest, tdd]

# Dependency graph
requires: []
provides:
  - parseOrderEmail function with retailer field extraction (renamed from parseAmazonEmail, backward-compat alias retained)
  - ParsedOrder interface with amount, description, retailer fields
  - createYnabTransaction with dynamic payeeName parameter (no hardcoded 'Amazon')
  - YnabTransactionParams interface with payeeName field
affects: [05-retailer-support plan 02 — webhook wiring uses these updated interfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: write failing tests first, then implement to pass"
    - "Backward-compat alias: export const parseAmazonEmail = parseOrderEmail for non-breaking rename"
    - "Validation guard: typeof parsed.retailer !== 'string' returns null"

key-files:
  created: []
  modified:
    - src/lib/claude.ts
    - src/lib/claude.test.ts
    - src/lib/ynab.ts
    - src/lib/ynab.test.ts
    - src/app/api/webhook/route.ts

key-decisions:
  - "Renamed parseAmazonEmail to parseOrderEmail and exported backward-compat alias to avoid breaking route.ts during wave 1"
  - "payeeName is required (not optional) in YnabTransactionParams — callers must explicitly pass the retailer name"
  - "retailer field validated as string; missing field returns null (same null-on-failure contract as existing fields)"

patterns-established:
  - "Any-retailer extraction: prompt now asks for retailer/merchant name in JSON response alongside amount and description"
  - "Dynamic payee: YNAB payee_name driven from parsed.retailer, not hardcoded constant"

requirements-completed: [RETAIL-02, RETAIL-03]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 5 Plan 01: Library Contract Updates Summary

**parseOrderEmail extracts retailer name from any order email; createYnabTransaction uses dynamic payeeName replacing hardcoded 'Amazon'**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T19:54:19Z
- **Completed:** 2026-03-24T20:00:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `ParsedOrder` interface gains `retailer: string` field; Claude prompt updated to extract merchant name from any retailer
- `parseOrderEmail` (renamed from `parseAmazonEmail`) validates retailer presence — returns null if absent
- `YnabTransactionParams` gains required `payeeName: string`; `createYnabTransaction` no longer hardcodes 'Amazon'
- All 38 tests pass (22 lib tests + pre-existing email/webhook tests); TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ParsedOrder interface and parseOrderEmail in claude.ts** - `5c976f8` (feat)
2. **Task 2: Add payeeName parameter to createYnabTransaction in ynab.ts** - `d9d5221` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD tasks had test-then-implement commits per task._

## Files Created/Modified

- `src/lib/claude.ts` - ParsedOrder + retailer field; parseOrderEmail function; parseAmazonEmail alias
- `src/lib/claude.test.ts` - Updated mocks with retailer field; 2 new tests (Costco, missing retailer)
- `src/lib/ynab.ts` - payeeName field in interface; dynamic payee_name in POST body
- `src/lib/ynab.test.ts` - BASE_PARAMS updated with payeeName; Costco dynamic payee test added
- `src/app/api/webhook/route.ts` - Auto-fix: passed payeeName: parsed.retailer to createYnabTransaction

## Decisions Made

- Retained `parseAmazonEmail` as backward-compat alias so `route.ts` import does not break during wave 1 (plan 02 will update it)
- Made `payeeName` required (not optional) — the caller always knows the retailer at this point (from `parsed.retailer`)
- Retailer validation uses the same null-return pattern as amount/description — consistent contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added payeeName to createYnabTransaction call in route.ts**
- **Found during:** Final TypeScript compilation check
- **Issue:** route.ts called createYnabTransaction without the now-required payeeName field, causing TS2345 compile error
- **Fix:** Added `payeeName: parsed.retailer` to the createYnabTransaction call in route.ts
- **Files modified:** src/app/api/webhook/route.ts
- **Verification:** `npx tsc --noEmit` exits 0; `npm test` still passes 38 tests
- **Committed in:** `2b60cab`

---

**Total deviations:** 1 auto-fixed (1 blocking compile error)
**Impact on plan:** Necessary for TypeScript compilation to pass. Anticipated in plan comments but blocked compilation — fixed inline as Rule 3.

## Issues Encountered

None beyond the blocking TS compile error documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 library contracts complete: `parseOrderEmail` + `ParsedOrder` with retailer, `createYnabTransaction` with dynamic payeeName
- Plan 02 (webhook wiring, wave 2) can now update the webhook handler to pass retailer through from email parse to YNAB transaction
- The `parseAmazonEmail` alias in claude.ts and the existing route.ts import are still in sync — plan 02 should update both

---
*Phase: 05-retailer-support*
*Completed: 2026-03-24*

## Self-Check: PASSED

- src/lib/claude.ts — FOUND
- src/lib/ynab.ts — FOUND
- .planning/phases/05-retailer-support/05-01-SUMMARY.md — FOUND
- Commit 5c976f8 — FOUND
- Commit d9d5221 — FOUND
- Commit 2b60cab — FOUND
