# Phase 12: Activity Log Infrastructure - Research

**Researched:** 2026-03-27
**Domain:** PostgreSQL activity logging for a Next.js email-to-YNAB pipeline
**Confidence:** HIGH

## Summary

Phase 12 adds durable per-email activity records to the existing PostgreSQL database so every pipeline run is fully traceable. The existing `ProcessedEmail` model stores only deduplication data (messageId, sender, timestamp). The new `ActivityLog` model captures the full pipeline trace: inbound email metadata, Claude parse output, YNAB result, and any errors.

The key design decision is whether to extend `ProcessedEmail` or create a separate model. A separate `ActivityLog` model is cleaner: `ProcessedEmail` remains a lightweight dedup index, while `ActivityLog` captures rich trace data. They share `messageId` as a logical key.

## Phase Requirements

| ID | Description | Implementation Approach |
|----|-------------|------------------------|
| LOG-01 | Every inbound email written to DB (from, subject, timestamp, raw body) | `ActivityLog` model with sender, subject, receivedAt, rawBody fields |
| LOG-02 | Claude parse output stored per entry (retailer, amount, date, currency) | JSON column `parseResult` on `ActivityLog` |
| LOG-03 | YNAB result stored per entry (success/fail, transaction ID, amount, account) | JSON column `ynabResult` on `ActivityLog` |
| LOG-04 | Errors stored with full detail (type, message) | `status` enum + `errorType`/`errorMessage` fields on `ActivityLog` |

## Architecture

### Database Schema (new model)

```prisma
model ActivityLog {
  id            Int      @id @default(autoincrement())
  messageId     String   @unique
  status        String   // "success" | "parse_error" | "ynab_error" | "unknown_sender" | "duplicate" | "no_message_id"

  // Inbound email metadata (LOG-01)
  sender        String?
  subject       String?
  receivedAt    DateTime @default(now())
  rawBody       String?  // HTML body from Pipedream

  // Claude parse result (LOG-02)
  parseResult   Json?    // { retailer, amount, date, currency, description }

  // YNAB outcome (LOG-03)
  ynabResult    Json?    // { transactionId, amount, accountId, payeeName, date }

  // Error detail (LOG-04)
  errorType     String?  // "parse_failed" | "ynab_api_error" | "unknown_sender" | "db_error"
  errorMessage  String?

  createdAt     DateTime @default(now())
}
```

### Write Path

The webhook route handler (`src/app/api/webhook/route.ts`) will be instrumented to build an `ActivityLog` record progressively as data becomes available at each pipeline step. A single `prisma.activityLog.create()` call at the end of each code path writes the complete record.

This approach is simpler and more reliable than multiple upserts — each exit point in the handler constructs the log entry with whatever data is available at that point.

### Key Design Decisions

1. **Separate model (not extending ProcessedEmail):** ProcessedEmail remains the fast dedup index. ActivityLog is the rich trace. Both keyed on messageId.
2. **JSON columns for parse/YNAB results:** Avoids schema migrations when parse output evolves. Phase 13 UI can display these directly.
3. **Status as string enum:** Simple, readable, filterable. No need for a formal PostgreSQL enum.
4. **rawBody stored as text:** HTML bodies can be large (100KB+) but PostgreSQL handles text columns efficiently. Enables replay in Phase 15.
5. **Single write per request:** Build the log entry object progressively, write once at each exit point. Simpler than create-then-update.

### Instrumentation Points

The webhook handler has these exit points, each needing a log write:

| Exit Point | Status | Data Available |
|------------|--------|----------------|
| No message ID | `no_message_id` | None |
| Duplicate | `duplicate` | messageId, sender |
| Unknown sender | `unknown_sender` | messageId, sender, subject, rawBody |
| Parse failed | `parse_error` | messageId, sender, subject, rawBody, error |
| YNAB error | `ynab_error` | messageId, sender, subject, rawBody, parseResult, error |
| Success | `success` | messageId, sender, subject, rawBody, parseResult, ynabResult |

### Helper Module

A new `src/lib/activity-log.ts` module will provide:
- `ActivityLogEntry` TypeScript interface
- `writeActivityLog(entry)` function wrapping `prisma.activityLog.create()`

This keeps the webhook handler clean — it builds the entry object and calls one function.
