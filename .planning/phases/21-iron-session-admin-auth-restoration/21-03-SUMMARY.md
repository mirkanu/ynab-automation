---
phase: 21-iron-session-admin-auth-restoration
plan: 03
subsystem: ui-auth
tags: [iron-session, dashboard, settings, api-routes, auth-guard]

# Dependency graph
requires:
  - phase: 21-01
    provides: getSetting/loadDbSettings/getDashboardStats/getActivityLogs (single-tenant, no userId)
  - phase: 21-02
    provides: iron-session middleware (admin_session cookie check, redirect to /login)
provides:
  - Fully wired UI layer — every page and API route uses getAdminSession() not auth()
  - loginAction reads ADMIN_PASSWORD from DB Setting row (AUTH-05: changeable without redeploy)
  - Admin password change UI in settings page
  - DangerZone and /api/account/delete deleted (DASH-07, CLEAN-02)
affects:
  - 21-04 (subsequent plans can rely on auth being fully functional)
  - 22 (YNAB PAT restoration — /api/ynab/* routes still have auth() but those are Phase 22 scope)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getAdminSession() + isLoggedIn check in every server component and API route"
    - "getSetting('ADMIN_PASSWORD') with process.env fallback for bootstrap"
    - "Plain form POST to /logout route handler (no server action needed)"
    - "AdminPasswordSection: client component PUT /api/settings with ADMIN_PASSWORD key"

key-files:
  created:
    - src/app/(dashboard)/settings/AdminPasswordSection.tsx
  modified:
    - src/app/page.tsx
    - src/app/login/actions.ts
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/logs/page.tsx
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/settings/SettingsForm.tsx
    - src/app/(dashboard)/settings/YnabConnectionSection.tsx
    - src/app/api/settings/route.ts
    - src/app/api/settings/test-mode/route.ts
    - src/app/api/settings/sender-rules/route.ts
    - src/app/api/settings/currency-rules/route.ts
    - src/app/api/test-parse/route.ts
  deleted:
    - src/app/(dashboard)/settings/DangerZone.tsx
    - src/app/api/account/delete/route.ts

key-decisions:
  - "loginAction reads ADMIN_PASSWORD from DB via getSetting() with process.env fallback — enables password change without redeploy (AUTH-05)"
  - "Dashboard layout uses plain HTML form POST to /logout — no server action needed since logout route handler already exists"
  - "YnabConnectionSection stubbed to return null — Phase 22 replaces with PAT-based UI; avoids build errors from deleted YNAB OAuth code"
  - "Auth.js imports remaining only in /api/ynab/* routes — explicitly Phase 22 scope, not touched here"
  - "inboundEmail on dashboard sourced from getSetting('INBOUND_EMAIL') instead of User.forwardingEmail — consistent with single-tenant Setting model"
  - "SettingsForm.tsx forwardingEmail prop removed — per-user email deleted with User model"

requirements-completed: [AUTH-04, AUTH-05, AUTH-06, DASH-07]

# Metrics
duration: 9min
completed: 2026-04-10
---

# Phase 21 Plan 03: UI Layer Iron-Session Wiring Summary

**Every auth() call in UI pages and API routes replaced with getAdminSession(); login reads password from DB Setting; admin password changeable via settings page; DangerZone deleted**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-10T19:14:29Z
- **Completed:** 2026-04-10T19:23:52Z
- **Tasks:** 3
- **Files modified:** 13 modified, 1 created, 2 deleted

## Accomplishments
- Replaced every `auth()` / `session.user.id` call in the plan's file scope with `getAdminSession()` + `isLoggedIn` guard
- loginAction now reads `ADMIN_PASSWORD` from DB Setting row via `getSetting()`, falls back to `process.env.ADMIN_PASSWORD` for bootstrap
- dashboard/page.tsx removes prisma.user query and onboarding redirect; sources inbound email from `getSetting('INBOUND_EMAIL')`
- logs/page.tsx passes no userId to `getActivityLogs()`
- All `/api/settings/*` routes return 401 from isLoggedIn check; test-mode writes to Setting row not User.testMode
- Settings page renders: SettingsForm (test mode toggle) + SenderRulesSection + CurrencyRulesSection + AdminPasswordSection
- AdminPasswordSection: validates length/match, calls PUT /api/settings with {ADMIN_PASSWORD: newPw}, spinner on submit
- DangerZone.tsx and /api/account/delete deleted (DASH-07, CLEAN-02)
- YnabConnectionSection stubbed to `return null` (Phase 22 replaces)

## Task Commits

1. **Task 1: Root page, login action, dashboard layout** — `2615b55` (feat)
2. **Task 2: Dashboard/logs pages and protected API routes** — `37a0c1c` (feat)
3. **Task 3: Settings page + AdminPasswordSection + DangerZone deletion** — `1943a30` (feat)

## Files Created/Modified

- `src/app/page.tsx` — simple redirect to /login, no auth() call
- `src/app/login/actions.ts` — getSetting('ADMIN_PASSWORD') with env fallback; redirects to /dashboard on success
- `src/app/(dashboard)/layout.tsx` — getAdminSession() guard; logout via plain form POST to /logout; getSetting('TEST_MODE') for banner
- `src/app/(dashboard)/dashboard/page.tsx` — getAdminSession() guard; getDashboardStats() no userId; getSetting('INBOUND_EMAIL')
- `src/app/(dashboard)/logs/page.tsx` — getAdminSession() guard; getActivityLogs() no userId
- `src/app/(dashboard)/settings/page.tsx` — getAdminSession() guard; renders 4 sections; no prisma.user; no DangerZone
- `src/app/(dashboard)/settings/AdminPasswordSection.tsx` — new client component for password change (AUTH-05)
- `src/app/(dashboard)/settings/SettingsForm.tsx` — forwardingEmail prop removed; test mode toggle only
- `src/app/(dashboard)/settings/YnabConnectionSection.tsx` — stubbed to return null (Phase 22 placeholder)
- `src/app/api/settings/route.ts` — iron-session guard; key-only prisma.setting operations
- `src/app/api/settings/test-mode/route.ts` — iron-session guard; Setting upsert instead of User.testMode
- `src/app/api/settings/sender-rules/route.ts` — iron-session guard; key-only Setting upsert
- `src/app/api/settings/currency-rules/route.ts` — iron-session guard; key-only Setting upsert
- `src/app/api/test-parse/route.ts` — iron-session guard; no userId usage

## Decisions Made

- loginAction reads ADMIN_PASSWORD from DB via getSetting() then falls back to process.env — enables password change without redeploy while preserving bootstrap path for first-install
- Dashboard inbound email sourced from getSetting('INBOUND_EMAIL') — consistent with single-tenant Setting model (Phase 23 wizard will write this key)
- YnabConnectionSection stubbed rather than deleted — Phase 22 will rewrite it; keeps the file as a placeholder to minimize Phase 22 diff

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Status

- **Plan-scoped files:** Zero errors
- **Remaining errors (pre-existing, Phase 22+ scope):**
  - `/api/ynab/*` routes — still import `@/lib/auth` (Phase 22 will replace with PAT)
  - `src/lib/ynab.ts`, `src/lib/email-forwarding.ts`, `src/lib/email-routing.ts` — reference deleted User model (Phase 22)
  - `src/app/api/email/inbound/route.ts` — Phase 18 dead code (Phase 22 deletes)
  - `.next/types/` stale cache — reflects deleted Plan 02 routes; cleared on next build
  - `tests/account/deletion.test.ts`, `tests/auth/signup-magic-link.test.ts` — reference deleted Auth.js (Phase 24 test cleanup)

## Next Phase Readiness

- Full iron-session auth flow is operational: login → admin_session cookie → dashboard → settings → logout
- Admin can change their password via Settings without a redeploy (AUTH-05)
- Zero auth() calls in any plan-scoped file
- Phase 22 can now replace YNAB OAuth with PAT in /api/ynab/* routes

---
*Phase: 21-iron-session-admin-auth-restoration*
*Completed: 2026-04-10*
