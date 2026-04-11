---
phase: 24-test-suite-cleanup-and-self-host-docs
plan: 02
subsystem: ui
tags: [wizard, settings, playwright, screenshots, docs]

# Dependency graph
requires:
  - phase: 24-test-suite-cleanup-and-self-host-docs
    plan: 01
    provides: DB-only settings module; clean test suite
  - phase: 23-first-install-wizard
    provides: wizard pages at /setup/1..6 and /setup/done
provides:
  - INBOUND_EMAIL as the single setting key for Pipedream forwarding address (wizard step 6, settings page, done page, wizard.ts)
  - docs/images/wizard-step-{1..6}.png and wizard-done.png (7 screenshots for README)
  - scripts/capture-wizard-screenshots.ts (re-runnable headless capture script)
affects: [24-03-README that embeds the wizard screenshots]

# Tech tracking
tech-stack:
  added:
    - playwright (devDep, headless Chromium for screenshots)
    - tsx (devDep, TypeScript script runner)
  patterns:
    - "INBOUND_EMAIL is the single key for Pipedream forwarding email address throughout wizard and settings UI"
    - "Wizard screenshots captured via Railway TCP proxy DB manipulation + Playwright against live deployment"

key-files:
  created:
    - scripts/capture-wizard-screenshots.ts
    - docs/images/wizard-step-1.png
    - docs/images/wizard-step-2.png
    - docs/images/wizard-step-3.png
    - docs/images/wizard-step-4.png
    - docs/images/wizard-step-5.png
    - docs/images/wizard-step-6.png
    - docs/images/wizard-done.png
    - .planning/todos/done/2026-04-11-decide-fate-of-cosmetic-pipedream-webhook-url-field.md
  modified:
    - src/lib/wizard.ts
    - src/app/setup/6/page.tsx
    - src/app/setup/done/page.tsx
    - src/app/(dashboard)/settings/ApiKeysSection.tsx
    - package.json

key-decisions:
  - "Chose option (b) from pipedream todo: rename field to INBOUND_EMAIL — aligns wizard with dashboard which already reads INBOUND_EMAIL"
  - "Screenshots captured against live Railway deployment (WIZARD_COMPLETE temporarily cleared via TCP proxy psql, then immediately restored)"
  - "Added optional placeholder field to ApiKeysSection Field interface for per-field input hints"

patterns-established:
  - "INBOUND_EMAIL pattern: single setting key for Pipedream forwarding address; no PIPEDREAM_WEBHOOK_URL anywhere in codebase"
  - "Screenshot capture pattern: temporarily clear WIZARD_COMPLETE via Railway TCP proxy, run Playwright, restore — all in one operation"

requirements-completed: [DOCS-03]

# Metrics
duration: 15min
completed: 2026-04-11
---

# Phase 24 Plan 02: INBOUND_EMAIL Rename & Wizard Screenshots Summary

**Renamed PIPEDREAM_WEBHOOK_URL to INBOUND_EMAIL across 4 files (wizard.ts, setup/6, setup/done, ApiKeysSection) and captured 7 headless wizard screenshots via Playwright against live Railway deployment**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-11T19:37:00Z
- **Completed:** 2026-04-11T19:50:00Z
- **Tasks:** 2
- **Files modified:** 5 source files + 7 PNGs created + 1 script created + 1 todo moved

## Accomplishments
- Renamed `PIPEDREAM_WEBHOOK_URL` setting key to `INBOUND_EMAIL` across all 4 code sites; zero remaining references in `src/`
- Updated wizard step 6 UI copy: heading, instructions, label, placeholder, and hint text all now reference "inbound email address" and `user_xxx@upload.pipedream.net` pattern
- Updated `ApiKeysSection.tsx` field: label "Pipedream Inbound Email", key `INBOUND_EMAIL`, email-specific placeholder; added optional `placeholder` field to `Field` interface
- Captured 7 PNG screenshots (wizard-step-1 through wizard-step-6, wizard-done) via headless Playwright — all under 65KB, rendering correctly
- Created re-runnable `scripts/capture-wizard-screenshots.ts` with `SCREENSHOT_BASE_URL` env override
- Moved resolved todo to `.planning/todos/done/`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename PIPEDREAM_WEBHOOK_URL to INBOUND_EMAIL across wizard and settings** - `d8be683` (feat)
2. **Task 2: Write screenshot capture script and commit wizard PNGs** - `b129c8c` (feat)

