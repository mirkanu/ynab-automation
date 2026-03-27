# Phase 12-01 Summary: Activity Log Infrastructure

**Completed:** 2026-03-27
**Duration:** ~10 minutes

## What Was Built

A durable activity logging system that records every email processed by the pipeline with full trace data.

### New Files
- `src/lib/activity-log.ts` — `ActivityLogEntry` interface and `writeActivityLog()` helper
- `src/lib/activity-log.test.ts` — 3 unit tests (success entry, error entry, DB error swallowing)
- `src/app/api/webhook/route.test.ts` — 6 tests covering all webhook exit paths

### Modified Files
- `prisma/schema.prisma` — Added `ActivityLog` model (id, messageId, status, sender, subject, rawBody, parseResult, ynabResult, errorType, errorMessage, receivedAt, createdAt)
- `src/app/api/webhook/route.ts` — Instrumented all 6 exit paths with activity logging; switched from standalone PrismaClient to shared singleton

### Requirements Covered
| Req | Description | How |
|-----|-------------|-----|
| LOG-01 | Email metadata stored | sender, subject, receivedAt, rawBody fields |
| LOG-02 | Claude parse output stored | parseResult JSON column |
| LOG-03 | YNAB result stored | ynabResult JSON column |
| LOG-04 | Errors stored with detail | status, errorType, errorMessage fields |

### Exit Paths Instrumented
1. **no_message_id** — No message ID in webhook payload
2. **duplicate** — Email already processed (dedup hit)
3. **unknown_sender** — Sender not in SENDERS config
4. **parse_error** — Claude failed to parse the email
5. **ynab_error** — YNAB API returned an error
6. **success** — Full pipeline completed, transaction created

### Test Results
- 103 tests passing (was 94, +9 new)
- 0 failures
- Prisma schema valid

### Deviations from Plan
- Migration not run (no local DATABASE_URL) — will be applied on Railway deployment via `prisma migrate deploy`
- Bonus fix: webhook route now uses `prisma` singleton from `db.ts` instead of creating its own `PrismaClient`

### Next Steps
- Run `npx prisma migrate dev --name add-activity-log` on Railway or with DATABASE_URL set
- Phase 13 (Admin UI Shell + Dashboard + Log Viewer) can now query ActivityLog for display
