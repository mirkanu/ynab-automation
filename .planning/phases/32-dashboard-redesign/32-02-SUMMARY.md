---
phase: 32-dashboard-redesign
plan: "02"
subsystem: dashboard-ui
tags: [dashboard, email-automation, currency, polling, client-component]
dependency_graph:
  requires:
    - 32-01 (getLastToolRuns, getDashboardStats.lastEmailReceivedAt, GET /api/dashboard/currency-status)
  provides:
    - Two-panel dashboard layout (Email Automation + Currency)
    - CurrencyPanel client component polling /api/dashboard/currency-status every 5s
  affects:
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/dashboard/CurrencyPanel.tsx
tech_stack:
  added: []
  patterns:
    - 'use client' component with setInterval polling
    - useEffect cleanup via clearInterval
    - Server component consuming getDashboardStats() with Date formatting
    - Two-column CSS grid with repeat(auto-fit, minmax(300px, 1fr)) for responsive layout
key_files:
  created:
    - src/app/(dashboard)/dashboard/CurrencyPanel.tsx
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
decisions:
  - "CurrencyPanel polls every 5s using setInterval; initial fetch before interval to avoid blank state on load"
  - "Email Automation panel is server-rendered (no real-time needed — aggregates); Currency panel is client component for live updates"
  - "Forwarding Address card preserved verbatim from Phase 28 below the two panels"
  - "lastEmailReceivedAt formatted with toLocaleDateString en-GB without year (matches UI-SPEC 'May 30, 2:32 PM' style)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  files_modified: 2
---

# Phase 32 Plan 02: Dashboard UI — Two-Panel Layout Summary

**One-liner:** Replaced old clickable stat cards with two-panel grid: Email Automation panel (server-rendered from getDashboardStats) and CurrencyPanel client component (polls /api/dashboard/currency-status every 5s), preserving the Phase 28 Forwarding Address card below.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| T1 | Create CurrencyPanel.tsx client component | 5fc7e65 | CurrencyPanel.tsx |
| T2 | Rewrite dashboard/page.tsx with two-panel layout | 4369d4b | page.tsx |

## Verification Results

- `grep 'use client' CurrencyPanel.tsx` — present on line 1
- `grep setInterval CurrencyPanel.tsx` — present, 5000ms interval
- `grep clearInterval CurrencyPanel.tsx` — present in useEffect return cleanup
- `grep 'currency-status' CurrencyPanel.tsx` — present
- `grep 'Email Automation' page.tsx` — present
- `grep CurrencyPanel page.tsx` — imported and rendered
- `grep 'Forwarding Address' page.tsx` — preserved
- `grep 'force-dynamic' page.tsx` — present
- `grep redirect page.tsx` — present after session check
- `npx tsc --noEmit` — zero errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data is wired:
- Email Automation panel reads from getDashboardStats() (live DB queries)
- Currency panel polls GET /api/dashboard/currency-status (reads from Settings table via getLastToolRuns())
- Forwarding Address reads from getSetting('INBOUND_EMAIL')

## Threat Flags

None. Trust boundaries match the plan's threat model:
- T-32-04: CurrencyPanel fetch is protected by getAdminSession() 401 on the API route (Plan 01)
- T-32-05: Server component protected by getAdminSession() + redirect('/login') unchanged
- T-32-06: CurrencyPanel is GET-only, no write capability exposed to client

## Checkpoint: Human Verification Required

Task 3 is a `checkpoint:human-verify` requiring live dashboard inspection at https://ynab.manuelkuhs.com/dashboard.

Verification steps:
1. Deploy using the standard deploy command from CLAUDE.md
2. Verify Email Automation panel title, subtitle, and three rows (last email, success rate, last YNAB transaction)
3. Verify Currency panel title, subtitle, and three rows (EUR→GBP, EUR Conversion, EUR Reconciliation)
4. Run a currency tool and confirm Currency panel updates within 5s without page reload
5. Verify Forwarding Address card appears below both panels
6. Verify two-column desktop / single-column mobile responsive grid

## Self-Check: PASSED

- [x] `src/app/(dashboard)/dashboard/CurrencyPanel.tsx` exists
- [x] `src/app/(dashboard)/dashboard/page.tsx` rewritten with two-panel layout
- [x] Commits 5fc7e65 and 4369d4b present in git log
- [x] TypeScript compilation: zero errors
