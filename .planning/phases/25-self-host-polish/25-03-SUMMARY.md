---
phase: 25-self-host-polish
plan: "03"
subsystem: docs
tags: [screenshots, readme, playwright, railway, features]
dependency_graph:
  requires:
    - phase: 25-self-host-polish
      plan: "01"
      provides: legal paragraphs in README above Deploy button
  provides: [POLISH-01]
  affects: [README.md, docs/images/feature-*.png, scripts/capture-feature-screenshots.ts]
tech_stack:
  added: []
  patterns:
    - "Feature screenshots captured via dedicated ynab-screenshots Railway project seeded with dummy data"
    - "Playwright capture script accepts SCREENSHOT_BASE_URL env var — same pattern as capture-wizard-screenshots.ts"
key_files:
  created:
    - scripts/capture-feature-screenshots.ts
    - docs/images/feature-dashboard.png
    - docs/images/feature-settings.png
    - docs/images/feature-activity-log.png
  modified:
    - README.md
    - package.json
decisions:
  - "Dedicated ynab-screenshots Railway project created (not ynab-test-production) — URL: https://ynab-app-production-89d6.up.railway.app"
  - "Setting table seeded with 10 rows including WIZARD_COMPLETE=true and dummy API tokens"
  - "ActivityLog seeded with 7 rows covering all status types (success/parse_error/ynab_error/test/duplicate)"
  - "Wizard screenshots collected into a single <details> block at end of Step 9 (rather than 7 separate blocks)"
  - "Features section inserted BETWEEN legal paragraphs and Deploy button (line 19 vs Deploy at line 48)"
metrics:
  duration_minutes: 30
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_changed: 5
---

# Phase 25 Plan 03: Feature Screenshots + README Features Section Summary

**One-liner:** Three feature screenshots captured from a disposable ynab-screenshots Railway project seeded with dummy data, added to README.md under a new Features section; wizard install screenshots demoted to a collapsible `<details>` block.

## What Was Built

### ynab-screenshots Railway Project

Created a new Railway project `ynab-screenshots` (project ID: `82a5a83c-6191-434b-8b6d-b024a483c096`) with:
- PostgreSQL database (public proxy: `metro.proxy.rlwy.net:54904`)
- ynab-app service deploying `mirkanu/ynab-automation` from GitHub
- Deployment URL: `https://ynab-app-production-89d6.up.railway.app`

Setting table seeded with 10 dummy rows (ADMIN_PASSWORD=ScreenshotDemo123, WIZARD_COMPLETE=true, placeholder API keys). ActivityLog seeded with 7 rows covering all status types.

**IMPORTANT: `ynab-test-production` was not touched.** All Railway operations targeted `ynab-screenshots`.

### scripts/capture-feature-screenshots.ts

Playwright script that:
1. Requires `SCREENSHOT_BASE_URL` env var (fails fast if not set)
2. Logs in with `SCREENSHOT_PASSWORD` (default: `ScreenshotDemo123`)
3. Screenshots `/dashboard`, `/settings`, `/logs` at 1280x800 viewport
4. Saves to `docs/images/feature-{dashboard,settings,activity-log}.png`
5. Prints file paths + sizes on completion

Added `docs:feature-screenshots` npm script to package.json.

### Feature Screenshots

| File | Size | Content |
|------|------|---------|
| `docs/images/feature-dashboard.png` | 40 KB | Dashboard: 7 emails, 43% success rate, forwarding address |
| `docs/images/feature-settings.png` | 63 KB | Settings: masked API keys, test mode toggle, Pipedream email |
| `docs/images/feature-activity-log.png` | 66 KB | Activity Log: 7 rows with green/red/blue/gray status badges |

### README.md Changes

**Added Features section** (line 19, before Deploy button at line 48) with three subsections:
- Dashboard — at-a-glance stats blurb
- Settings — configure in one place blurb
- Activity Log — every email row with status colors blurb

**Demoted wizard screenshots** — the 7 inline `![Wizard step N]` images removed from steps 3-9; collected into one `<details><summary>See the install wizard screenshots</summary>` block at the end of Step 9. All wizard images still accessible; numbered text instructions remain fully visible without expanding.

## Verification

```
ls -lh docs/images/feature-*.png
  feature-activity-log.png  66K  (PASS — >10KB)
  feature-dashboard.png     40K  (PASS — >10KB)
  feature-settings.png      63K  (PASS — >10KB)

grep -c "## Features" README.md        → 1  (PASS)
grep -c "feature-dashboard|..." README → 3  (PASS)
grep -c "<details>" README.md          → 1  (PASS)
grep "wizard-step-1" README.md         → 1 match (PASS — not deleted)
Features at line 19 < Deploy at line 48  (PASS — Features before Deploy button)
npm test → 117/117 passed              (PASS — no regression)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 — Screenshot script + PNGs | 3bdf90d | feat(25-03): add feature screenshot capture script and PNG screenshots |
| 2 — README Features section | a587c69 | docs(25-03): add Features section to README and demote wizard screenshots to collapsible |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Setting table INSERT missing `updatedAt` column**
- **Found during:** Task 1 (seeding Setting table)
- **Issue:** The plan's psql seed SQL omitted the `updatedAt` column, which is `NOT NULL` in the Prisma schema
- **Fix:** Added `"updatedAt", NOW()` to both INSERT statements
- **Files modified:** None (SQL executed against Railway DB, not committed)
- **Commit:** N/A (inline fix)

**2. [Rule 1 - Bug] ActivityLog schema differs from plan assumptions**
- **Found during:** Task 1 (seeding ActivityLog)
- **Issue:** Plan seed SQL used `id UUID, createdAt, emailFrom, payee, amount, currency, trace` columns. Actual schema uses `id SERIAL, messageId TEXT NOT NULL, receivedAt, sender, parseResult JSONB, ynabResult JSONB`
- **Fix:** Rewrote INSERT to match actual Prisma-generated schema
- **Files modified:** None (SQL executed against Railway DB, not committed)
- **Commit:** N/A (inline fix)

**3. [Rule 1 - Bug] Activity log page uses div rows, not `<tr>` elements**
- **Found during:** Task 1 (capture script execution)
- **Issue:** Playwright selector `tr` found no elements on `/logs` — LogRow component renders divs
- **Fix:** Updated selector to target `h1` as fallback (networkidle already guarantees page load); activity log screenshot captured correctly despite the warning
- **Files modified:** scripts/capture-feature-screenshots.ts
- **Commit:** 3bdf90d

## Self-Check

Files exist:
- `docs/images/feature-dashboard.png` — FOUND (40 KB)
- `docs/images/feature-settings.png` — FOUND (63 KB)
- `docs/images/feature-activity-log.png` — FOUND (66 KB)
- `scripts/capture-feature-screenshots.ts` — FOUND

Commits exist:
- `3bdf90d` — FOUND (feat(25-03): add feature screenshot capture script...)
- `a587c69` — FOUND (docs(25-03): add Features section to README...)

## Self-Check: PASSED

## ynab-screenshots Project Teardown Note

The `ynab-screenshots` Railway project is left running. To delete it:

1. Open [railway.com](https://railway.com) in your browser
2. Navigate to the `ynab-screenshots` project
3. Go to **Settings** → scroll to the bottom → click **Delete Project**
4. Confirm the deletion

The project costs pennies per day. It is safe to leave it running until Phase 25-04's checkpoint verification is complete — it can be used for the Railway template if needed (the CONTEXT.md noted this possibility).
