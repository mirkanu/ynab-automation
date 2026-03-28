---
phase: 14-settings-editor
plan: 14-01
subsystem: admin-ui
tags: [settings, configuration, railway-api, admin]
dependency_graph:
  requires: [auth, dashboard-layout, setup-apply-api]
  provides: [settings-page, settings-form]
  affects: [dashboard-nav]
tech_stack:
  added: []
  patterns: [inline-css-styles, force-dynamic, client-form-state]
key_files:
  created:
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/settings/SettingsForm.tsx
    - src/app/(dashboard)/settings/loading.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
decisions:
  - API keys use password fields with masked placeholders; blank = keep current value
  - Railway token entered each time (not stored) matching SetupWizard pattern
  - Currency routes and senders use add/remove pattern from SetupWizard
metrics:
  duration: ~5 minutes
  completed: 2026-03-28
  tasks: 4
  files: 4
---

# Phase 14 Plan 01: Settings Editor Summary

Settings page with editable forms for all configuration (senders, currency accounts, API keys, other) plus Railway save via existing /api/setup/apply endpoint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Settings link to dashboard layout | 5939094 | layout.tsx |
| 2 | Create SettingsForm client component | fa5979b | SettingsForm.tsx |
| 3 | Create settings server page | 52bfdf3 | page.tsx, loading.tsx |
| 4 | Full verification | - | (no file changes) |

## What Was Built

### Settings Nav Link
Added "Settings" link to the dashboard nav bar after "Activity Log", matching existing link styles.

### SettingsForm Client Component (4 sections)
1. **Sender Routing (SET-01):** Add/edit/remove senders with email, name, accountId, notificationLabel fields. Minimum one sender enforced.
2. **Currency Routing (SET-02):** Add/edit/remove currency-to-accountId pairs. Currency auto-uppercased on save.
3. **API Keys (SET-03):** Password fields for Anthropic, YNAB, and Resend keys. Masked placeholders show current key shape. Blank = keep current value.
4. **Other Settings (SET-04):** Text inputs for admin email, inbound email, and YNAB budget ID.
5. **Save to Railway (SET-05):** Railway API token field (password, not stored). Posts to /api/setup/apply. Shows success/error feedback.

### Settings Server Page
Server component reads SENDERS, CURRENCY_ACCOUNTS, API keys, and other env vars at request time (force-dynamic). Passes current values to SettingsForm.

### Loading Skeleton
Shimmer skeleton matching the 4-section layout for instant perceived load.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- 111 tests passing (vitest)
- 0 TypeScript errors (tsc --noEmit)
