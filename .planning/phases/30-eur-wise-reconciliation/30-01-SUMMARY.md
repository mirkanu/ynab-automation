---
phase: 30-eur-wise-reconciliation
plan: 01
subsystem: tools
tags: [ynab, wise, reconciliation, eur, gbp, typescript]

# Dependency graph
requires:
  - phase: 22-ynab-pat-settings-api-keys
    provides: getSetting('YNAB_ACCESS_TOKEN') and YNAB_BUDGET_ID stored in DB
  - phase: 29-eur-gbp-transfer-reconciliation
    provides: Tools page pattern; Wise API token confirmed available as WISE_API_TOKEN in container
provides:
  - getReconciliationStatus(): fetches Wise EUR balance + live EUR→GBP rate + YNAB cleared balance + gap
  - applyReconciliation(interestRatePct): creates Wise Interest (Reconciliation) txn + marks cleared→reconciled
  - GET /api/tools/reconcile-eur-wise — status endpoint (no mutations)
  - POST /api/tools/reconcile-eur-wise { interestRate } — apply reconciliation
affects: [tools-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Wise v4 balances API for EUR balance; Wise v1 rates API for live EUR→GBP rate
    - WISE_API_TOKEN env var (mapped from YNAB_WISE_API_TOKEN in .env.production via docker-compose as WISE_API_TOKEN)
    - Guard: gap < 0 throws before any mutation (Wise < YNAB = problem, block reconciliation)
    - Interest estimate displayed pre-confirm: rate% × wiseEurBalance × days/365 × eurGbpRate

key-files:
  created:
    - src/lib/ynab-eur-reconciliation.ts
    - src/app/api/tools/reconcile-eur-wise/route.ts
    - src/app/(dashboard)/tools/ReconcileEurWiseCard.tsx
  modified:
    - src/app/(dashboard)/tools/page.tsx

key-decisions:
  - "YNAB €Wise Euro account tracks balances in GBP (YNAB is GBP-based); all EUR amounts converted at transaction time"
  - "Wise WISE_API_TOKEN env var name: docker-compose maps YNAB_WISE_API_TOKEN → WISE_API_TOKEN inside container"
  - "Interest payee hardcoded as 790f0d8a-8975-4e1a-8f6a-28e548ae0e52 (Wise Interest (Reconciliation)) — verified from history"
  - "Gap explanation: ~2 months of 1.80% interest on €20-22K (April skipped in prior reconciliation)"
  - "User enters interest rate manually — Wise interest rate API not accessible (404/403)"

# Metrics
duration: ~2h (including manual reconciliation session + tool build + 3 deploy iterations)
completed: 2026-05-30
---

# Phase 30 Plan 01: EUR Wise Account Reconciliation — Summary

**Automated reconciliation for the €Wise Euro YNAB account: live Wise balance → GBP conversion → interest attribution → YNAB adjustment**

## What was built

Interactive tool on the Tools page that replaces a manual reconciliation workflow:

1. **Check Balances** — fetches Wise EUR balance (`/v4/profiles/{id}/balances`) and live EUR→GBP rate (`/v1/rates`), computes gap against YNAB cleared balance
2. **Interest attribution** — user enters current Wise EUR interest rate; tool shows `X% over Y days accounts for £Z of £W gap (N%)`
3. **Guard** — if Wise GBP equivalent < YNAB cleared, blocks with warning (indicates missing transaction or error)
4. **Accept & Reconcile** — creates `Wise Interest (Reconciliation)` transaction with memo `EURx,xxx.xx to GBPy,yyy.yy, interest z%`, then bulk-marks all cleared transactions as reconciled

## Manual reconciliation performed before build

Reconciled 2026-05-30:
- Wise EUR: €21,289.70 × 0.8666 = £18,449.65
- YNAB cleared was: £18,395.38
- Gap: +£54.27 (two months of 1.80% interest, April reconciliation had been skipped)
- Created: Wise Interest (Reconciliation) +£54.27, memo `EUR21,289.70 to GBP18,449.65, interest 1.80%`
- Reconciled 32 cleared transactions

## Files Created/Modified

- `src/lib/ynab-eur-reconciliation.ts` — `getReconciliationStatus()`, `applyReconciliation()` exports
- `src/app/api/tools/reconcile-eur-wise/route.ts` — GET (status) and POST (apply) handlers
- `src/app/(dashboard)/tools/ReconcileEurWiseCard.tsx` — UI card with interest rate input and confirmation step
- `src/app/(dashboard)/tools/page.tsx` — added ReconcileEurWiseCard import and usage

## Commits

- `f7e4637` feat(tools): EUR Wise reconciliation tool
- `43d471f` fix(tools): TS narrowing error + restore page import for EUR reconciliation card
- `b58b1e4` fix(tools): use WISE_API_TOKEN env var name as set in docker-compose
