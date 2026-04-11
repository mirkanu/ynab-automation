---
phase: 23-first-install-wizard
plan: "03"
subsystem: ui
tags: [wizard, routing, next-js, server-components, iron-session]

# Dependency graph
requires:
  - phase: 23-01
    provides: "deriveWizardStep() + getSetting('WIZARD_COMPLETE') pattern"
  - phase: 23-02
    provides: "setup layout + x-pathname middleware exemption for /setup/done"

provides:
  - "src/app/page.tsx — root route state machine: WIZARD_COMPLETE check → /setup/{step} | /login | /dashboard"
  - "src/app/(dashboard)/layout.tsx — WIZARD_COMPLETE gate before isLoggedIn check → /setup if incomplete"

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root / as pure redirect server component — no UI, only reads state and calls redirect()"
    - "Dashboard layout gates on WIZARD_COMPLETE before isLoggedIn — belt-and-suspenders for direct navigation bypass"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/(dashboard)/layout.tsx

key-decisions:
  - "page.tsx uses getSetting('WIZARD_COMPLETE') not deriveWizardStep() as the gating check — deriveWizardStep() only called when redirect target /setup/{step} is needed"
  - "Dashboard layout checks WIZARD_COMPLETE before session — ensures incomplete installs cannot reach dashboard even with a valid stale cookie"

patterns-established:
  - "Wizard gate pattern: getSetting('WIZARD_COMPLETE') !== 'true' → redirect('/setup') — reused in both root and dashboard layouts"

requirements-completed: [WIZ-05, DASH-08]

# Metrics
duration: 3min
completed: "2026-04-11"
---

# Phase 23 Plan 03: Root Route State Machine & Dashboard Wizard Gate Summary

**Root / dispatches to /setup/{step}, /login, or /dashboard based on WIZARD_COMPLETE + iron-session; dashboard layout blocks incomplete installs before isLoggedIn check**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T01:08:33Z
- **Completed:** 2026-04-11T01:11:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rewrote `src/app/page.tsx` as a three-way dispatch: wizard incomplete → `/setup/{deriveWizardStep()}`, complete + no session → `/login`, complete + session → `/dashboard`
- Added `WIZARD_COMPLETE` gate to `src/app/(dashboard)/layout.tsx` before `isLoggedIn` check — incomplete installs directed to `/setup` even with a stale valid cookie
- Wave 2's `/setup/done` x-pathname exemption in middleware and setup layout fully preserved

## Task Commits

1. **Task 1: Root route state machine** - `5a0c00d` (feat)
2. **Task 2: Dashboard layout wizard gate** - `111ad2d` (feat)

## Files Created/Modified

- `src/app/page.tsx` — Rewrote from stub redirect-to-/login to three-way dispatch: WIZARD_COMPLETE check + deriveWizardStep() + getAdminSession()
- `src/app/(dashboard)/layout.tsx` — Added getSetting('WIZARD_COMPLETE') check with redirect('/setup') before the existing isLoggedIn guard

## Decisions Made

- `page.tsx` calls `deriveWizardStep()` only when `WIZARD_COMPLETE !== 'true'` to avoid unnecessary DB queries on the hot path (installed + authenticated users)
- Dashboard layout redirects to `/setup` (not `/setup/1`) on incomplete install — the setup layout's own page.tsx calls `deriveWizardStep()` to determine the exact step

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both files compiled with zero new TypeScript errors in `src/`. Pre-existing errors in `tests/` remain (v5.0 era, bundled for Phase 24).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 23 now complete: all three routing layers work (setup layout guard, root dispatch, dashboard gate)
- Full wizard flow functional: fresh install → /setup/1 → ... → /setup/done; return visits → correct step; post-install → /login or /dashboard
- Phase 24 (Test Suite Cleanup & Self-Host Docs) is unblocked

---
*Phase: 23-first-install-wizard*
*Completed: 2026-04-11*
