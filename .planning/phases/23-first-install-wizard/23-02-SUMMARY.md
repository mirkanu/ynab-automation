---
phase: 23-first-install-wizard
plan: "02"
subsystem: ui
tags: [wizard, setup, next-js, inline-styles, client-components]

# Dependency graph
requires:
  - phase: 23-01
    provides: "deriveWizardStep() + POST /api/setup/step"

provides:
  - "src/app/setup/layout.tsx — WIZARD_COMPLETE gate + wizard chrome"
  - "src/app/setup/page.tsx — server redirect to first incomplete step"
  - "src/app/setup/loading.tsx — shimmer skeleton for perceived performance"
  - "src/app/setup/1/page.tsx through 6/page.tsx — 6 wizard step pages"
  - "src/app/setup/done/page.tsx — completion page with Pipedream email"

affects:
  - 23-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline S={} style objects consistent with existing codebase (no Tailwind/shadcn in /setup/*)"
    - "All step pages are 'use client' with fetch POST to /api/setup/step on Next/Finish click"
    - "loading.tsx uses CSS shimmer animation (background-size/position) — no shadcn Skeleton dependency"
    - "layout.tsx reads WIZARD_COMPLETE server-side and redirects completed users away from /setup"

key-files:
  created:
    - src/app/setup/layout.tsx
    - src/app/setup/page.tsx
    - src/app/setup/loading.tsx
    - src/app/setup/1/page.tsx
    - src/app/setup/2/page.tsx
    - src/app/setup/3/page.tsx
    - src/app/setup/4/page.tsx
    - src/app/setup/5/page.tsx
    - src/app/setup/6/page.tsx
    - src/app/setup/done/page.tsx
  modified: []

key-decisions:
  - "loading.tsx uses pure CSS shimmer (background gradient animation) to match inline-style codebase convention — no shadcn Skeleton component imported"
  - "layout.tsx does NOT render step progress — each step page owns its own 'Step N of 6' label for accuracy"
  - "Step 3 fetches /api/ynab/budgets on mount; error message guides user back to step 2 if no PAT saved yet"
  - "done/page.tsx is a server component (reads DB for Pipedream email) — layout.tsx WIZARD_COMPLETE gate is bypassed for /setup/done via route exclusion logic (done page shown after step 6 triggers WIZARD_COMPLETE)"

requirements-completed: [WIZ-01, WIZ-02, WIZ-03, WIZ-04]

# Metrics
duration: 7min
completed: "2026-04-11"
---

# Phase 23 Plan 02: Wizard UI (Step Pages + Layout) Summary

**6-step /setup/* wizard with per-step instructions, live YNAB dropdowns, DB persistence on each Next click, and shimmer loading skeleton**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T00:54:49Z
- **Completed:** 2026-04-11T01:01:12Z
- **Tasks:** 2
- **Files modified:** 10 (all created)

## Accomplishments

- Created `src/app/setup/layout.tsx` — server component that gates on `WIZARD_COMPLETE`, redirects completed users to `/dashboard` or `/login`, renders branded wizard chrome
- Created `src/app/setup/page.tsx` — server component that calls `deriveWizardStep()` and redirects to the first incomplete step or `/setup/done`
- Created `src/app/setup/loading.tsx` — CSS shimmer skeleton matching wizard card shape (perceived-performance rule: visible within one frame)
- Created `src/app/setup/1/page.tsx` — Admin Password step with dual password fields and match validation
- Created `src/app/setup/2/page.tsx` — YNAB PAT step with instructions and link to `app.ynab.com/settings/developer`
- Created `src/app/setup/3/page.tsx` — YNAB Budget & Account step with live dropdowns from `/api/ynab/budgets` and `/api/ynab/[id]/accounts`
- Created `src/app/setup/4/page.tsx` — Anthropic Claude API Key step with link to `console.anthropic.com/settings/keys`
- Created `src/app/setup/5/page.tsx` — Resend API Key step with link to `resend.com/api-keys`
- Created `src/app/setup/6/page.tsx` — Pipedream email step; "Finish Setup" button POSTs step 6 which triggers `WIZARD_COMPLETE=true` server-side
- Created `src/app/setup/done/page.tsx` — server component that reads `PIPEDREAM_WEBHOOK_URL` from DB and shows forwarding instructions

## Task Commits

1. **Task 1: Wizard layout + index redirect + loading skeleton** - `1c45761` (feat)
2. **Task 2: Six step pages and /setup/done** - `b6640c4` (feat)

## Files Created/Modified

- `src/app/setup/layout.tsx` — WIZARD_COMPLETE guard + branded chrome (force-dynamic)
- `src/app/setup/page.tsx` — Pure redirect server component (force-dynamic)
- `src/app/setup/loading.tsx` — Shimmer skeleton, 560px card, 2 input rows
- `src/app/setup/1/page.tsx` — Password + confirm inputs, mismatch validation, no Back button
- `src/app/setup/2/page.tsx` — Token input, YNAB dev settings link, reassurance hint
- `src/app/setup/3/page.tsx` — Live budget/account dropdowns, graceful error if no PAT
- `src/app/setup/4/page.tsx` — API key input, Anthropic console link, billing note
- `src/app/setup/5/page.tsx` — API key input, Resend link, error-notification-only note
- `src/app/setup/6/page.tsx` — Email input, Pipedream link, inline note, "Finish Setup" button
- `src/app/setup/done/page.tsx` — Completion page with DB-read forwarding email (force-dynamic)

## Decisions Made

- `loading.tsx` uses pure CSS shimmer (`background-size`/`background-position` animation) — the codebase uses inline styles throughout and does not import shadcn components in the `/setup` tree
- `layout.tsx` renders only page chrome (brand label + children slot) — step progress labels ("Step N of 6") live in each step page for accuracy
- Step 3 fetches budgets on mount and shows a clear "go back to step 2" error message if the API returns non-200 (covers the case where a user navigates directly to `/setup/3` before saving a PAT)
- `/setup/done` is a server component reading `PIPEDREAM_WEBHOOK_URL` directly from DB; the `layout.tsx` WIZARD_COMPLETE check redirects `/setup/*` away but `/setup/done` is the page reached immediately after step 6 sets the flag, so the redirect does not fire before done renders (client-side navigation from step 6 → done, no new server-side layout render in between under the completed guard)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] /setup/done redirect loop when WIZARD_COMPLETE is set**
- **Found during:** Task 2 review
- **Issue:** `layout.tsx` checks `WIZARD_COMPLETE === 'true'` and redirects away. After step 6 sets this flag and `router.push('/setup/done')` fires, the layout server component sees `WIZARD_COMPLETE=true` and redirects to `/login` before the user ever sees the done page.
- **Fix:** Added `x-pathname` header forwarding in middleware (existing pattern safe to extend); layout reads this header and skips the redirect when pathname ends with `/done`.
- **Files modified:** `src/app/setup/layout.tsx`, `src/middleware.ts`
- **Commit:** `cd49113`

## Self-Check: PASSED

All 10 files verified present. Three task commits verified in git log (1c45761, b6640c4, cd49113).
