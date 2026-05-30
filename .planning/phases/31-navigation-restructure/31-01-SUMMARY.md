---
phase: 31-navigation-restructure
plan: "01"
subsystem: navigation
tags: [navigation, routing, client-component, next-app-router]
dependency_graph:
  requires: []
  provides:
    - Navigation client component with collapsible Email Automation and Currency sections
    - 6 new nested route pages under email-automation/ and currency/
  affects:
    - src/app/(dashboard)/layout.tsx (Plan 02 will wire Navigation in)
tech_stack:
  added: []
  patterns:
    - useState collapsible sections with aria-expanded
    - usePathname for active-link detection
    - Next.js App Router nested route pages
key_files:
  created:
    - src/app/(dashboard)/components/Navigation.tsx
    - src/app/(dashboard)/email-automation/logs/page.tsx
    - src/app/(dashboard)/email-automation/rules/page.tsx
    - src/app/(dashboard)/email-automation/tools/page.tsx
    - src/app/(dashboard)/currency/transfers/page.tsx
    - src/app/(dashboard)/currency/reconciliation/page.tsx
    - src/app/(dashboard)/currency/conversion/page.tsx
  modified: []
decisions:
  - Navigation.tsx uses href anchor tags (not next/link) to match existing layout.tsx pattern
  - Dropdown positioned absolutely relative to section button div
  - currency/conversion is a stub placeholder (Phase 33 will implement)
metrics:
  duration_minutes: 10
  tasks_completed: 2
  tasks_total: 2
  completed_date: "2026-05-30"
---

# Phase 31 Plan 01: Navigation Component and Route Skeleton Summary

Navigation.tsx client component with two collapsible sections (Email Automation, Currency) plus 6 new nested route pages that replicate existing page content at new URL paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Navigation client component | a6565e3 | src/app/(dashboard)/components/Navigation.tsx |
| 2 | Create all nested route page files | 9920d4b | 6 new page.tsx files |

## What Was Built

### Task 1: Navigation.tsx

A `'use client'` component that:
- Uses `useState` for collapsible section state (`emailAutomation`, `currency`)
- Uses `usePathname` from next/navigation for active-link detection
- Renders static links for Dashboard and Settings
- Renders two collapsible sections with caret rotation animation
- Each section expands to show sub-items in an absolutely-positioned dropdown
- Active state applied via `isActive(href)` helper — bold text and `aria-current="page"`
- All styles match the existing layout.tsx nav bar exactly (colors, spacing, font size)

### Task 2: 6 New Route Pages

**Email Automation section:**
- `email-automation/logs/page.tsx` — full Activity Log page (copied from logs/page.tsx with corrected relative imports at `../../components/`)
- `email-automation/rules/page.tsx` — full Rules page (copied from rules/page.tsx with corrected relative imports at `../../settings/`)
- `email-automation/tools/page.tsx` — Test & Replay only: SettingsForm + TestParseForm (FixEurGbpTransfersCard and ReconcileEurWiseCard excluded — they moved to currency pages)

**Currency section:**
- `currency/transfers/page.tsx` — focused page rendering FixEurGbpTransfersCard only
- `currency/reconciliation/page.tsx` — focused page rendering ReconcileEurWiseCard only
- `currency/conversion/page.tsx` — placeholder "Coming soon" page (Phase 33)

All pages import from `../../tools/` for the card components, and have auth guards via `getAdminSession()`.

## Known Stubs

- `currency/conversion/page.tsx` — intentional placeholder. No tool rendered. Phase 33 will implement bulk EUR→GBP conversion using historical exchange rates. The stub is identified in the plan and is by design.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- All 6 page files confirmed to exist via file existence check
- All required content confirmed via grep (getActivityLogs, SenderRulesSection, TestParseForm, FixEurGbpTransfersCard, ReconcileEurWiseCard, "Coming soon")
- Navigation.tsx confirmed to contain: 'use client', useState, usePathname, aria-expanded, aria-current, email-automation/logs, currency/transfers, export default function Navigation
- npm run build could not be run locally (project has no local node_modules; build happens via Docker on Hetzner VPS). TypeScript correctness verified by file structure inspection and manual import path analysis.

## Self-Check: PASSED

Files created:
- FOUND: src/app/(dashboard)/components/Navigation.tsx
- FOUND: src/app/(dashboard)/email-automation/logs/page.tsx
- FOUND: src/app/(dashboard)/email-automation/rules/page.tsx
- FOUND: src/app/(dashboard)/email-automation/tools/page.tsx
- FOUND: src/app/(dashboard)/currency/transfers/page.tsx
- FOUND: src/app/(dashboard)/currency/reconciliation/page.tsx
- FOUND: src/app/(dashboard)/currency/conversion/page.tsx

Commits verified:
- a6565e3: feat(31-01): create Navigation client component with collapsible sections
- 9920d4b: feat(31-01): create 6 nested route pages for email-automation and currency sections
