---
phase: 17-ynab-oauth-token-management
plan: "05"
subsystem: ynab-oauth
tags: [ynab, budget-selection, settings-ui, api-routes, tdd]
dependency_graph:
  requires: [17-04]
  provides: [YNAB-05]
  affects: [src/app/(dashboard)/settings/page.tsx, src/app/api/ynab/budgets, src/app/api/ynab/selection]
tech_stack:
  added: []
  patterns: [tdd-red-green, server-component-passes-props-to-client, optimistic-ui]
key_files:
  created:
    - src/app/api/ynab/budgets/route.ts
    - src/app/api/ynab/budgets/[budgetId]/accounts/route.ts
    - src/app/api/ynab/selection/route.ts
    - src/app/(dashboard)/settings/YnabConnectionSection.tsx
  modified:
    - tests/ynab/budget-selection.test.ts (stubs replaced with real tests)
    - src/app/(dashboard)/settings/page.tsx (auth guard + YNAB section added)
    - src/app/(dashboard)/settings/loading.tsx (YNAB section skeleton added)
key_decisions:
  - Server component (page.tsx) reads oauthToken/selectedBudgetId/selectedAccountId from DB and passes as props to YnabConnectionSection client component — avoids client-side auth status fetch
  - YnabConnectionSection fetches budgets/accounts client-side after mount — not blocking server render
  - accounts/route.ts uses async params pattern (Next.js 15 dynamic params are Promises)
metrics:
  duration: 7 minutes
  completed: 2026-03-28
  tasks: 2
  files: 7
---

# Phase 17 Plan 05: Budget/Account Selection API + Settings UI Summary

**One-liner:** Budget list, account list, and selection persistence API routes plus YNAB connection section on settings page with interactive budget/account dropdowns and disconnect flow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Budget and account selection API routes (TDD) | ef095b3 (RED), 47e5fa5 (GREEN) | tests/ynab/budget-selection.test.ts, budgets/route.ts, budgets/[budgetId]/accounts/route.ts, selection/route.ts |
| 2 | Settings page with YNAB connection UI | 3c36e66 | settings/page.tsx, settings/loading.tsx, YnabConnectionSection.tsx |

## What Was Built

### Task 1: API Routes (TDD)

**GET /api/ynab/budgets**
- Auth check → 401 if no session
- `getValidYnabToken(userId)` → 400 `{ error: 'YNAB account not connected' }` if throws
- Fetches `https://api.youneedabudget.com/v1/budgets` with Bearer token
- Returns `{ budgets: [{ id, name }] }`

**GET /api/ynab/budgets/:budgetId/accounts**
- Auth check → 401, token check → 400
- Fetches `https://api.youneedabudget.com/v1/budgets/{budgetId}/accounts`
- Filters out `deleted` and `closed` accounts
- Returns `{ accounts: [{ id, name }] }`

**PUT /api/ynab/selection**
- Auth check → 401
- Validates `budgetId` and `accountId` in body → 400 if missing
- `prisma.user.update` sets `selectedBudgetId` and `selectedAccountId`
- Returns `{ ok: true }`

### Task 2: Settings Page

`YnabConnectionSection` client component:
- **Disconnected state:** "Connect YNAB" link (href to `/api/ynab/authorize`) with loading spinner on click
- **Connected state:** Connected badge, budget selector (loads on mount), account selector (loads after budget selected), Save Selection button with loading state, Disconnect button
- Auto-loads budgets via `useEffect` when `connected=true`
- Auto-loads accounts via `useEffect` when `selectedBudgetId` changes

`settings/page.tsx`:
- Auth guard: redirects to `/auth/signin` if no session
- Reads `oauthToken`, `selectedBudgetId`, `selectedAccountId` from DB via `prisma.user.findUnique`
- Passes `connected`, `initialBudgetId`, `initialAccountId` as props to `YnabConnectionSection`
- YNAB section appears above existing SettingsForm

`settings/loading.tsx`:
- Added YNAB Connection section skeleton block (title + description + button shimmer) before other sections

## Test Results

- `tests/ynab/budget-selection.test.ts`: 10/10 passing (stubs replaced with real tests)
- TypeScript: clean compile
- Pre-existing failures (webhook, activity-log, migration, multi-tenant-isolation) are out of scope — documented in deferred-items.md

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files exist. All task commits verified:
- ef095b3 — test(17-05): add failing tests for budget/account selection API routes
- 47e5fa5 — feat(17-05): budget list, account list, and selection persistence API routes
- 3c36e66 — feat(17-05): settings page with YNAB connection UI and shimmer skeleton
