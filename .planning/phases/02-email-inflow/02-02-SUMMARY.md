---
phase: 02-email-inflow
plan: "02"
subsystem: email-ingestion
tags: [webhook, email-parsing, dedup, amazon-detection, tdd, railway]
one_liner: "Pipedream webhook handler with message-ID dedup, Amazon body-scan detection, and forwarding-user sender extraction backed by PostgreSQL"

dependency_graph:
  requires:
    - 02-01 (PAYLOAD.md field paths — dedup key, from header, body.html structure)
    - 01-02 (ProcessedEmail table in Railway PostgreSQL)
    - 01-01 (Next.js API route skeleton, Railway deployment)
  provides:
    - /api/webhook: full inbound email processor (dedup, Amazon filter, sender record)
    - src/lib/email.ts: pure parsing utilities (extractMessageId, extractOriginalSender, isFromAmazon)
    - src/lib/email.test.ts: 16 unit tests for all parsing utilities
  affects:
    - Phase 3 (can read ProcessedEmail.sender to route to correct YNAB account)

tech_stack:
  added:
    - vitest@4.1.1 (test runner — no jest/jest-dom dependency)
  patterns:
    - TDD (RED → GREEN): tests written before implementation, all 16 pass
    - Pure utility functions in src/lib/email.ts (no side effects, fully testable)
    - Module-level PrismaClient in route.ts (Railway single-service pattern)
    - Always-200 webhook (Pipedream retry prevention)

key_files:
  created:
    - src/lib/email.ts (113 lines — PipedreamPayload type + 3 parsing functions)
    - src/lib/email.test.ts (16 tests across extractMessageId, extractOriginalSender, isFromAmazon)
    - vitest.config.ts (minimal node environment config)
  modified:
    - src/app/api/webhook/route.ts (replaced stub with full handler — 54 lines)
    - package.json (added vitest devDependency + npm test script)

decisions:
  - "Amazon detection via body HTML scan (@amazon.* regex) — forwarded emails bury original sender in blockquote, not top-level headers"
  - "extractOriginalSender returns the forwarding user (Manuel/Emily-Kate), not Amazon — this is the YNAB routing key"
  - "Non-Amazon emails do NOT get a ProcessedEmail record — dedup table stays clean"
  - "Module-level PrismaClient (not global singleton) per plan spec — adequate for single Railway service"
  - "vitest chosen over Node built-in test runner — TypeScript support without ts-node setup"

metrics:
  duration_seconds: 488
  completed_date: "2026-03-24T10:32:13Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  tests_added: 16
---

# Phase 02 Plan 02: Email Ingestion Handler Summary

Pipedream webhook handler with message-ID dedup, Amazon body-scan detection, and forwarding-user sender extraction backed by PostgreSQL.

## What Was Built

### Task 1: Email parsing utilities (TDD)

`src/lib/email.ts` exports three pure functions and a TypeScript interface:

- **`extractMessageId(payload)`** — reads `trigger.event.headers["message-id"]`; returns string or null
- **`extractOriginalSender(payload)`** — reads `trigger.event.headers.from.value[0].address`; returns the forwarding user's email (Manuel or Emily-Kate), not Amazon
- **`isFromAmazon(payload)`** — scans `trigger.event.body.html` for `@amazon.co.uk`, `@amazon.com`, `@amazon.de`, and other regional domains; returns boolean
- **`PipedreamPayload`** — TypeScript interface matching the full envelope documented in PAYLOAD.md

All 16 tests pass. Functions handle null, undefined, and malformed input without throwing.

### Task 2: Full webhook handler

`src/app/api/webhook/route.ts` replaced the Phase 1 stub with the full pipeline:

1. Parse JSON body
2. Extract message ID — log warn + 200 if absent
3. Dedup: `prisma.processedEmail.findUnique` — log + 200 if duplicate
4. Amazon filter: `isFromAmazon()` — log + 200 if not Amazon (no DB record)
5. Extract sender, log, create `ProcessedEmail` record
6. Return `{ received: true, sender, messageId }`
7. `try/catch` wraps all — any error returns 200 (Pipedream retry prevention)

## Verification Results

| Test | Result |
|------|--------|
| `npm test` (16 unit tests) | All pass |
| `npm run build` (TypeScript) | Exit 0, compiled cleanly |
| GET /api/webhook | `{"status":"ok"}` |
| POST with empty body | 200 OK `{"received":true}` |
| POST with Amazon payload | 200 OK `{"received":true,"sender":"manuelkuhs@gmail.com","messageId":"<TEST-SMOKE-002@gmail.com>"}` |
| POST same payload again (dedup) | 200 OK `{"received":true}` + log "Duplicate email skipped" |
| POST non-Amazon email | 200 OK `{"received":true}` + log "Non-Amazon email ignored" |

## Commits

- `25003de` — `feat(02-02): add email parsing utilities with TDD`
- `9abc379` — `feat(02-02): implement full webhook handler with dedup, Amazon filter, and sender extraction`

## Deviations from Plan

### Auto-added (Rule 2): vitest installation and config

- **Found during:** Task 1 (TDD setup)
- **Issue:** package.json had no test framework; plan specified vitest as preferred choice
- **Fix:** Installed `vitest@4.1.1`, created `vitest.config.ts`, added `npm test` script
- **Files modified:** `package.json`, `package-lock.json`, `vitest.config.ts`
- **Commit:** 25003de

No other deviations — plan executed as written.

## Requirements Fulfilled

- **EMAIL-01:** POST /api/webhook returns 200 OK for all valid Pipedream payloads
- **EMAIL-02:** Duplicate message IDs rejected silently (200, no second DB record)
- **EMAIL-03:** Original sender extracted and stored in ProcessedEmail.sender
- **EMAIL-04:** Non-Amazon emails ignored (200, no DB record, no error)

## Self-Check: PASSED

- FOUND: src/lib/email.ts
- FOUND: src/lib/email.test.ts
- FOUND: src/app/api/webhook/route.ts
- FOUND: .planning/phases/02-email-inflow/02-02-SUMMARY.md
- Commit 25003de verified in git log
- Commit 9abc379 verified in git log
