---
phase: 09-setup-wizard
plan: "01"
subsystem: frontend
tags: [setup, wizard, ynab, onboarding, next.js]
dependency_graph:
  requires: []
  provides: [setup-wizard, root-page]
  affects: [src/app/page.tsx, src/app/setup/SetupWizard.tsx]
tech_stack:
  added: []
  patterns: [Next.js App Router server component, React useState client wizard, inline styles only]
key_files:
  created:
    - src/app/page.tsx
    - src/app/setup/SetupWizard.tsx
  modified: []
decisions:
  - Server component checks process.env.SENDERS at render time — no client-side config detection needed
  - YNAB API called directly from browser (CORS supported) — token never touches the server
  - All wizard state held in a single 'use client' component — no URL routing between steps
metrics:
  duration: ~10 minutes
  completed: 2026-03-26
---

# Phase 09 Plan 01: Setup Wizard Summary

**One-liner:** Browser-only 5-step setup wizard that guides new users through YNAB connection, sender config, and API key entry, then outputs Railway-ready env vars.

## What Was Built

### src/app/page.tsx (server component)
Reads `process.env.SENDERS` at render time. If set, renders a minimal "YNAB Automation is running" status page. If absent, renders `<SetupWizard />`. No client JS involved in this gate.

### src/app/setup/SetupWizard.tsx (client component)
Full 5-step wizard with `'use client'`. All logic and API calls run in the browser.

| Step | What it does |
|------|-------------|
| 0 — Welcome | Explains the wizard and lists what the user will need |
| 1 — Connect YNAB | Token input → fetch budgets → pick budget → fetch accounts |
| 2 — Senders | Per-sender: email, display name, YNAB account dropdown, optional notification label. Plus optional currency routing section |
| 3 — API keys | Anthropic key, admin email, optional Resend key |
| 4 — Results | All env vars displayed with individual Copy buttons. Railway instructions shown. |

Validation gates prevent advancing to the next step until required fields are filled. Computed env var values (`SENDERS` JSON, `CURRENCY_ACCOUNTS` JSON) are built client-side from the collected inputs.

## Task 3 — Already Done
`.env.example` already had `YNAB_PERSONAL_ACCESS_TOKEN` and `YNAB_BUDGET_ID`. Confirmed with `grep -c` (count: 2).

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Clean — no errors |
| `npm run build` | Succeeded — `/` route 4.33 kB, static prerender |
| `npm test` | 87/87 tests passing |

## Deviations from Plan

None — plan executed exactly as written. The plan's implementation blocks were copied verbatim into the files. No dependencies added, no schema changes, no deviations required.

## Self-Check

Files created:
- /data/home/ynab/src/app/page.tsx — EXISTS
- /data/home/ynab/src/app/setup/SetupWizard.tsx — EXISTS

Commit: 2053c01 — feat(09-01): add setup wizard — interactive config builder for new deployments — EXISTS

## Self-Check: PASSED
