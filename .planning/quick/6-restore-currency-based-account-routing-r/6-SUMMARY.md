# Quick Task 6: Restore currency-based account routing rules

**Completed:** 2026-04-04
**Commit:** 58cb8be

## What Changed

Added per-user currency routing rules — the old CURRENCY_ACCOUNTS functionality restored as a DB-backed per-user setting with a full UI.

**Priority order for account selection:**
1. Currency rule match (e.g., EUR → Euro account) — highest priority
2. Sender rule match (e.g., emily-kate@... → Joint account)
3. Default selected account — fallback

## Files Created

- `src/app/api/settings/currency-rules/route.ts` — GET/PUT API for CURRENCY_RULES setting
- `src/app/(dashboard)/settings/CurrencyRulesSection.tsx` — UI with add/edit/delete, common currency dropdown

## Files Modified

- `src/app/(dashboard)/settings/page.tsx` — Wired in CurrencyRulesSection between Sender Rules and Email Processing
- `src/app/api/email/inbound/route.ts` — Added currency rule lookup after Claude parsing
