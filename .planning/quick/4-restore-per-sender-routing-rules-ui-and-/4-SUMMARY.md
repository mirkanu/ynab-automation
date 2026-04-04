---
phase: quick-4
plan: "01"
subsystem: settings, inbound-email
tags: [sender-rules, routing, ynab, settings-ui]
dependency_graph:
  requires: []
  provides: [per-sender account routing, SENDER_RULES setting, SenderRulesSection]
  affects: [inbound email pipeline, settings page]
tech_stack:
  added: []
  patterns: [inline-style S object, fetch-on-mount client component, prisma.setting.upsert]
key_files:
  created:
    - src/app/api/settings/sender-rules/route.ts
    - src/app/(dashboard)/settings/SenderRulesSection.tsx
  modified:
    - src/app/(dashboard)/settings/page.tsx
    - src/app/api/email/inbound/route.ts
decisions:
  - "SENDER_RULES stored as JSON string in Setting table under key SENDER_RULES — consistent with existing Setting table pattern"
  - "accountId resolved before Step 5 (email parse) so rule override is in place before any async work"
  - "From header normalized with regex to strip 'Name <email>' format before matching"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-04T17:33:20Z"
  tasks_completed: 3
  files_changed: 4
---

# Quick Task 4: Restore Per-Sender Routing Rules Summary

**One-liner:** Per-sender email-to-account routing rules via SENDER_RULES JSON setting, with settings UI and inbound pipeline override.

## What Was Built

### Task 1: Sender Rules API Route
`src/app/api/settings/sender-rules/route.ts` — GET returns parsed `SenderRule[]` from Setting table; PUT validates and upserts. Returns 401 for unauthenticated requests, 400 for invalid rules.

### Task 2: SenderRulesSection Client Component
`src/app/(dashboard)/settings/SenderRulesSection.tsx` — Loads rules on mount, loads accounts for user's saved budget, add/delete rules with immediate UI updates. Wired into `settings/page.tsx` between YnabConnectionSection and SettingsForm.

### Task 3: Inbound Pipeline Integration
`src/app/api/email/inbound/route.ts` — After Step 4 (budget/account check), queries SENDER_RULES for the user, normalizes the `From` header (strips `Name <email>` wrapper), matches against rules, and overrides `accountId`. Malformed JSON falls back to default gracefully.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- `src/app/api/settings/sender-rules/route.ts` exists: FOUND
- `src/app/(dashboard)/settings/SenderRulesSection.tsx` exists: FOUND
- Commit bb7a18e (Task 1): FOUND
- Commit e1068fb (Task 2): FOUND
- Commit f1e2703 (Task 3): FOUND
- `npx tsc --noEmit` passes after all tasks: PASSED

## Self-Check: PASSED
