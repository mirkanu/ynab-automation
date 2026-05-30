---
phase: 32-dashboard-redesign
plan: "01"
subsystem: backend-data-layer
tags: [dashboard, tool-runs, settings, api, tdd]
dependency_graph:
  requires: []
  provides:
    - DashboardStats.lastEmailReceivedAt
    - getLastToolRuns()
    - GET /api/dashboard/currency-status
    - LAST_RUN_TRANSFER_FIX Setting write
    - LAST_RUN_RECONCILIATION Setting write
  affects:
    - src/lib/activity-log-queries.ts
    - src/lib/tool-run-queries.ts
    - src/app/api/tools/fix-eur-transfers/route.ts
    - src/app/api/tools/reconcile-eur-wise/route.ts
    - src/app/api/dashboard/currency-status/route.ts
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN) for new query modules
    - Promise.all parallel queries in getDashboardStats
    - parseToolRun null-safe JSON parse with try/catch
    - getAdminSession() auth guard on new endpoint
key_files:
  created:
    - src/lib/tool-run-queries.ts
    - src/lib/tool-run-queries.test.ts
    - src/app/api/dashboard/currency-status/route.ts
  modified:
    - src/lib/activity-log-queries.ts
    - src/lib/activity-log-queries.test.ts
    - src/app/api/tools/fix-eur-transfers/route.ts
    - src/app/api/tools/reconcile-eur-wise/route.ts
decisions:
  - "adjustmentGbp field from ReconciliationResult used for gapAmount in LAST_RUN_RECONCILIATION (confirmed by reading ynab-eur-reconciliation.ts)"
  - "mockResolvedValueOnce chaining used in activity-log tests to handle two sequential findFirst calls in Promise.all"
  - "npm install --include=dev required in worktree to install vitest (no node_modules present initially)"
metrics:
  duration: "~16 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  files_modified: 7
---

# Phase 32 Plan 01: Backend Data Layer for Dashboard Redesign Summary

**One-liner:** Extended DashboardStats with lastEmailReceivedAt, created getLastToolRuns() query module with Setting-backed persistence, wired LAST_RUN_* writes into tool routes, and exposed authenticated GET /api/dashboard/currency-status endpoint.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| T1 RED | Failing tests for tool-run-queries and activity-log extensions | 1bc6532 | tool-run-queries.test.ts, package.json |
| T1 GREEN | Extend getDashboardStats + create tool-run-queries.ts | 04a1098 | activity-log-queries.ts, tool-run-queries.ts, activity-log-queries.test.ts |
| T2 | Persist tool-run metadata in routes + currency-status API | 5a48765 | fix-eur-transfers/route.ts, reconcile-eur-wise/route.ts, currency-status/route.ts |

## Verification Results

- `vitest run` — 15/15 tests pass (tool-run-queries.test.ts: 5, activity-log-queries.test.ts: 10)
- `tsc --noEmit` — zero errors
- All must_haves truths satisfied:
  - `getDashboardStats()` returns `lastEmailReceivedAt` from most recent ActivityLog (any status)
  - `getLastToolRuns()` returns null for all tools when no Setting keys exist
  - `getLastToolRuns()` returns parsed ToolRunEntry when Setting keys exist
  - `fix-eur-transfers` POST writes LAST_RUN_TRANSFER_FIX (zero-pairs and normal paths)
  - `reconcile-eur-wise` POST writes LAST_RUN_RECONCILIATION with `adjustmentGbp`
  - `GET /api/dashboard/currency-status` returns 401 when not logged in
  - `GET /api/dashboard/currency-status` returns `{ transferFix, eurConversion, reconciliation }` shape when logged in

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest not available in worktree**
- **Found during:** Task 1 TDD RED phase
- **Issue:** Worktree had no node_modules; `npm ci` only installed production deps; vitest was absent
- **Fix:** Ran `npm install --include=dev` to install all devDependencies including vitest
- **Files modified:** package-lock.json (committed with test file in RED commit)
- **Commit:** 1bc6532

## TDD Gate Compliance

- RED gate: `test(32-01)` commit 1bc6532 — failing tests written before implementation
- GREEN gate: `feat(32-01)` commit 04a1098 — implementation makes all tests pass
- REFACTOR: Not needed — code was clean

## Known Stubs

None. All data is wired to real queries and Settings table reads.

## Threat Flags

None. The new GET /api/dashboard/currency-status endpoint was already in the plan's threat model as T-32-01 with `getAdminSession()` mitigation implemented as specified.

## Self-Check: PASSED

- [x] `src/lib/tool-run-queries.ts` exists
- [x] `src/lib/activity-log-queries.ts` contains `lastEmailReceivedAt`
- [x] `src/app/api/dashboard/currency-status/route.ts` exists
- [x] Commits 1bc6532, 04a1098, 5a48765 all present in git log
- [x] 15 tests pass, 0 TypeScript errors
