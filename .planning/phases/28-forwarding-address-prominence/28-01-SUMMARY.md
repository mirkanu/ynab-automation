---
phase: 28-forwarding-address-prominence
plan: "01"
subsystem: dashboard-ui
tags: [ux, forwarding-address, copy-to-clipboard, dashboard, wizard]
dependency_graph:
  requires: [27-settings-restructure-and-label-cleanup]
  provides: [FWD-01, FWD-02]
  affects: [dashboard, setup/done]
tech_stack:
  added: []
  patterns: [inline-styles, client-component-in-server-page]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/setup/done/page.tsx
decisions:
  - Forwarding address card repositioned above stats grid — first substantive element after dashboard heading
  - Blue-tinted left border (borderLeft: 3px solid #2563eb, backgroundColor: #eff6ff) distinguishes it visually from plain stat cards
  - Wizard done page uses conditional rendering — CopyButton shown when email configured, fallback span when not
metrics:
  duration: 8m
  completed: 2026-05-27
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 28 Plan 01: Forwarding Address Prominence Summary

Forwarding address made unmissable on dashboard (blue-highlighted card above stats) and wizard done page (copy-to-clipboard block replacing buried inline span).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Move forwarding address above stats grid with blue highlight | c2335ed | src/app/(dashboard)/dashboard/page.tsx |
| 2 | Add copy-to-clipboard block to wizard done page | 8baf341 | src/app/setup/done/page.tsx |

## What Was Built

**Task 1 — Dashboard (FWD-01):**
- Moved the `{inboundEmail && (...)}` block from after "Last Transaction" to directly after the `<h1>Dashboard</h1>` heading
- Applied `borderLeft: '3px solid #2563eb'` and `backgroundColor: '#eff6ff'` for visual distinction
- DOM order is now: heading → forwarding address → stats grid → last transaction

**Task 2 — Wizard Done Page (FWD-02):**
- Added `import CopyButton from '@/app/(dashboard)/components/CopyButton'`
- Added `copyRow` and `emailCode` style entries to the `S` object
- Replaced the inline `<span style={S.email}>{emailDisplay}</span>` inside a prose sentence with a dedicated flex row: `<code style={S.emailCode}>{emailDisplay}</code> <CopyButton text={emailDisplay} />`
- Conditional rendering: copy block shown when `INBOUND_EMAIL` is set, fallback span when not
- Updated note text to mention "They will appear in YNAB within about 60 seconds"

## Deviations from Plan

None — plan executed exactly as written.

## Build Check

Local `node_modules` are not installed in the source directory — project builds via Docker on Hetzner VPS (pre-existing constraint, same as previous phases). TypeScript syntax reviewed manually: both files are structurally correct with proper type assertions, valid JSX, and correct import paths.

## Known Stubs

None. Both changes are fully wired to `getSetting('INBOUND_EMAIL')` — same live DB source used throughout the codebase.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- [x] `src/app/(dashboard)/dashboard/page.tsx` — modified, committed at c2335ed
- [x] `src/app/setup/done/page.tsx` — modified, committed at 8baf341
- [x] Forwarding Address at line 54, gridTemplateColumns at line 81 (54 < 81 — correct order)
- [x] `borderLeft: '3px solid #2563eb'` present in dashboard file
- [x] `backgroundColor: '#eff6ff'` present in dashboard file
- [x] `CopyButton` imported and used in done/page.tsx
- [x] `copyRow` style defined and used in done/page.tsx
