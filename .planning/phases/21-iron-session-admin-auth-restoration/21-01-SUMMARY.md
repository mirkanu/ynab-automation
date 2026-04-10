---
phase: 21-iron-session-admin-auth-restoration
plan: 01
subsystem: database
tags: [prisma, single-tenant, activity-log, settings, webhook]

# Dependency graph
requires:
  - phase: 20-schema-rollback-migration
    provides: single-tenant 3-model schema (Setting/ProcessedEmail/ActivityLog, no User/userId)
provides:
  - Plain prisma singleton (no RLS, no getPrismaForUser)
  - key-only settings functions (loadDbSettings, saveSettings, getSetting)
  - userId-free activity log write (writeActivityLog)
  - userId-free activity log queries (getDashboardStats, getActivityLogs)
affects:
  - 21-02 (iron-session auth routes depend on getSetting for ADMIN_PASSWORD)
  - 22 (YNAB PAT restoration builds on plain prisma client)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Plain prisma singleton — no $extends, no RLS middleware, no user-scoped sessions
    - Key-only Setting upsert — where: { key } with no userId compound index
    - userId-free ActivityLog write — no user lookup before create

key-files:
  created: []
  modified:
    - src/lib/db.ts
    - src/lib/settings.ts
    - src/lib/activity-log.ts
    - src/lib/activity-log-queries.ts
    - src/lib/activity-log-queries.test.ts
    - src/app/api/webhook/route.ts
    - src/app/api/replay/route.ts
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/logs/page.tsx

key-decisions:
  - "Plain prisma singleton replaces getPrismaForUser — no RLS, no per-query session variable injection"
  - "Setting uses key as sole primary key — upsert/findUnique by key only, no compound userId_key"
  - "ActivityLog written without userId lookup — no getInitialUser shim, create fires immediately"
  - "Test mode read from process.env.TEST_MODE (set via settings) not from User.testMode DB column"
  - "ProcessedEmail deduplication uses messageId as unique key — no userId_messageId compound"

patterns-established:
  - "Single-tenant data layer: all lib files import { prisma } from @/lib/db directly, no user scoping"
  - "getSetting(key) as bridge for ADMIN_PASSWORD — reads from Setting row, falls back to process.env"

requirements-completed: [CLEAN-02, AUTH-04, AUTH-05]

# Metrics
duration: 9min
completed: 2026-04-10
---

# Phase 21 Plan 01: Data Layer Single-Tenant Rewrite Summary

**Plain prisma singleton + key-only settings + userId-free activity log — four data-layer lib files rewritten to compile cleanly against the 3-model single-tenant schema**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-10T18:59:37Z
- **Completed:** 2026-04-10T19:08:57Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Removed getPrismaForUser and all RLS/multi-tenant query interception from db.ts
- Rewrote settings.ts with 3 clean functions (loadDbSettings, saveSettings, getSetting) using key-only upserts
- Rewrote activity-log.ts and activity-log-queries.ts with no userId in any interface, param, or where clause
- Updated webhook and replay routes to remove getInitialUser shim and userId from all DB calls
- Updated test file to mock plain `prisma` (not getPrismaForUser) and call functions without userId

## Task Commits

1. **Task 1: Rewrite db.ts to plain prisma singleton** - `c67ac9d` (feat)
2. **Task 2: Rewrite settings.ts for key-only single-tenant schema** - `17bf0db` (feat)
3. **Task 3: Rewrite activity-log files and callers** - `c2e41da` (feat)

## Files Created/Modified
- `src/lib/db.ts` - Plain prisma singleton; getPrismaForUser removed; ~11 lines
- `src/lib/settings.ts` - loadDbSettings/saveSettings/getSetting; no userId; key-only upsert
- `src/lib/activity-log.ts` - writeActivityLog without userId; no getInitialUserId shim
- `src/lib/activity-log-queries.ts` - getDashboardStats()/getActivityLogs() — no userId params
- `src/lib/activity-log-queries.test.ts` - Mocks updated from getPrismaForUser to prisma
- `src/app/api/webhook/route.ts` - getInitialUser removed; processedEmail by messageId only
- `src/app/api/replay/route.ts` - getPrismaForUser removed; plain prisma; no userId
- `src/app/(dashboard)/dashboard/page.tsx` - getDashboardStats() called with no userId
- `src/app/(dashboard)/logs/page.tsx` - getActivityLogs() called with no userId

## Decisions Made
- Test mode read from `process.env.TEST_MODE` (set via settings) instead of `User.testMode` DB column — User model no longer exists
- ProcessedEmail deduplication uses `{ messageId }` as sole unique key — compound `userId_messageId` removed with schema migration
- Replay route authentication guard removed for now (will be restored with iron-session in Plan 02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated activity-log-queries.test.ts to match new function signatures**
- **Found during:** Task 3 (activity-log-queries rewrite)
- **Issue:** Test file still mocked getPrismaForUser and called getDashboardStats/getActivityLogs with userId args — would fail on test run
- **Fix:** Updated mock to `prisma: mockPrisma`, removed TEST_USER_ID, updated all call sites to no-arg/no-userId form
- **Files modified:** src/lib/activity-log-queries.test.ts
- **Verification:** `grep -rn "getPrismaForUser" src/lib/` returns PASS
- **Committed in:** c2e41da (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Test file update essential for correctness — tests would fail on run otherwise. No scope creep.

## Issues Encountered
- `src/app/api/replay/route.ts` now calls `getAccountName(budgetId, accountId)` and `createYnabTransaction({...})` without userId, but `src/lib/ynab.ts` still expects userId as first arg (TS errors). This is expected at this wave — ynab.ts is rewritten in Plan 22.

## Next Phase Readiness
- 4 data-layer lib files compile cleanly against 3-model single-tenant schema
- getSetting('ADMIN_PASSWORD') is ready for iron-session loginAction to use
- Zero getPrismaForUser references in src/lib/
- Plan 02 can now wire iron-session auth using these clean foundations

---
*Phase: 21-iron-session-admin-auth-restoration*
*Completed: 2026-04-10*
