---
phase: 22-ynab-pat-settings-api-keys
plan: 03
subsystem: settings-ui
tags: [settings, ynab, api-keys, next-js, client-components]

# Dependency graph
requires:
  - phase: 22-01
    provides: GET /api/ynab/budgets, GET /api/ynab/budgets/[id]/accounts, GET /api/ynab/status
  - phase: 21-iron-session-admin-auth-restoration
    provides: getSetting, iron-session auth guard

provides:
  - YnabConnectionSection: PAT input + live budget/account dropdowns; save persists to DB
  - ApiKeysSection: Editable fields for YNAB_ACCESS_TOKEN, ANTHROPIC_API_KEY, RESEND_API_KEY, PIPEDREAM_WEBHOOK_URL
  - settings/page.tsx: reads YNAB_BUDGET_ID from DB; passes real connected + budgetId to Sender/Currency sections

affects: [22-04, 23-first-install-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useEffect on mount to fetch /api/ynab/status and pre-fill selection state
    - PUT /api/settings { settings: {...} } body format (matches existing route handler)
    - onConnectionChange callback prop to notify parent of PAT/selection saves
    - S-object inline style pattern consistent with SenderRulesSection and AdminPasswordSection

key-files:
  created:
    - src/app/(dashboard)/settings/ApiKeysSection.tsx
  modified:
    - src/app/(dashboard)/settings/YnabConnectionSection.tsx
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "ApiKeysSection duplicates YNAB PAT field intentionally — CONFIG-01 requires all keys visible in one place; sections sync via DB on page refresh"
  - "settings/page.tsx reads budgetId server-side from getSetting — avoids client-side waterfall for initial connected state"
  - "YnabConnectionSection only fetches budgets on mount if status.connected=true; otherwise waits for user to enter PAT to avoid redundant 400 errors"

requirements-completed: [YNAB-06, YNAB-07, YNAB-09, CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, DASH-06]

# Metrics
duration: 4min
completed: 2026-04-10
---

# Phase 22 Plan 03: Settings UI — YNAB Connection + API Keys Summary

**Settings UI complete: YnabConnectionSection replaced (PAT + live budget/account dropdowns), ApiKeysSection created (4 runtime secret fields), page wired with real connected state from DB**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T21:33:37Z
- **Completed:** 2026-04-10T21:37:57Z
- **Tasks:** 2
- **Files modified:** 3 (1 created)

## Accomplishments

- YnabConnectionSection: replaced return-null stub with full 'use client' component — PAT input with Save Token button, live budget dropdown (populates after PAT save), live account dropdown (populates after budget selection), Save Budget & Account persists to DB, onConnectionChange callback
- ApiKeysSection: new component with 4 editable fields (YNAB PAT, Claude key, Resend key, Pipedream URL) — loads current values from GET /api/settings on mount, saves non-empty fields via PUT /api/settings
- settings/page.tsx: reads YNAB_BUDGET_ID server-side via getSetting, derives connected=!!budgetId, passes real values to SenderRulesSection and CurrencyRulesSection — no more hardcoded connected={false}
- All loading states follow CLAUDE.md perceived-performance rules: loading text while /api/ynab/status loads, buttons disabled + spinner during async ops, optimistic success messages after save

## Task Commits

1. **Task 1: YnabConnectionSection with PAT and dropdowns** - `89d49cc` (feat)
2. **Task 2: ApiKeysSection and settings page wiring** - `67384b0` (feat)

## Files Created/Modified

- `src/app/(dashboard)/settings/YnabConnectionSection.tsx` - Full client component: PAT input, budget/account dropdowns, save flows, connection callback
- `src/app/(dashboard)/settings/ApiKeysSection.tsx` - New: 4 API key fields with load/save via /api/settings
- `src/app/(dashboard)/settings/page.tsx` - Reads budgetId from DB, derives connected, imports + renders ApiKeysSection and YnabConnectionSection, section order matches spec

## Decisions Made

- ApiKeysSection intentionally duplicates the YNAB PAT field — CONFIG-01 requires all keys visible in one place; both sections write the same YNAB_ACCESS_TOKEN key to DB, syncing on page refresh
- settings/page.tsx reads budgetId on the server via getSetting — avoids client-side waterfall for initial SenderRulesSection/CurrencyRulesSection connected state
- YnabConnectionSection only calls /api/ynab/budgets on mount when status.connected is true — prevents redundant 400 errors when no PAT is configured

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing v5.0 test file TypeScript errors (10 failing tests from v5.0 era, confirmed in STATE.md as out-of-scope, tracked for Phase 24 cleanup). Zero src/ app errors.
- npm run build SIGABRT is pre-existing environment issue (confirmed in 22-01 and 22-02 summaries). TypeScript compilation clean. Railway CI is authoritative build check.

## Self-Check: PASSED

- `src/app/(dashboard)/settings/YnabConnectionSection.tsx` — exists, 280+ lines, no `return null`
- `src/app/(dashboard)/settings/ApiKeysSection.tsx` — exists, 200+ lines, 4 fields
- `src/app/(dashboard)/settings/page.tsx` — exists, no `connected={false}`, imports both new sections
- Commits `89d49cc` and `67384b0` verified in git log

---
*Phase: 22-ynab-pat-settings-api-keys*
*Completed: 2026-04-10*
