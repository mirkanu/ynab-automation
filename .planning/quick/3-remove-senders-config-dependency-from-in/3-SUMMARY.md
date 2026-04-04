# Quick Task 3: Remove SENDERS config dependency from inbound email

**Completed:** 2026-04-04
**Commit:** afa76bd

## What Changed

Refactored `src/app/api/email/inbound/route.ts` to remove dependency on the `SENDERS` env var (v3.0/v4.0 pattern). In the multi-tenant model, each user selects their YNAB budget and account via settings — no per-sender routing needed.

**Before:** Emails rejected unless sender matched an entry in the SENDERS JSON array. Account routing determined by sender config.

**After:** Any forwarded email is accepted. Budget/account come from `user.selectedBudgetId` and `user.selectedAccountId`. Claude auto-detects the retailer name.

## Files Modified

- `src/app/api/email/inbound/route.ts` — Removed loadConfig/getSenderByEmail/getAccountForCurrency, added budget/account selection guard
