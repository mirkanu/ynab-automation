---
phase: 19-dashboard-onboarding-account-management
plan: "04"
subsystem: ui
tags: [nextjs, prisma, auth, gdpr, account-deletion, homepage]

requires:
  - phase: 19-03
    provides: onboarding flow complete, testMode and forwardingEmail fields on User
  - phase: 19-02
    provides: per-user test mode toggle API, forwarding email on dashboard

provides:
  - DELETE /api/account/delete endpoint with cascade via prisma.user.delete
  - Public homepage at / with product explanation and Sign up free CTA
  - Dashboard moved to /dashboard route (clean separation from public /)
  - Settings page simplified to per-user controls (test mode toggle + forwarding email)
  - DangerZone component with confirmation step for account deletion
  - Middleware excludes / from auth protection

affects:
  - any phase referencing dashboard URL (now /dashboard not /)
  - auth signin redirectTo (now /dashboard)
  - onboarding completion redirects (now /dashboard)

tech-stack:
  added: []
  patterns:
    - "TDD (RED/GREEN) for API route test coverage"
    - "DangerZone pattern: red-bordered card with confirmation step before destructive action"
    - "Public homepage with authenticated redirect — auth() check at top, redirect('/dashboard') if session"

key-files:
  created:
    - src/app/api/account/delete/route.ts
    - src/app/page.tsx
    - src/app/(dashboard)/settings/DangerZone.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - tests/account/deletion.test.ts
  modified:
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/settings/SettingsForm.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/auth/signin/page.tsx
    - src/app/onboarding/page.tsx
    - src/app/onboarding/OnboardingSteps.tsx
    - src/middleware.ts

key-decisions:
  - "Dashboard URL moved from / to /dashboard — clean separation from public homepage; (dashboard) route group adds /dashboard/ prefix"
  - "Account deletion uses single prisma.user.delete() — relies on onDelete: Cascade DB constraint, not explicit child row deletion"
  - "signOut() called after prisma.user.delete() — session invalidated after data removal"
  - "DangerZone extracted as client component separate from SettingsForm — isolation of destructive action UI"
  - "SettingsForm stripped of v4.0 admin-only tooling (SENDERS, CURRENCY_ACCOUNTS, API keys, Railway sync) — replaced with per-user controls only"
  - "Middleware matcher uses (?!$|...) to exclude root / — $ matches empty string after leading slash"
  - "Stale .next/types cache file removed after old (dashboard)/page.tsx deletion to clear TypeScript error"

patterns-established:
  - "Route migration pattern: copy page to new path, fix relative imports, delete old file, update all nav/redirect references"
  - "TDD pattern: write failing tests, create route, verify GREEN — 5 tests covering 401, user.delete call, and conceptual cascade verification"

requirements-completed: [ONBD-03, ONBD-04, DASH-03]

duration: 14min
completed: 2026-03-28
---

# Phase 19 Plan 04: Account Deletion, Public Homepage, Settings Cleanup Summary

**GDPR account deletion with cascade, public marketing homepage at /, dashboard moved to /dashboard, and settings simplified to per-user controls**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-03-28T16:55:49Z
- **Completed:** 2026-03-28T17:09:00Z
- **Tasks:** 2 (1 TDD, 1 multi-file)
- **Files modified:** 12

## Accomplishments

- DELETE /api/account/delete endpoint with 401 guard, prisma.user.delete cascade — 5 passing TDD tests
- Public homepage at / with product description and Sign up free CTA; authenticated users redirect to /dashboard
- Dashboard route moved from / to /dashboard — clean public/authenticated separation
- Settings page rebuilt as per-user controls (test mode optimistic toggle, forwarding email read-only display, account deletion Danger Zone)

## Task Commits

1. **Task 1: Account deletion API endpoint + tests** - `256b20b` (feat, TDD)
2. **Task 2: Settings page, public homepage, middleware** - `b2c5486` (feat)

## Files Created/Modified

- `src/app/api/account/delete/route.ts` - DELETE endpoint returning 401/200, cascades via prisma.user.delete
- `tests/account/deletion.test.ts` - 5 passing tests: 401 for unauth, user.delete call, cascade verification for ActivityLog/Setting/EmailForwardingAddress
- `src/app/page.tsx` - Public homepage with hero, how-it-works steps, Sign up free CTA
- `src/app/(dashboard)/dashboard/page.tsx` - Dashboard moved here (was /(dashboard)/page.tsx, now at /dashboard URL)
- `src/app/(dashboard)/settings/DangerZone.tsx` - Red-bordered card with confirmation step before DELETE /api/account/delete
- `src/app/(dashboard)/settings/SettingsForm.tsx` - Simplified to test mode toggle (optimistic) + forwarding email display
- `src/app/(dashboard)/settings/page.tsx` - Queries testMode + forwardingEmail from DB; passes to SettingsForm; renders DangerZone
- `src/middleware.ts` - Excludes / from auth matcher so public homepage is accessible
- `src/app/(dashboard)/layout.tsx` - Nav Dashboard link updated from / to /dashboard
- `src/app/auth/signin/page.tsx` - redirectTo updated from / to /dashboard
- `src/app/onboarding/page.tsx` - redirect after completed updated to /dashboard
- `src/app/onboarding/OnboardingSteps.tsx` - router.push updated to /dashboard

## Decisions Made

- Dashboard moved to /dashboard (not kept at /) — required to give `src/app/page.tsx` control of the root route; Next.js App Router gives root `page.tsx` precedence over `(group)/page.tsx` at the same path
- Account deletion uses single `prisma.user.delete()` — all child tables have `onDelete: Cascade` in schema, so no explicit per-table deletes needed
- DangerZone extracted as its own client component — keeps destructive action UI isolated, avoids entangling with SettingsForm's test mode state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated onboarding redirect references to /dashboard**
- **Found during:** Task 2 (route restructuring)
- **Issue:** `onboarding/page.tsx` and `OnboardingSteps.tsx` still redirected to `/` which would now show the public homepage instead of dashboard
- **Fix:** Updated redirect('/') and router.push('/') to /dashboard in both files
- **Files modified:** src/app/onboarding/page.tsx, src/app/onboarding/OnboardingSteps.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** b2c5486 (Task 2 commit)

**2. [Rule 3 - Blocking] Removed stale .next/types cache for deleted dashboard page**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `.next/types/app/(dashboard)/page.ts` still referenced the deleted `/(dashboard)/page.tsx`, causing TS2307 errors
- **Fix:** Removed the stale cached type file
- **Files modified:** .next/types/app/(dashboard)/page.ts (deleted)
- **Verification:** `npx tsc --noEmit` exits clean
- **Committed in:** b2c5486 (Task 2 commit, deletion not staged — .next/ is gitignored)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both necessary for functional routing after dashboard URL change. No scope creep.

## Issues Encountered

None — plan executed as specified with minor blocking fixes for route consistency.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 19 complete — all 4 plans done (ONBD-01 through ONBD-04, DASH-01 through DASH-03)
- v5.0 Multi-Tenant SaaS milestone complete
- Ready for production deployment and testing with real users

---
*Phase: 19-dashboard-onboarding-account-management*
*Completed: 2026-03-28*

## Self-Check: PASSED

- src/app/api/account/delete/route.ts — FOUND
- src/app/page.tsx — FOUND
- src/app/(dashboard)/settings/DangerZone.tsx — FOUND
- src/app/(dashboard)/dashboard/page.tsx — FOUND
- Commit 256b20b — FOUND
- Commit b2c5486 — FOUND
