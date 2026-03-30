---
phase: 19-dashboard-onboarding-account-management
plan: 02
subsystem: ui
tags: [nextjs, prisma, vitest, test-mode, parse-transparency, activity-log]

requires:
  - phase: 19-01
    provides: Wave 0 test stubs for DASH-01..05, onboarding schema fields added

provides:
  - POST /api/settings/test-mode — toggles User.testMode per-user, returns new state
  - Dashboard layout reads testMode from User DB row (not env var), with client-side toggle banner
  - Dashboard page shows User.forwardingEmail from DB (not INBOUND_EMAIL env); removes SetupWizard/webhookUrl
  - LogRow collapsible "Claude's Reasoning" section using formatParseResult helper
  - src/lib/parse-result.ts — formatParseResult strips debug fields (stop_reason, token counts)
  - 16 passing tests replacing Wave 0 todos (DASH-01, DASH-02, DASH-04, DASH-05)

affects:
  - Phase 19-03 onboarding flow (page.tsx onboarding redirect already in place)
  - Any future settings UI (test mode toggle now API-backed)

tech-stack:
  added: []
  patterns:
    - "Per-user feature flag via DB boolean + POST API route (not env var)"
    - "Client component wrapping a server-read boolean for interactive toggle (TestModeBanner)"
    - "Pure helper function (formatParseResult) for field-filtering sensitive/debug data before UI display"
    - "TDD: failing tests first for new route, then implement to green"

key-files:
  created:
    - src/app/api/settings/test-mode/route.ts
    - src/app/(dashboard)/components/TestModeBanner.tsx
    - src/lib/parse-result.ts
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/page.tsx
    - src/app/(dashboard)/components/LogRow.tsx
    - tests/dashboard/test-mode.test.ts
    - tests/dashboard/parse-transparency.test.ts
    - tests/dashboard/activity-log.test.ts
    - tests/dashboard/stats.test.ts

key-decisions:
  - "TestModeBanner extracted to client component so server layout can pass DB-read testMode as prop while keeping interactive toggle"
  - "formatParseResult whitelist approach (explicit fields) rather than blacklist — safer against future debug field additions"
  - "page.tsx: removed webhookUrl section (Pipedream was v4.0 single-user pattern, no longer relevant)"
  - "page.tsx: combined user DB query (onboardingCompleted + forwardingEmail) to single prisma.user.findUnique call"

patterns-established:
  - "Parse transparency: formatParseResult in src/lib/parse-result.ts is the single source of truth for what Claude parse fields are safe to display"

requirements-completed: [DASH-01, DASH-02, DASH-04, DASH-05]

duration: 9min
completed: 2026-03-30
---

# Phase 19 Plan 02: Dashboard & Parse Transparency Summary

**Per-user test mode toggled via DB (not env var), forwarding email from DB, and collapsible Claude parse reasoning in LogRow — 16 tests converted from todos to passing**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-30T15:42:34Z
- **Completed:** 2026-03-30T15:51:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- POST /api/settings/test-mode route with per-user isolation, auth guard, and 4 passing unit tests
- Dashboard layout reads testMode from User.testMode (DB) not process.env.TEST_MODE; client toggle banner via TestModeBanner component
- Dashboard page shows User.forwardingEmail from DB; removed legacy SetupWizard check and webhookUrl section
- LogRow shows collapsible "Why? (Claude's reasoning)" section — uses formatParseResult which whitelists safe fields and strips stop_reason/token counts
- All 16 dashboard tests passing (0 todos remaining)

## Task Commits

1. **Task 1: Per-user test mode API route + tests** - `26abe04` (feat)
2. **Task 2: Per-user testMode in layout, forwardingEmail on dashboard, parse transparency in LogRow** - `5b1210e` (feat)

## Files Created/Modified

- `src/app/api/settings/test-mode/route.ts` — POST endpoint: auth check, prisma.user.update testMode, return new state
- `src/app/(dashboard)/components/TestModeBanner.tsx` — Client component: renders test mode banner with Turn off toggle button
- `src/lib/parse-result.ts` — formatParseResult: whitelist approach returning only retailer/amount/date/currency/description
- `src/app/(dashboard)/layout.tsx` — Reads User.testMode from DB; uses TestModeBanner client component
- `src/app/(dashboard)/page.tsx` — Uses User.forwardingEmail from DB; removed SetupWizard/webhookUrl/loadDbSettings
- `src/app/(dashboard)/components/LogRow.tsx` — Added showReasoning state, Why? button, Claude's Reasoning collapsible section
- `tests/dashboard/test-mode.test.ts` — 4 tests: toggle on/off, isolation, 401 for unauth
- `tests/dashboard/parse-transparency.test.ts` — 4 tests: field extraction, null input, no debug fields, missing fields
- `tests/dashboard/activity-log.test.ts` — 4 tests: userId filter, status filter, date range, empty result
- `tests/dashboard/stats.test.ts` — 4 tests: per-user scoping, week window, zero rate, null lastTransaction

## Decisions Made

- TestModeBanner extracted to client component so server layout can pass DB-read boolean as prop while keeping the interactive toggle button (useRouter refresh pattern)
- formatParseResult uses whitelist approach (only named fields) rather than blacklist — safer against future debug field additions
- Combined onboardingCompleted + forwardingEmail into single prisma.user.findUnique call in page.tsx
- Removed webhookUrl section from dashboard (Pipedream was v4.0 single-user pattern, no longer relevant in multi-tenant)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 19-03 (onboarding flow) can proceed: page.tsx onboarding redirect already wired, User schema has all needed fields
- All DASH requirements completed; test suite clean with 16 passing tests

---
*Phase: 19-dashboard-onboarding-account-management*
*Completed: 2026-03-30*
