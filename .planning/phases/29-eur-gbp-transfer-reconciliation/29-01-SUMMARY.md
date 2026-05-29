---
phase: 29-eur-gbp-transfer-reconciliation
plan: 01
subsystem: api
tags: [ynab, wise, transfer-reconciliation, gbp, eur, typescript]

# Dependency graph
requires:
  - phase: 22-ynab-pat-settings-api-keys
    provides: getSetting('YNAB_ACCESS_TOKEN') and YNAB_BUDGET_ID stored in DB
  - phase: 14-settings-editor
    provides: YNAB_CURRENCY_ACCOUNTS setting (EUR account ID JSON map)
provides:
  - detectTransferPairs(): scans last 7 days for EUR→GBP transfer pairs needing reconciliation
  - applyTransferFix(): applies 3-step YNAB fix (delete EUR txn, set GBP payee, clear counterpart)
  - GET /api/tools/fix-eur-transfers?dry=true — detection endpoint
  - POST /api/tools/fix-eur-transfers — apply endpoint
affects: [29-02-ui-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Direct YNAB REST calls via native fetch with Bearer token from getSetting (no SDK)
    - ynabFetch() helper centralises auth header injection and error formatting
    - Per-pair partial failure pattern in applyTransferFix (non-fatal, collected in results array)

key-files:
  created:
    - src/lib/ynab-transfers.ts
    - src/app/api/tools/fix-eur-transfers/route.ts
  modified: []

key-decisions:
  - "Read YNAB token via getSetting('YNAB_ACCESS_TOKEN') directly — getValidYnabToken is unexported from ynab.ts"
  - "GBP account IDs and Transfer payee ID hardcoded in ynab-transfers.ts (verified 2026-05-29)"
  - "GET without ?dry=true returns 400 to prevent misuse; middleware handles auth upstream"
  - "applyTransferFix is non-fatal per pair — partial runs record which pairs succeeded"

patterns-established:
  - "ynabFetch() helper: 204/content-length=0 guard returns null; all other OK responses parse JSON"
  - "detectTransferPairs matches EUR outgoing to GBP incoming by same calendar date"

requirements-completed:
  - XFER-01
  - XFER-02

# Metrics
duration: 6min
completed: 2026-05-29
---

# Phase 29 Plan 01: EUR→GBP Transfer Reconciliation — Backend Logic Summary

**YNAB transfer reconciliation backend: detect EUR→GBP Wise transfer pairs and apply 3-step YNAB fix via native fetch REST calls**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-29T18:54:35Z
- **Completed:** 2026-05-29T19:00:13Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments

- `src/lib/ynab-transfers.ts`: `detectTransferPairs()` fetches EUR + GBP accounts for last 7 days, filters out deleted/reconciled/fee txns, matches by date, returns `TransferPair[]` with confidence score
- `applyTransferFix()`: executes 3-step YNAB mutation (DELETE EUR txn, PUT GBP payee to Transfer, PUT counterpart cleared+approved); non-fatal per pair with `FixResult` error capture
- `src/app/api/tools/fix-eur-transfers/route.ts`: GET `?dry=true` returns pairs, POST applies fix; iron-session middleware protects both handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ynab-transfers.ts** - `f51883c` (feat)
2. **Task 2: Create GET+POST route** - `2a9f5d5` (feat)

## Files Created/Modified

- `src/lib/ynab-transfers.ts` - `TransferPair`, `FixResult` types; `detectTransferPairs()`, `applyTransferFix()` exports
- `src/app/api/tools/fix-eur-transfers/route.ts` - GET (dry-run detection) and POST (apply fix) handlers

## Decisions Made

- Used `getSetting('YNAB_ACCESS_TOKEN')` directly since `getValidYnabToken` is not exported from `ynab.ts`
- Hardcoded UK Current, GBP Wise, and Transfer payee IDs in `ynab-transfers.ts` per plan spec (verified account IDs 2026-05-29)
- GET without `?dry=true` returns 400 — prevents accidental empty responses being misread as "no pairs found"
- POST re-detects at call time — no stale state between Analysis and Apply UI interactions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript compiler (`tsc`) not available locally (no `node_modules` in worktree; Docker handles builds on server). Used manual code review to verify correctness against existing patterns in `src/lib/ynab.ts` and `src/app/api/replay/route.ts`.

## User Setup Required

None - no external service configuration required. Account IDs and token are already in the YNAB settings DB from prior phases.

## Next Phase Readiness

- Plan 29-02 can now build the UI page on top of GET `?dry=true` and POST endpoints
- Both endpoints return structured JSON (`pairs`, `fixed`, `failed`, `results`) matching the UI-SPEC data requirements

---
*Phase: 29-eur-gbp-transfer-reconciliation*
*Completed: 2026-05-29*
