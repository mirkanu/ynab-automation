---
phase: 22-ynab-pat-settings-api-keys
plan: 01
subsystem: api
tags: [ynab, rest-api, next-js, iron-session, settings]

# Dependency graph
requires:
  - phase: 21-iron-session-admin-auth-restoration
    provides: getAdminSession, getSetting, iron-session auth guard pattern

provides:
  - GET /api/ynab/budgets — fetches all budgets from YNAB API using PAT from DB
  - GET /api/ynab/budgets/[budgetId]/accounts — fetches active accounts for a budget (filtered)
  - GET /api/ynab/status — returns {connected, budgetId, accountId} from DB settings

affects: [22-03-settings-ui, 23-first-install-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Auth guard via getAdminSession().isLoggedIn before all protected routes
    - PAT read from DB via getSetting('YNAB_ACCESS_TOKEN') — no env var, no OAuth
    - YNAB API proxy: fetch with Bearer token, map to minimal {id, name} shape
    - Promise.all for parallel DB reads in status route

key-files:
  created: []
  modified:
    - src/app/api/ynab/budgets/route.ts
    - src/app/api/ynab/budgets/[budgetId]/accounts/route.ts
    - src/app/api/ynab/status/route.ts

key-decisions:
  - "Implemented YNAB token read inline (getSetting directly) rather than exporting getValidYnabToken from ynab.ts — plan specified not to import the unexported helper"
  - "Accounts route filters deleted and closed accounts before returning — only active accounts shown in settings UI"
  - "Status route reads three settings in parallel via Promise.all — no YNAB API call needed, purely local state"

patterns-established:
  - "Auth guard first pattern: every protected route checks session.isLoggedIn before any DB or API calls"
  - "YNAB proxy pattern: getSetting token → fetch YNAB API → map to {id, name} → return JSON"

requirements-completed: [YNAB-06, YNAB-07, YNAB-09]

# Metrics
duration: 13min
completed: 2026-04-10
---

# Phase 22 Plan 01: YNAB PAT Settings API Routes Summary

**Three YNAB proxy API routes replacing 501 stubs: budget listing, account listing (active-only), and connection status — all using PAT from DB via getSetting**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-10T21:15:49Z
- **Completed:** 2026-04-10T21:29:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- GET /api/ynab/budgets returns all budgets as `{budgets: [{id, name}]}` with proper 401/400/502 error handling
- GET /api/ynab/budgets/[budgetId]/accounts returns active accounts only (deleted and closed filtered out)
- GET /api/ynab/status reads YNAB_ACCESS_TOKEN, YNAB_BUDGET_ID, YNAB_ACCOUNT_ID in parallel and returns `{connected, budgetId, accountId}` — no YNAB API call needed

## Task Commits

1. **Task 1 + 2: Implement all three YNAB routes** - `23cceef` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/api/ynab/budgets/route.ts` - GET handler: auth guard, PAT from DB, YNAB API proxy, returns budget list
- `src/app/api/ynab/budgets/[budgetId]/accounts/route.ts` - GET handler: same pattern, filters deleted/closed, returns account list
- `src/app/api/ynab/status/route.ts` - GET handler: parallel settings read, returns connection status object

## Decisions Made

- Implemented PAT read inline with `getSetting('YNAB_ACCESS_TOKEN')` directly rather than importing the unexported `getValidYnabToken` from ynab.ts — plan specified not to use that private function
- Accounts route filters both `deleted` and `closed` accounts — closed accounts are archived in YNAB and no longer usable
- Status route uses `Promise.all` for three parallel setting reads — minimizes DB round-trips

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npm run build` encountered SIGABRT from Next.js worker process (resource constraint in the sandbox environment — "Failed to load CA certificates off thread: resource temporarily unavailable"). TypeScript compilation confirmed clean via `npx tsc --noEmit --skipLibCheck` with zero src/ errors. Pre-existing test file TS errors (v5.0 era, noted in STATE.md) are out of scope for this plan and will be fixed in Phase 24.

## User Setup Required

None — no external service configuration required. Routes will return 400 until YNAB_ACCESS_TOKEN is configured via settings UI (Plan 22-03).

## Next Phase Readiness

- All three routes are production-ready and will unblock the Settings UI dropdowns in Plan 22-03
- Plan 22-02 (running in parallel) owns authorize/callback/disconnect/selection routes — no conflicts
- Plan 22-03 (Settings UI) can proceed immediately after Wave 1 (this plan + 22-02) completes

---
*Phase: 22-ynab-pat-settings-api-keys*
*Completed: 2026-04-10*
