---
phase: 24-test-suite-cleanup-and-self-host-docs
plan: 01
subsystem: testing
tags: [vitest, prisma, settings, process-env, test-cleanup]

# Dependency graph
requires:
  - phase: 23-first-install-wizard-and-route-state-machine
    provides: settings.ts with getSetting/saveSettings that this plan rewrites to DB-only
provides:
  - Clean test suite with 0 failing, 0 skipped (9 files, 117 tests)
  - DB-only settings module: getSetting reads DB only, saveSettings writes DB only
  - Unit tests for settings.ts covering DB hit, miss, error, upsert, count, no-env-write
affects: [any future phase touching settings.ts or test infrastructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getSetting() reads from DB only — no process.env fallback; DB is single source of truth"
    - "saveSettings() writes to DB only — no process.env mutation"
    - "Callers read dynamic settings via getSetting() not process.env after loadDbSettings()"

key-files:
  created:
    - src/lib/settings.test.ts
  modified:
    - src/lib/settings.ts
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/logs/page.tsx
    - src/app/api/webhook/route.ts
    - src/app/api/webhook/route.test.ts
    - src/app/api/replay/route.ts
  deleted:
    - tests/ (entire directory, 20 files)
    - .planning/todos/pending/process-env-stale-state-leak.md (moved to done/)

key-decisions:
  - "loadDbSettings() deleted entirely — all 4 callers updated to use getSetting() directly"
  - "process.env.TEST_MODE and process.env.YNAB_BUDGET_ID replaced with getSetting() calls in webhook and replay routes"
  - "Webhook route.test.ts mock updated: loadDbSettings → getSetting (resolves undefined)"

patterns-established:
  - "Settings pattern: getSetting('KEY') for any runtime setting; process.env.X only for framework/infra secrets (DATABASE_URL, IRON_SESSION_SECRET)"
  - "Test cleanup rule: delete v5.0-era tests wholesale when they target deleted modules; don't rewrite against new schema"

requirements-completed: [CLEAN-04]

# Metrics
duration: 8min
completed: 2026-04-11
---

# Phase 24 Plan 01: Test Suite Cleanup & Settings Fix Summary

**Deleted 20 v5.0-era test files (tests/ directory) and rewrote settings.ts to DB-only, eliminating the process.env stale-state leak that prevented wizard re-runs after DB row deletion**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-11T18:21:37Z
- **Completed:** 2026-04-11T18:29:41Z
- **Tasks:** 2
- **Files modified:** 8 (+ 20 deleted + 1 created)

## Accomplishments
- Deleted entire `tests/` directory (20 files targeting modules deleted in Phases 20-22: Auth.js, YNAB OAuth, multi-tenancy, email routing, onboarding)
- Rewrote `src/lib/settings.ts`: removed `loadDbSettings()` export, removed `process.env` mutation from `saveSettings()`, removed `process.env` fallback from `getSetting()` — DB is now the single source of truth
- Fixed 4 callers that previously relied on `loadDbSettings()` + `process.env.*` pattern: dashboard layout, logs page, webhook route, replay route
- Created `src/lib/settings.test.ts` with 6 unit tests covering all specified behaviors
- Moved resolved todo to `.planning/todos/done/`
- Final: 9 test files, 117 tests, 0 failing, 0 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete all 20 v5.0-era test files and verify npm test is green** - `9afc81c` (chore)
2. **Task 2: Rewrite settings.ts to DB-only and add unit tests** - `0307e01` (fix)

**Plan metadata:** (final commit, see below)

## Files Created/Modified
- `src/lib/settings.ts` - Rewritten: DB-only getSetting/saveSettings, no loadDbSettings, no process.env
- `src/lib/settings.test.ts` - Created: 6 unit tests covering DB hit, DB miss (no env fallback), DB error (no env fallback), upsert, count, no-process.env-write
- `src/app/(dashboard)/layout.tsx` - Removed loadDbSettings import and call; getSetting call retained
- `src/app/(dashboard)/logs/page.tsx` - Replaced loadDbSettings + process.env.TEST_MODE with getSetting('TEST_MODE')
- `src/app/api/webhook/route.ts` - Removed loadDbSettings; replaced process.env.YNAB_BUDGET_ID and process.env.TEST_MODE with getSetting calls
- `src/app/api/webhook/route.test.ts` - Updated settings mock: loadDbSettings → getSetting
- `src/app/api/replay/route.ts` - Removed loadDbSettings; replaced process.env.YNAB_BUDGET_ID and process.env.TEST_MODE with getSetting calls
- `tests/` - Entire directory deleted (20 files, tracked via git rm)
- `.planning/todos/done/process-env-stale-state-leak.md` - Moved from pending/

## Decisions Made
- `loadDbSettings()` deleted entirely (no callers remain after fixing all 4 sites); removing it was simpler than leaving a no-op export
- `process.env.TEST_MODE` and `process.env.YNAB_BUDGET_ID` in route handlers now read via `getSetting()` — consistent with the DB-is-truth model; framework secrets (DATABASE_URL, IRON_SESSION_SECRET) remain as direct `process.env.X` reads since they are not stored in the Setting table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 4 callers of loadDbSettings that would break at compile/runtime**
- **Found during:** Task 2 (settings.ts rewrite)
- **Issue:** Plan said "grep confirms 0 uses in src/" but grep found 4 callers: layout.tsx, logs/page.tsx, webhook/route.ts, replay/route.ts. Those callers also read process.env.TEST_MODE and process.env.YNAB_BUDGET_ID after loadDbSettings(), which would silently serve stale/missing values after the rewrite.
- **Fix:** Removed all loadDbSettings imports/calls; replaced process.env.TEST_MODE and process.env.YNAB_BUDGET_ID reads with getSetting() calls. Updated webhook route.test.ts mock.
- **Files modified:** layout.tsx, logs/page.tsx, webhook/route.ts, webhook/route.test.ts, replay/route.ts
- **Verification:** npm test: 9 files, 117 tests, 0 failing, 0 skipped
- **Committed in:** 0307e01 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Essential fix — without it the settings.ts rewrite would cause TypeScript errors and runtime failures in all 4 route handlers. No scope creep.

## Issues Encountered
None — the plan's claim of "0 callers" was incorrect (grep in plan was limited to loadDbSettings only, not process.env reads that depended on it), but the fix was straightforward and within Task 2 scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test suite is clean: 9 files, 117 tests, 0 failing, 0 skipped
- settings.ts is the single-source-of-truth module for all runtime settings
- Phase 24 Plan 02 (self-host README) can proceed
- No blockers

---
*Phase: 24-test-suite-cleanup-and-self-host-docs*
*Completed: 2026-04-11*
