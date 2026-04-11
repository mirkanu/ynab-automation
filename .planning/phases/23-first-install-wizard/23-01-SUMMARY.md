---
phase: 23-first-install-wizard
plan: "01"
subsystem: api
tags: [wizard, setup, settings, prisma, next-js]

# Dependency graph
requires:
  - phase: 22-ynab-pat-settings-api-keys
    provides: "getSetting/saveSettings in src/lib/settings.ts"

provides:
  - "src/lib/wizard.ts — WIZARD_STEPS constant + deriveWizardStep() async helper"
  - "POST /api/setup/step — public endpoint to save one step's settings and return nextStep"
  - "CLEAN-03 dead code removal: SetupWizard.tsx, apply/route.ts, account/ directory"

affects:
  - 23-02
  - 23-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "deriveWizardStep() as single source of truth for wizard resume position — reads Setting DB, returns 1–7"
    - "Step API is intentionally public (no auth guard) — wizard precedes admin password creation"
    - "WIZARD_COMPLETE written only on step 6 completion, never by deriveWizardStep()"

key-files:
  created:
    - src/lib/wizard.ts
    - src/app/api/setup/step/route.ts
  modified: []

key-decisions:
  - "deriveWizardStep() is read-only — writing WIZARD_COMPLETE is the responsibility of the step 6 save action only"
  - "Step API route is public (no auth guard) because the wizard runs before ADMIN_PASSWORD is set"
  - "WizardStep interface used instead of as const to allow string | string[] key union without TS narrowing issues"
  - "CLEAN-03: .next/types cache cleared for deleted apply/route.ts to prevent stale TypeScript errors"

patterns-established:
  - "WizardStep type: { step: number, key: string | string[], label: string } — any wizard consumer uses WIZARD_STEPS"
  - "deriveWizardStep(): returns step 1–6 for first incomplete step, 7 for all complete"

requirements-completed: [WIZ-04, CLEAN-03]

# Metrics
duration: 6min
completed: "2026-04-11"
---

# Phase 23 Plan 01: Wizard Foundation & Dead Code Removal Summary

**DB-backed wizard step derivation helper (deriveWizardStep) + public step-save API route + CLEAN-03 deletion of Railway-era v3.0 setup plumbing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-11T00:48:54Z
- **Completed:** 2026-04-11T00:49:21Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 deleted)

## Accomplishments

- Created `src/lib/wizard.ts` — pure helper that reads Setting DB to derive wizard resume position (returns 1–6 for first incomplete step, 7 when all done)
- Created `POST /api/setup/step` — public unauthenticated API route that saves step settings, marks WIZARD_COMPLETE on step 6, returns nextStep
- Deleted 3 v3.0 dead-code artefacts (SetupWizard.tsx Railway API wizard, apply/route.ts Railway GraphQL handler, empty account/ directory); confirmed src/app/onboarding/, DangerZone.tsx, account/delete/ already removed in earlier phases

## Task Commits

1. **Task 1: Create src/lib/wizard.ts** - `6057e6c` (feat)
2. **Task 2: Create POST /api/setup/step** - `c329e5e` (feat)
3. **Task 3: CLEAN-03 dead code deletion** - `d09cd8c` (chore)

## Files Created/Modified

- `src/lib/wizard.ts` — Exports `WIZARD_STEPS` (6-step constant array) and `async deriveWizardStep(): Promise<number>`
- `src/app/api/setup/step/route.ts` — Public POST handler: validates `{step, settings}`, saves to DB, marks WIZARD_COMPLETE on step 6, returns `{success, nextStep}`
- `src/app/setup/SetupWizard.tsx` — DELETED (v3.0 Railway API wizard)
- `src/app/api/setup/apply/route.ts` — DELETED (v3.0 Railway GraphQL apply handler)

## Decisions Made

- Used `WizardStep` interface (not `as const`) to allow `key: string | string[]` without TypeScript union narrowing issues on the `getSetting(stepDef.key)` call
- Step API intentionally has no auth guard — wizard must be reachable before ADMIN_PASSWORD exists; middleware already excludes `/api` from cookie checks
- `deriveWizardStep()` is read-only — writing `WIZARD_COMPLETE` is the step 6 "Finish" action's responsibility, not the helper's

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleared stale .next/types cache for deleted apply/route.ts**
- **Found during:** Task 3 (dead code deletion)
- **Issue:** After deleting `src/app/api/setup/apply/route.ts`, the `.next/types/app/api/setup/apply/route.ts` cache file still referenced the deleted module, producing a new TypeScript error
- **Fix:** Removed `.next/types/app/api/setup/apply/` directory to clear stale cache
- **Files modified:** .next/types/app/api/setup/apply/ (removed)
- **Verification:** `npx tsc --noEmit --skipLibCheck` shows 0 errors in `src/` after fix
- **Committed in:** d09cd8c (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - stale build cache)
**Impact on plan:** Necessary cleanup from file deletion. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `tests/` (98 errors from v5.0 era tests referencing deleted modules: `@/lib/auth`, `getPrismaForUser`, `processedWebhook`, etc.) — these are tracked in STATE.md and bundled for Phase 24 cleanup. Zero new errors in `src/`.

## Next Phase Readiness

- `deriveWizardStep()` and `WIZARD_STEPS` ready for Plan 02 (route layout + step pages)
- `POST /api/setup/step` ready for Plan 02 wizard pages to POST to on "Next" click
- All CLEAN-03 dead code removed; the setup directory now only contains files that will be built in Plans 02/03
- No blockers for Plan 02

---
*Phase: 23-first-install-wizard*
*Completed: 2026-04-11*