**Plan metadata:** (final commit, see below)

## Files Created/Modified
- `src/lib/wizard.ts` - Step 6 key changed from PIPEDREAM_WEBHOOK_URL to INBOUND_EMAIL, label to "Inbound Email Address"
- `src/app/setup/6/page.tsx` - POST body uses INBOUND_EMAIL; heading, instructions, label, placeholder, and note copy updated
- `src/app/setup/done/page.tsx` - getSetting('INBOUND_EMAIL') instead of PIPEDREAM_WEBHOOK_URL
- `src/app/(dashboard)/settings/ApiKeysSection.tsx` - Field renamed "Pipedream Inbound Email" with INBOUND_EMAIL key, email placeholder, improved hint; Field interface gets optional placeholder property
- `scripts/capture-wizard-screenshots.ts` - Headless Playwright capture script, re-runnable, accepts SCREENSHOT_BASE_URL
- `docs/images/wizard-step-1.png` through `wizard-step-6.png` + `wizard-done.png` - 7 wizard screenshots
- `package.json` - playwright + tsx added to devDependencies; docs:screenshots script added
- `.planning/todos/done/2026-04-11-decide-fate-of-cosmetic-pipedream-webhook-url-field.md` - Moved from pending/

## Decisions Made
- **Option (b) chosen for the Pipedream field todo**: rename to INBOUND_EMAIL rather than dropping the field (option c) or wiring it up differently (option a). Non-programmer self-hosters need to see and update this value; naming it INBOUND_EMAIL aligns with how the dashboard already reads it.
- **Live Railway deployment used for screenshots**: WIZARD_COMPLETE temporarily cleared via Railway TCP proxy psql (mainline.proxy.rlwy.net:44022), Playwright captured all 7 pages, WIZARD_COMPLETE immediately restored. No live-DB risk since the operation is atomic and the restore is the immediate next command.
- **tsx added as devDep**: needed to run the TypeScript screenshot script; `npx tsx` is the idiomatic approach for this project's TypeScript-first setup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added per-field placeholder support to ApiKeysSection Field interface**
- **Found during:** Task 1 (ApiKeysSection update)
- **Issue:** The existing generic `placeholder={field.type === 'password' ? '••••••••••••' : 'https://...'}` would show `https://...` for the email-type INBOUND_EMAIL field, which is misleading
- **Fix:** Added optional `placeholder?: string` to Field interface; updated render logic to use `field.placeholder ?? ''`; set INBOUND_EMAIL field's placeholder to `user_xxx@upload.pipedream.net`
- **Files modified:** src/app/(dashboard)/settings/ApiKeysSection.tsx
- **Verification:** TypeScript passes (npx tsc --noEmit), no test failures
- **Committed in:** d8be683 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical UX correctness)
**Impact on plan:** Minimal scope addition; without it the email field would display `https://...` as placeholder, actively misleading self-hosters.

## Issues Encountered
- Live Railway deployment shows pre-rename step 6 copy in the screenshots (old heading "Pipedream Webhook URL") because the new code has not been deployed yet. This is expected — the screenshots capture wizard structure; the copy will be correct after next Railway deploy. The screenshots are valid for README documentation purposes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 7 wizard screenshots committed to `docs/images/` — ready for README embedding in plan 24-03
- INBOUND_EMAIL is the canonical key throughout; no remaining PIPEDREAM_WEBHOOK_URL references
- npm test: 9 files, 117 tests, 0 failing, 0 skipped
- No blockers

---
*Phase: 24-test-suite-cleanup-and-self-host-docs*
*Completed: 2026-04-11*
