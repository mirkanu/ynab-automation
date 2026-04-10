# Phase 15: Test & Replay Tools - Research

**Researched:** 2026-03-28
**Domain:** Email parse preview + transaction replay from activity logs
**Confidence:** HIGH

## Summary

Phase 15 adds two tools to the admin UI:
1. **Email Parse Preview** (TEST-01): Paste raw email HTML, see Claude's parse result without hitting YNAB
2. **Transaction Replay** (TEST-02): Re-run a logged email through the full pipeline

## Architecture

### TEST-01: Email Parse Preview

**New page:** `/tools` (or `/test`) — textarea for HTML, submit button, result display.

**Flow:**
1. User pastes email HTML into textarea
2. Client POSTs to `/api/test-parse` with `{ html, senderName }`
3. API route calls `parseOrderEmail(html, senderName)` from `src/lib/claude.ts`
4. Returns `ParsedOrder` result: `{ amount, description, retailer, currency, date }`
5. Client displays result (or error if null)

**parseOrderEmail signature:**
- Input: `(html: string, senderName: string)` → calls Claude Haiku
- Output: `ParsedOrder | null` — `{ amount: number, description: string, retailer: string, currency: string, date: string }`

### TEST-02: Transaction Replay

**New API route:** `/api/replay` — accepts `messageId`, fetches ActivityLog entry, re-runs pipeline.

**Flow:**
1. User clicks "Replay" button on a log row (only shown when rawBody exists)
2. Client POSTs to `/api/replay` with `{ messageId }`
3. API route:
   a. Fetches ActivityLog by messageId
   b. Resolves sender from stored `sender` field via `getSenderByEmail()`
   c. Calls `parseOrderEmail(rawBody, senderInfo.name)`
   d. Resolves currency account via `getAccountForCurrency()`
   e. Calls `createYnabTransaction()` with parsed data
   f. Writes new ActivityLog entry for the replay
4. Returns success/error to client

**Replay should NOT check deduplication** — it's intentionally re-running.

### Key Files

| Component | File |
|-----------|------|
| Claude parser | `src/lib/claude.ts` — `parseOrderEmail()` |
| YNAB client | `src/lib/ynab.ts` — `createYnabTransaction()`, `getCategories()`, `findCategory()` |
| Config | `src/lib/config.ts` — `loadConfig()`, `getSenderByEmail()`, `getAccountForCurrency()` |
| Activity log | `src/lib/activity-log.ts` — `writeActivityLog()` |
| Log queries | `src/lib/activity-log-queries.ts` — `getActivityLogs()` |
| LogRow UI | `src/app/(dashboard)/components/LogRow.tsx` |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` |
| Webhook (reference) | `src/app/api/webhook/route.ts` |

### Security
- Both API routes behind auth middleware (same as all /admin routes)
- Test parse is read-only (no side effects)
- Replay creates real YNAB transactions (user must confirm intent)
