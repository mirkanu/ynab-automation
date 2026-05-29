---
phase: 29-eur-gbp-transfer-reconciliation
reviewed: 2026-05-29T10:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/ynab-transfers.ts
  - src/app/api/tools/fix-eur-transfers/route.ts
  - src/app/(dashboard)/tools/FixEurGbpTransfersCard.tsx
  - src/app/(dashboard)/tools/page.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-05-29T10:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase adds an EUR→GBP transfer reconciliation tool. The core logic is
straightforward and structurally sound. However, the API route is missing
authentication — a critical omission consistent with every other protected
route in this codebase. Additionally, the transaction-pairing algorithm
contains a many-to-one matching bug that can corrupt data when multiple EUR
outflows fall on the same date. These two issues must be resolved before
shipping.

---

## Critical Issues

### CR-01: API Route Has No Authentication Guard

**File:** `src/app/api/tools/fix-eur-transfers/route.ts:6-43`

**Issue:** Neither the GET nor POST handler calls `getAdminSession()` or
checks `isLoggedIn`. The middleware (`src/middleware.ts`) explicitly excludes
all `/api/` paths from its cookie check (line 51), so these handlers are
publicly accessible without a session. The POST handler deletes and mutates
YNAB transactions. Every peer route in this codebase (`/api/settings`,
`/api/test-parse`, `/api/ynab/status`, etc.) guards itself with
`getAdminSession()` — this route does not.

**Fix:**
```typescript
import { getAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... existing logic
}

export async function POST(_req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... existing logic
}
```

---

### CR-02: Pairing Algorithm Maps Multiple EUR Transactions to the Same GBP Transaction

**File:** `src/lib/ynab-transfers.ts:106`

**Issue:** `gbpTxns.find(g => g.date === eur.date)` always returns the
first GBP inflow on that date, regardless of how many EUR outflows exist.
If two EUR transfers go out on the same calendar day (e.g., two Wise
conversions), both `eurOutgoing` entries match the identical `matchingGbp`
record. The result is that the fix is applied twice to the same GBP
transaction: the first application succeeds; the second application
attempts to delete an already-deleted EUR transaction (Step 1) and then
updates the same GBP transaction again (Step 2). Whether this surfaces as
a 404 error or silent re-processing depends on YNAB's API, but the
produced `pairs` array is semantically wrong regardless.

**Fix:** Remove matched GBP transactions from the candidate pool after each
successful pairing:

```typescript
const usedGbpIds = new Set<string>();

for (const eur of eurOutgoing) {
  const matchingGbp = gbpTxns.find(g => g.date === eur.date && !usedGbpIds.has(g.id));
  if (!matchingGbp) continue;
  usedGbpIds.add(matchingGbp.id);

  // ... rest of pair construction
}
```

---

## Warnings

### WR-01: `JSON.parse` on Settings Value Has No Error Handling

**File:** `src/lib/ynab-transfers.ts:72`

**Issue:** `JSON.parse(currencyAccountsRaw)` will throw a `SyntaxError` if
the stored value is malformed. This exception propagates uncaught out of
`detectTransferPairs()`. The caller in the route handler wraps it in a
try/catch that returns a 500, so the app does not crash, but the error
message ("Unexpected token ...") is opaque. More importantly, if
`YNAB_CURRENCY_ACCOUNTS` is accidentally set to a non-JSON string by an
admin, both the GET dry-run and POST mutating endpoints fail without any
clear guidance.

**Fix:**
```typescript
let currencyAccounts: Record<string, string>;
try {
  currencyAccounts = JSON.parse(currencyAccountsRaw) as Record<string, string>;
} catch {
  throw new Error('YNAB_CURRENCY_ACCOUNTS is not valid JSON');
}
```

---

### WR-02: Partial-Failure State Leaves Transactions Inconsistent

**File:** `src/lib/ynab-transfers.ts:136-175`

**Issue:** `applyTransferFix` processes pairs sequentially without rollback.
Step 1 deletes the EUR transaction; Step 2 updates the GBP transaction. If
Step 1 succeeds but Step 2 throws (network error, YNAB rate limit, etc.),
the EUR transaction is deleted but the GBP transaction is never reassigned
as a transfer. The budget is left in a worse state than before the tool
ran — the raw GBP inflow still looks unreconciled and the EUR outflow that
would have paired with it is gone. The `FixResult` marks this as `success:
false`, but there is no compensating action and no warning to the user that
partial deletion has already occurred.

**Fix:** At minimum, surface to the user when Step 1 completed but Step 2
failed — log `"EUR txn deleted but GBP update failed"` in the error field
so the operator knows manual cleanup is required. Full rollback (re-create
the EUR transaction) is ideal but requires storing the original transaction
body before deletion.

---

### WR-03: `handleRun` in the UI Swallows Non-Error 4xx/5xx Responses

**File:** `src/app/(dashboard)/tools/FixEurGbpTransfersCard.tsx:159`

**Issue:** The condition for entering the error path is:
```typescript
if (!res.ok && data.error && !data.results) {
```
This means: if the server returns a non-2xx response _and_ there is a
`data.error` field _and_ there are no `data.results`, show the error. But
the route can return `{ error: "..." }` with status 500 _and_ no
`data.results` — that is handled correctly. The problem is the opposite
case: if `res.ok` is false but `data.results` is present (partial failure
body), the error branch is skipped and the code falls through to set
`status('success')`. Given `applyTransferFix` always returns `results`
even on per-pair errors (WR-02), a 500 with `results` would be silently
displayed as success. More robustly, check `res.ok` independently:

```typescript
if (!res.ok && !data.results) {
  setError(data.error ?? `HTTP ${res.status}`);
  setStatus('error');
  return;
}
```

---

## Info

### IN-01: Hardcoded Account IDs Are an Operational Hazard

**File:** `src/lib/ynab-transfers.ts:4-6`

**Issue:** `UK_CURRENT_ID`, `GBP_WISE_ID`, and `TRANSFER_PAYEE_ID` are
hardcoded as module-level constants. If the user ever changes their YNAB
budget, migrates accounts, or the YNAB API rotates IDs, this tool silently
fetches the wrong account's transactions or updates the wrong payee. The
comment "prototyped and verified 2026-05-29" indicates this was intentional
for a first pass, but it is a maintenance risk.

**Fix:** Expose these as settings (`YNAB_UK_CURRENT_ID`, `YNAB_GBP_WISE_ID`,
`YNAB_TRANSFER_PAYEE_ID`) or at minimum document them in `CLAUDE.md` as
values that must be updated if the budget is recreated.

---

### IN-02: Duplicated `TransferPair` and `FixResult` Interface Definitions

**File:** `src/app/(dashboard)/tools/FixEurGbpTransfersCard.tsx:4-23`

**Issue:** `TransferPair` and `FixResult` are re-declared verbatim in the
component file. They are already exported from `src/lib/ynab-transfers.ts`.
The component is a client component (`'use client'`) and cannot import
server-only modules directly, but these are plain data interfaces with no
Node.js dependencies — they can be extracted to a shared types file (e.g.,
`src/lib/ynab-transfers-types.ts`) and imported in both places. Duplication
means the two definitions can silently diverge over time.

---

_Reviewed: 2026-05-29T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
