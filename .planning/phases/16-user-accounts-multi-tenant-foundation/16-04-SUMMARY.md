---
phase: 16-user-accounts-multi-tenant-foundation
plan: 04
subsystem: auth
tags: [auth, magic-link, resend, nextauth, middleware, railway, session, multi-tenant]

# Dependency graph
requires:
  - "16-01: Auth.js auth() function, magic link email setup, session wiring"
  - "16-02: userId NOT NULL on ActivityLog, Setting, ProcessedEmail with backfill"
  - "16-03: PostgreSQL RLS + getPrismaForUser + middleware route protection + auth-gated API routes"
provides:
  - "Human-verified end-to-end confirmation that Phase 16 works in production on Railway"
  - "Magic link email delivery confirmed via Resend (AUTH-01)"
  - "Database-backed sessions confirmed to persist across browser close/reopen (AUTH-02)"
  - "Log out via Auth.js signOut() confirmed (AUTH-03)"
  - "Existing data backfill confirmed — 0 NULL userId rows (DATA-02)"
  - "Unauthenticated /api/settings returns 401 confirmed (DATA-04)"
  - "Auth.js middleware replaces old iron-session middleware"
  - "Signin page uses server action instead of client-side fetch"
  - "API routes excluded from middleware to return 401 instead of 307 redirect"
affects:
  - 17-ynab-oauth
  - 18-per-user-email
  - 19-per-user-settings

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth.js middleware: export { auth as middleware } from '@/lib/auth' replaces iron-session middleware"
    - "Server action for magic link signin (not client-side fetch to API route)"
    - "Middleware matcher excludes /api/* so unauthenticated API requests return 401 not 307"

key-files:
  created: []
  modified:
    - "src/middleware.ts — Replaced old iron-session middleware with Auth.js middleware export"
    - "src/app/auth/signin/page.tsx — Switched from client-side fetch to server action for magic link"

key-decisions:
  - "Replaced iron-session middleware (src/middleware.ts) with Auth.js middleware — iron-session was blocking auth routes and causing redirect loops"
  - "API routes excluded from middleware matcher — so unauthenticated API calls return 401 (correct) not 307 redirect (incorrect for API consumers)"
  - "Signin page uses server action instead of client-side fetch — avoids CSRF issues and aligns with Auth.js signIn() calling convention"
  - "Railway env vars required: AUTH_SECRET, AUTH_TRUST_HOST=true, AUTH_URL, EMAIL_FROM — documented and set during verification"

patterns-established:
  - "Middleware matcher should always exclude /api/* routes so API callers receive 401 not redirect"
  - "Auth.js signIn() should be called from a server action, not a client-side fetch to an API route"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, DATA-01, DATA-02, DATA-03, DATA-04]

# Metrics
duration: ~24h
completed: 2026-03-29
---

# Phase 16 Plan 04: Human Verification Checkpoint Summary

**End-to-end Phase 16 verified in production: magic link delivery via Resend, session persistence, logout, tenant isolation, and 401 on unauthenticated API — plus three production fixes discovered during verification**

## Performance

- **Duration:** ~24h (human verification window)
- **Started:** 2026-03-28T (checkpoint issued after Plan 03 completion)
- **Completed:** 2026-03-29T22:49:01Z
- **Tasks:** 1 (checkpoint:human-verify)
- **Files modified:** 2 (fixes applied during verification)

## Accomplishments
- Human-verified all 5 required verification steps passing in Railway production environment
- AUTH-01: Magic link email delivered via Resend and functional
- AUTH-02: Database-backed sessions persist across browser close/reopen
- AUTH-03: Log out redirects to /auth/signin; subsequent visit to / redirects back (not logged in)
- DATA-02: Backfill confirmed — 0 NULL userId rows, all existing activity log entries visible under Manuel's account
- DATA-04: /api/settings returns 401 Unauthorized for unauthenticated requests
- Route protection confirmed: dashboard redirects to /auth/signin when unauthenticated
- Three additional production bugs discovered and fixed during verification (see Deviations)

## Task Commits

Checkpoint task (human-verify) — no automated commits for the checkpoint itself.

Fixes applied during verification:

