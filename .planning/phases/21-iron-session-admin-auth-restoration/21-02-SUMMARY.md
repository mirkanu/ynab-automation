---
phase: 21-iron-session-admin-auth-restoration
plan: 02
subsystem: auth
tags: [iron-session, next-auth, middleware, edge-runtime]

requires:
  - phase: 20-schema-rollback-migration
    provides: schema without Auth.js tables; Prisma client without Auth.js models

provides:
  - Iron-session cookie-based middleware gating all protected routes
  - Auth.js code surface entirely removed from disk (auth.ts, next-auth.d.ts, /auth pages, /onboarding pages, [...nextauth] route, /api/onboarding route)

affects:
  - 21-03 (login page must exist at /login — middleware redirects there)
  - 21-04 (dashboard layout reads admin_session via getAdminSession)

tech-stack:
  added: []
  patterns:
    - "Edge-safe middleware: check cookie existence only, defer session validation to server components with Node.js runtime"
    - "Middleware matcher excludes login/logout/setup/api/_next/favicon to prevent redirect loops"

key-files:
  created: []
  modified:
    - src/middleware.ts

key-decisions:
  - "Middleware only checks cookie existence (admin_session present/absent) — cannot decrypt iron-session in Edge Runtime; real validation deferred to server components"
  - "Redirect target changed from /auth/signin to /login — matches iron-session auth flow"
  - "Matcher updated to exclude login, logout, setup, api, _next/static, _next/image, favicon.ico"

patterns-established:
  - "Iron-session middleware pattern: cookie presence check in Edge, full session validation in server component"

requirements-completed: [AUTH-06, AUTH-07, DASH-07, CLEAN-02]

duration: 8min
completed: 2026-04-10
---

# Phase 21 Plan 02: Auth.js Removal and Iron-Session Middleware Summary

**Middleware switched from Auth.js cookie check to iron-session admin_session presence check; entire Auth.js code surface deleted (auth.ts, next-auth types, /auth/* pages, /onboarding pages, [...nextauth] route, /api/onboarding)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-10T20:05:00Z
- **Completed:** 2026-04-10T20:13:00Z
- **Tasks:** 2
- **Files modified:** 1 modified, 13 deleted

## Accomplishments
- Replaced Auth.js session-token cookie check with iron-session `admin_session` cookie presence check in Edge-runtime-safe middleware
- Updated redirect target from `/auth/signin` to `/login` and matcher to exclude login/logout/setup/api routes
- Deleted all Auth.js dead code: src/lib/auth.ts, src/types/next-auth.d.ts, src/app/auth/ (signin/error/verify-request), src/app/onboarding/, src/app/api/auth/[...nextauth]/, src/app/api/onboarding/

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace middleware with iron-session cookie check** - `c68e934` (feat)
2. **Task 2: Delete Auth.js files and dead UI pages** - included in `17bf0db` (parallel plan 21-01 committed these deletions via git add -A)

## Files Created/Modified
- `src/middleware.ts` - Replaced Auth.js cookie check with iron-session admin_session presence check; redirect to /login; updated matcher

## Files Deleted
- `src/lib/auth.ts` - Auth.js configuration (deleted)
- `src/types/next-auth.d.ts` - Auth.js type augmentation (deleted)
- `src/app/auth/signin/page.tsx` - Auth.js signin page (deleted)
- `src/app/auth/signin/loading.tsx` - (deleted)
- `src/app/auth/error/page.tsx` - Auth.js error page (deleted)
- `src/app/auth/error/loading.tsx` - (deleted)
- `src/app/auth/verify-request/page.tsx` - Auth.js magic-link page (deleted)
- `src/app/auth/verify-request/loading.tsx` - (deleted)
- `src/app/onboarding/page.tsx` - Multi-tenant onboarding wizard (deleted)
- `src/app/onboarding/loading.tsx` - (deleted)
- `src/app/onboarding/OnboardingSteps.tsx` - (deleted)
- `src/app/api/auth/[...nextauth]/route.ts` - Auth.js catch-all route (deleted)
- `src/app/api/onboarding/complete/route.ts` - Onboarding completion API (deleted)

## Decisions Made
- Middleware only checks cookie existence (not decrypted session content) because Edge Runtime cannot run Node.js crypto — the iron-session sealed cookie is opaque at the edge; actual isLoggedIn validation deferred to server components using getAdminSession()
- Redirect target changed from /auth/signin to /login to match the new iron-session login flow (Plan 21-03)
- Matcher explicitly excludes setup path for the Phase 23 first-install wizard (public route)

## Deviations from Plan

None - plan executed exactly as written.

Note: Task 2 deletions were committed within the parallel Plan 21-01 commit (17bf0db) due to that plan's use of `git add -A`. The working tree is clean and all deletions are persisted to git history.

## Issues Encountered
- Git commit for Task 2 deletions landed in Plan 21-01's commit (17bf0db) because that parallel agent staged all changed files before Task 2 could commit. No files were lost — all deletions are on disk and in git.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Middleware is ready: iron-session admin_session check active, redirects to /login
- Auth.js dead code entirely removed from disk
- Plan 21-03 can now create the /login page at src/app/login/
- Plan 21-04 can wire dashboard layout to getAdminSession() without Auth.js interference
- Remaining next-auth imports in dashboard layout, settings, logs, and API routes are fixed in Plan 21-03

---
*Phase: 21-iron-session-admin-auth-restoration*
*Completed: 2026-04-10*
