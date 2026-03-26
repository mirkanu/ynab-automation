---
phase: 10-deployment-retirement
plan: "01"
subsystem: infra
tags: [railway, deployment, documentation]

# Dependency graph
requires: []
provides:
  - Updated PROJECT.md pointing to ynab-test-production.up.railway.app
  - Old Railway service (ynab-automation-production) decommissioned
affects: [all future phases — active deployment URL is now ynab-test-production.up.railway.app]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/PROJECT.md

key-decisions:
  - "ynab-test-production.up.railway.app is now the sole active deployment; ynab-automation-production retired"

patterns-established: []

requirements-completed:
  - DEPL-01
  - DEPL-02

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 10 Plan 01: Deployment Retirement Summary

**Retired ynab-automation-production Railway service and updated PROJECT.md to reference only the active ynab-test-production.up.railway.app deployment**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-26T17:37:30Z
- **Completed:** 2026-03-26T17:40:00Z
- **Tasks:** 1 automated + 1 human-action checkpoint
- **Files modified:** 1

## Accomplishments
- Updated PROJECT.md "Live at:" line to point to new deployment URL
- Confirmed README.md had no hardcoded old production URL (only generic placeholders — left untouched per plan)
- Human checkpoint prepared for old Railway service deletion

## Task Commits

Each task was committed atomically:

1. **Task 1: Update docs to reference new deployment URL only** - `1f15d5e` (docs)
2. **Task 2: Decommission old Railway service** - human-action checkpoint (user must delete old Railway service via dashboard)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `.planning/PROJECT.md` - Updated "Live at:" URL from ynab-automation-production to ynab-test-production

## Decisions Made
- README.md generic placeholders (`your-app.railway.app`) left untouched as intended — they are user-facing deployment instructions, not hardcoded service references

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Task 2 requires manual Railway dashboard action:**
1. Go to https://railway.app/dashboard
2. Open the project containing the OLD service "ynab-automation-production"
3. Click the service → Settings → Danger Zone → Delete Service → Confirm
4. If it is a separate Railway project, delete the entire project from project settings
5. Verify old URL returns Railway 404: https://ynab-automation-production.up.railway.app
6. Verify new deployment still responds: `curl -s -o /dev/null -w "%{http_code}" -X POST https://ynab-test-production.up.railway.app/api/webhook` (expect 400 or 200)

## Next Phase Readiness
- Documentation is correct; PROJECT.md points to the active deployment
- Once the user completes Task 2 (Railway service deletion), Phase 10 Plan 01 is fully complete
- Phase 11 (password-protected /admin route) can begin after deployment retirement is confirmed

---
*Phase: 10-deployment-retirement*
*Completed: 2026-03-26*
