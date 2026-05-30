---
phase: 27-settings-restructure-and-label-cleanup
plan: "02"
subsystem: ui
tags: [nextjs, routing, navigation, settings]

# Dependency graph
requires:
  - phase: 27-01
    provides: label cleanup in wizard step 3

provides:
  - /rules page hosting SenderRulesSection and CurrencyRulesSection
  - RulesLoading skeleton for perceived performance
  - 5-item nav bar with Rules link between Activity Log and Settings
  - Settings page scoped to credentials only (no routing rule sections)

affects: [27-03, 28]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New dashboard page: mirror settings page.tsx auth+data pattern (getAdminSession + getSetting)"
    - "loading.tsx skeleton: two card-shaped divs matching section count"

key-files:
  created:
    - src/app/(dashboard)/rules/page.tsx
    - src/app/(dashboard)/rules/loading.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "Rules page imports SenderRulesSection and CurrencyRulesSection from ../settings/ — components stay co-located with their server actions, only rendering location changes"
  - "settings/page.tsx removes budgetId/connected reads entirely — not even passed through, since no consumers remain on that page"

patterns-established:
  - "Rules page auth pattern: getAdminSession guard + getSetting for budgetId/connected — same pattern as settings page had"

requirements-completed: [NAV-01]

# Metrics
duration: 3min
completed: 2026-04-16
---

# Phase 27 Plan 02: Rules Page & Nav Restructure Summary

**New /rules page hosts SenderRulesSection and CurrencyRulesSection; nav gains a Rules link; Settings page scoped to credentials only**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-16T15:40:08Z
- **Completed:** 2026-04-16T15:43:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created /rules page with auth guard, YNAB connection read, and both routing rule sections
- Created /rules/loading.tsx skeleton with two card-shaped placeholders (satisfies CLAUDE.md perceived-performance requirement)
- Added Rules nav link between Activity Log and Settings in layout.tsx (nav now has 5 items)
- Removed SenderRulesSection, CurrencyRulesSection, budgetId, and connected from settings/page.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /rules page and loading skeleton** - `442ac36` (feat)
2. **Task 2: Add Rules nav link and clean up Settings page** - `c8451d5` (feat)

**Plan metadata:** (final docs commit, see below)

## Files Created/Modified
- `src/app/(dashboard)/rules/page.tsx` - New Rules page with auth guard and routing rule sections
- `src/app/(dashboard)/rules/loading.tsx` - Skeleton loading state for rules page
- `src/app/(dashboard)/layout.tsx` - Added Rules nav link (5-item nav)
- `src/app/(dashboard)/settings/page.tsx` - Removed routing sections and related data reads

## Decisions Made
- Rules page imports SenderRulesSection and CurrencyRulesSection from `../settings/` — components stay co-located with their server actions; only the rendering location changes
- settings/page.tsx removes `budgetId`/`connected` reads entirely since no consumers remain on that page after the split

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /rules page is live and shows both routing rule sections
- /settings page is scoped to credentials only (API keys, YNAB connection, admin password, test mode toggle)
- Phase 27 plan 03 can now proceed with SettingsForm relocation or further restructuring
- No blockers

---
*Phase: 27-settings-restructure-and-label-cleanup*
*Completed: 2026-04-16*
