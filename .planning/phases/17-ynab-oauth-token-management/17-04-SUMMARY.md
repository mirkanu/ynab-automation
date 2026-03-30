---
phase: 17-ynab-oauth-token-management
plan: "04"
subsystem: ynab-oauth
tags: [oauth, token-refresh, concurrency, disconnect, migration]
dependency_graph:
  requires: [17-03]
  provides: [YNAB-03, YNAB-04]
  affects: [src/lib/ynab.ts, webhook, replay]
tech_stack:
  added: []
  patterns: [tdd-red-green, proactive-token-refresh, concurrency-mutex-via-db-timestamp]
key_files:
  created:
    - src/app/api/ynab/disconnect/route.ts
    - tests/ynab/refresh.test.ts (fully implemented from stubs)
    - tests/ynab/disconnect.test.ts (fully implemented from stubs)
  modified:
    - src/lib/ynab.ts
    - src/lib/ynab.test.ts
    - src/app/api/webhook/route.ts
    - src/app/api/replay/route.ts
    - src/app/(dashboard)/settings/SettingsForm.tsx
    - src/app/(dashboard)/settings/page.tsx
    - src/app/setup/SetupWizard.tsx
key_decisions:
  - getValidYnabToken uses BigInt comparison for oauthExpiresAt (stored as BigInt in DB per Phase 17-01 schema)
  - Concurrent refresh mutex uses DB timestamp (lastRefreshAttemptAt) rather than in-process lock — safe for multi-instance deploys
  - YNAB_PERSONAL_ACCESS_TOKEN removed from all src/ files — settings UI no longer shows the old PAT field
  - POST /api/ynab/disconnect takes no request body — all context from session
metrics:
  duration: 21 minutes
  completed: 2026-03-30
  tasks: 2
  files: 10
---

# Phase 17 Plan 04: getValidYnabToken + Disconnect Route Summary

**One-liner:** Per-user OAuth token retrieval with proactive 5-minute expiry refresh, 30-second concurrency mutex, and YNAB disconnect endpoint clearing all 6 OAuth fields.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | getValidYnabToken with proactive refresh and concurrency mutex | 1a4123f | src/lib/ynab.ts, tests/ynab/refresh.test.ts, webhook/route.ts, replay/route.ts, settings UI |
| 2 | Disconnect route | d2026b1 | src/app/api/ynab/disconnect/route.ts, tests/ynab/disconnect.test.ts |

## What Was Built

### Task 1: getValidYnabToken

`src/lib/ynab.ts` now exports `getValidYnabToken(userId: string): Promise<string>` with:

- **Fresh token path:** if `oauthExpiresAt` is more than 5 minutes in the future, `decryptToken(oauthToken)` and return
- **Concurrent mutex:** if `lastRefreshAttemptAt` is within 30 seconds, re-read from DB (another instance may have already refreshed). If the re-read token is fresh, return it. Otherwise fall through.
- **Refresh path:** POST to `https://app.ynab.com/oauth/token` with `grant_type=refresh_token`, encrypt both new tokens, atomically update `oauthToken`, `oauthRefreshToken`, `oauthExpiresAt`, and `lastRefreshAttemptAt`.
- **No token:** throws `Error('User has not connected YNAB account')`

All exported YNAB API functions migrated to accept `userId` as first parameter:
- `createYnabTransaction(userId, params)`
- `getCategories(userId, budgetId)`
- `getAccountName(userId, budgetId, accountId)`

Callers updated: `webhook/route.ts`, `replay/route.ts`.

### Task 2: Disconnect Route

`POST /api/ynab/disconnect` clears all 6 OAuth fields:
`oauthToken`, `oauthRefreshToken`, `oauthExpiresAt`, `selectedBudgetId`, `selectedAccountId`, `lastRefreshAttemptAt` → all set to `null`.

Returns `{ status: 'disconnected' }` on success, `401` without session.

## Test Results

- `tests/ynab/refresh.test.ts`: 7/7 passing (all stubs implemented)
- `tests/ynab/disconnect.test.ts`: 5/5 passing (all stubs implemented)
- `src/lib/ynab.test.ts`: 18/18 passing (updated for new userId signatures)
- TypeScript: clean compile

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated src/lib/ynab.test.ts to use new userId-based signatures**
- **Found during:** Task 1 GREEN phase
- **Issue:** Old test file used `createYnabTransaction(params)` and `getCategories(budgetId)` without userId, and relied on `YNAB_PERSONAL_ACCESS_TOKEN` env var. After migration, these tests broke.
- **Fix:** Rewrote `src/lib/ynab.test.ts` to mock `prisma` + `crypto` and use `createYnabTransaction('user-123', params)` / `getCategories('user-123', budgetId)` signatures.
- **Files modified:** src/lib/ynab.test.ts
- **Commit:** 1a4123f

**2. [Rule 1 - Cleanup] Removed YNAB_PERSONAL_ACCESS_TOKEN from settings UI and setup wizard**
- **Found during:** Task 1 verification (plan requires grep to return empty)
- **Issue:** `SettingsForm.tsx`, `settings/page.tsx`, `SetupWizard.tsx` referenced `YNAB_PERSONAL_ACCESS_TOKEN` for legacy admin UI token management.
- **Fix:** Removed the token field from settings form interface, UI, buildVariables(), and SetupWizard apply function. The YNAB PAT approach is fully replaced by OAuth.
- **Files modified:** src/app/(dashboard)/settings/SettingsForm.tsx, src/app/(dashboard)/settings/page.tsx, src/app/setup/SetupWizard.tsx
- **Commit:** 1a4123f

### Deferred Issues (Pre-existing, Out of Scope)

Pre-existing test failures in `src/app/api/webhook/route.test.ts` (5 tests): The test mock for `@/lib/db` only provides `processedEmail` operations, not `user.findUnique`. The webhook's `getInitialUserId()` call returns null in tests, causing early exit. These failures existed before Plan 17-04.

Documented in: `.planning/phases/17-ynab-oauth-token-management/deferred-items.md`

## Self-Check: PASSED

All created files exist. All task commits verified:
- 1a4123f — feat(17-04): getValidYnabToken with proactive refresh and concurrency mutex
- d2026b1 — feat(17-04): disconnect route clears all YNAB OAuth fields
