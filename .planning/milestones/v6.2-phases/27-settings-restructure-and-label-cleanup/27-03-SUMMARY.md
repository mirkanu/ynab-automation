---
phase: 27-settings-restructure-and-label-cleanup
plan: 03
subsystem: ui
tags: [next.js, server-components, settings, tools]

requires:
  - phase: 27-02
    provides: Settings page restructured with ApiKeysSection, YnabConnectionSection, AdminPasswordSection; SettingsForm still rendered there

provides:
  - SettingsForm (Test Mode toggle) rendered in tools/page.tsx above TestParseForm
  - settings/page.tsx contains only credential/connection sections (no test mode toggle)
  - tools/page.tsx is now an async server component reading testMode from DB

affects: [28-forwarding-address-prominence]

tech-stack:
  added: []
  patterns:
    - "Tools page reads DB setting (getSetting) as async server component — same pattern as settings/page.tsx"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/tools/page.tsx
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "SettingsForm import path in tools/page.tsx is '../settings/SettingsForm' — component stays co-located with its server actions under settings/"

patterns-established:
  - "Operational toggles (Test Mode) live on Tools page; credential/connection settings live on Settings page"

requirements-completed:
  - NAV-02

duration: 2min
completed: 2026-04-16
---

# Phase 27 Plan 03: Move Test Mode Toggle to Tools Page Summary

**Test Mode toggle (SettingsForm) relocated from Settings page to Tools page — credentials-only Settings, operational-tools-only Tools**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-16T15:47:24Z
- **Completed:** 2026-04-16T15:49:21Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- tools/page.tsx converted to async server component; reads testMode from DB via getSetting; renders SettingsForm above TestParseForm
- settings/page.tsx stripped of SettingsForm import, testMode reads, and related JSX; getSetting import removed entirely
- Page subtitle on Tools updated to "Toggle test mode and test email parsing or replay transactions."

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Test Mode toggle to Tools page and remove it from Settings page** - `316306d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/(dashboard)/tools/page.tsx` - Async server component; imports getSetting + SettingsForm; renders toggle then parse form
- `src/app/(dashboard)/settings/page.tsx` - Removed SettingsForm, testMode reads, getSetting import; shows only ApiKeysSection + YnabConnectionSection + AdminPasswordSection

## Decisions Made
- SettingsForm import path is `../settings/SettingsForm` — component stays co-located with its server actions, only the rendering location moves (consistent with plan 02 approach for rules page)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 27 complete: all three plans (01 label cleanup, 02 rules split, 03 test mode move) executed
- Settings page: API Keys, YNAB Connection, Admin Password only
- Tools page: Test Mode toggle + email parse/replay tools
- Ready for Phase 28: Forwarding Address Prominence

---
*Phase: 27-settings-restructure-and-label-cleanup*
*Completed: 2026-04-16*
