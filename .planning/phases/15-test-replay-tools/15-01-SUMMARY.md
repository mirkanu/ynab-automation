---
phase: 15-test-replay-tools
plan: 15-01
subsystem: tools
tags: [email-parse, replay, admin-ui, tools]
dependency_graph:
  requires: [claude-parse, ynab-api, activity-log, dashboard-layout]
  provides: [test-parse-endpoint, replay-endpoint, tools-page, replay-button]
  affects: [dashboard-nav, log-viewer]
tech_stack:
  added: []
  patterns: [inline-css-styles, client-component-forms, api-route-handlers]
key_files:
  created:
    - src/app/api/test-parse/route.ts
    - src/app/api/replay/route.ts
    - src/app/(dashboard)/tools/page.tsx
    - src/app/(dashboard)/tools/TestParseForm.tsx
    - src/app/(dashboard)/tools/loading.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/components/LogRow.tsx
decisions:
  - Replay uses replay-{originalMessageId}-{timestamp} to avoid unique constraint collision
  - Test parse is read-only (no YNAB transaction, no activity log)
  - Replay button uses secondary style with red confirmation step since it creates real transactions
metrics:
  duration: ~8 minutes
  completed: 2026-03-28
  tasks_completed: 7
  tasks_total: 7
---

# Phase 15 Plan 01: Test & Replay Tools Summary

Email parse preview tool and transaction replay capability for the admin UI -- the final phase of v4.0 Admin Backend.

## What Was Built

### Email Parse Preview (/tools page)
- **TestParseForm**: Client component with monospace textarea for pasting email HTML, sender name input, and Parse button
- Calls POST /api/test-parse which invokes Claude's parseOrderEmail and returns the ParsedOrder result
- Displays result card showing retailer (bold), amount + currency, description, date, and YNAB memo preview
- Read-only operation: no YNAB transaction created, no activity log written

### Transaction Replay (LogRow button)
- **Replay button** added to expanded log rows, only visible when rawBody exists
- Two-step confirmation: "Replay" button -> warning message + "Yes, replay" / "Cancel"
- Calls POST /api/replay with the messageId
- Replay endpoint fetches original ActivityLog entry, resolves sender config, re-parses with Claude, creates a real YNAB transaction, and logs a new ActivityLog entry
- New messageId uses `replay-{original}-{timestamp}` format to avoid unique constraint collision
- Shows loading spinner, green success message with transaction ID, or red error message

### Navigation & Loading
- "Tools" link added to dashboard nav bar after Settings
- Loading skeleton with shimmer animation for the tools page

## Task Completion

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add Tools link to dashboard layout | 0f640a4 | layout.tsx |
| 2 | Create /api/test-parse endpoint | 804a4c8 | route.ts |
| 3 | Create /api/replay endpoint | 53a0792 | route.ts |
| 4 | Create TestParseForm client component | 7a27fb3 | TestParseForm.tsx |
| 5 | Create tools page and loading skeleton | 7eaa229 | page.tsx, loading.tsx |
| 6 | Add replay button to LogRow | 697fa1b | LogRow.tsx |
| 7 | Full verification | - | (vitest 111 pass, tsc clean) |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- **vitest**: 8 test files, 111 tests passed
- **tsc --noEmit**: Clean, no errors