1. **Fix: server action for magic link signin** — `da76476` (fix)
2. **Fix: replace iron-session middleware with Auth.js** — `ae52167` (fix)
3. **Fix: exclude API routes from middleware** — `7be8929` (fix)

## Files Created/Modified
- `src/middleware.ts` — Replaced old iron-session middleware with `export { auth as middleware } from '@/lib/auth'`; updated matcher to exclude /api/* routes
- `src/app/auth/signin/page.tsx` — Switched from client-side fetch to server action calling Auth.js `signIn()`

## Decisions Made
- Iron-session middleware was still in place from before Phase 16 — it needed to be replaced with Auth.js middleware before authentication could work end-to-end
- Middleware matcher must exclude `/api/*` so unauthenticated API requests receive 401 (machine-readable) instead of 307 redirect (only suitable for browsers)
- Auth.js `signIn()` must be called from a server action — client-side fetch to an API route caused CSRF/session issues
- Railway environment variables `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL`, `EMAIL_FROM` confirmed set and working

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced old iron-session middleware with Auth.js middleware**
- **Found during:** Human verification (AUTH-01 — signin page not working)
- **Issue:** `src/middleware.ts` still contained the old iron-session session-check middleware from before Phase 16. This conflicted with Auth.js, causing redirect loops on the signin page.
- **Fix:** Replaced entire middleware.ts with `export { auth as middleware } from '@/lib/auth'` plus correct matcher config. Also set `AUTH_URL` and `AUTH_TRUST_HOST=true` on Railway.
- **Files modified:** src/middleware.ts
- **Verification:** Signin page loads correctly, magic link flow works end-to-end
- **Committed in:** ae52167

**2. [Rule 1 - Bug] Fixed signin page to use server action instead of client-side fetch**
- **Found during:** Human verification (AUTH-01 — magic link not being sent)
- **Issue:** Signin page was using a client-side `fetch()` call to an API route to trigger `signIn()`, which caused CSRF token mismatch and session issues with Auth.js v5.
- **Fix:** Converted to a server action that calls `signIn('resend', { email, redirectTo: '/' })` directly.
- **Files modified:** src/app/auth/signin/page.tsx
- **Verification:** Magic link email received and functional after fix
- **Committed in:** da76476

**3. [Rule 2 - Missing Critical] Excluded API routes from middleware matcher**
- **Found during:** Human verification (DATA-04 — /api/settings returning 307 not 401)
- **Issue:** Middleware was matching `/api/*` routes and redirecting unauthenticated requests to `/auth/signin` with a 307 redirect. API consumers expect 401 Unauthorized, not a browser redirect.
- **Fix:** Updated middleware matcher to exclude `/api/*` so API routes handle their own auth and return 401 directly.
- **Files modified:** src/middleware.ts
- **Verification:** `/api/settings` returns 401 Unauthorized for unauthenticated requests
- **Committed in:** 7be8929

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical)
**Impact on plan:** All three fixes were necessary for the verified requirements to pass. No scope creep — these were bugs in the Phase 16 implementation discovered only during live browser testing.

## Issues Encountered
- Railway environment variables were not fully set — AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL, and EMAIL_FROM all required explicit configuration on Railway before authentication could work. These were set during the verification window.
- Iron-session middleware left over from pre-Phase-16 code was not caught during automated implementation — only surfaced during live browser testing.
- Multi-tenant isolation tests (tests/data/multi-tenant-isolation.test.ts) require Railway DATABASE_URL — they remain as documented "requires Railway DB" tests (no change from Plan 03).

## Next Phase Readiness
- Phase 16 complete: multi-tenant authentication foundation fully verified in production
- Auth.js magic link authentication working end-to-end on Railway
- Two-layer tenant isolation (app-layer userId filter + PostgreSQL RLS) verified
- All API routes return 401 for unauthenticated requests
- getPrismaForUser pattern established and verified — ready for Phase 17, 18, 19
- Phase 17 (YNAB OAuth): can proceed with confidence that YNAB tokens will be isolated per user

---
*Phase: 16-user-accounts-multi-tenant-foundation*
*Completed: 2026-03-29*
