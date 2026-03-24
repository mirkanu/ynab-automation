---
phase: 05-retailer-support
plan: "02"
subsystem: api
tags: [webhook, nextjs, ynab, anthropic, typescript]

# Dependency graph
requires:
  - phase: 05-retailer-support plan 01
    provides: parseOrderEmail with retailer field; createYnabTransaction with payeeName param
provides:
  - Webhook handler with Amazon-only filter removed — any retailer's order email flows through
  - parseOrderEmail wired to webhook replacing parseAmazonEmail
  - parsed.retailer passed as payeeName to createYnabTransaction
  - Euro-only orders routed to Euro Wise YNAB account based on currency detection
affects: [Phase 6 category tagging — uses same webhook pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Any-retailer webhook: no sender-content filter; Claude infers retailer from email body"
    - "Currency routing: Euro amounts detected and routed to WISE_EUR_ACCOUNT_ID"

key-files:
  created: []
  modified:
    - src/app/api/webhook/route.ts
    - src/lib/claude.ts
    - src/lib/claude.test.ts

key-decisions:
  - "Removed Step 4 Amazon filter entirely — all forwarded emails from any sender now reach Claude for parsing"
  - "isFromAmazon no longer imported or called — function remains in email.ts but unused by webhook"
  - "Parse failure notification now reads 'failed to parse order email' to be retailer-agnostic"
  - "Euro currency detection added in webhook: EUR-denominated orders route to Euro Wise YNAB account"

patterns-established:
  - "Retailer-agnostic pipeline: email → Claude (infers retailer) → YNAB payee = parsed.retailer"
  - "Currency routing pattern: detect EUR from parsed order, override accountId to WISE_EUR_ACCOUNT_ID"

requirements-completed: [RETAIL-01, RETAIL-02, RETAIL-03]

# Metrics
duration: 40min
completed: 2026-03-24
---

# Phase 5 Plan 02: Webhook Wiring Summary

**Amazon-only filter removed from webhook handler; any retailer's order confirmation now flows through Claude to a correctly-labelled YNAB transaction, with Euro orders routed to the Euro Wise account**

## Performance

- **Duration:** ~40 min (including Euro routing deviation and human verification)
- **Started:** 2026-03-24T19:30:00Z
- **Completed:** 2026-03-24T20:11:22Z
- **Tasks:** 2 (1 auto task + 1 checkpoint:human-verify, approved)
- **Files modified:** 3

## Accomplishments

- `isFromAmazon` import and the entire Step 4 filter block removed from `route.ts`
- `parseAmazonEmail` import replaced with `parseOrderEmail`; call site updated accordingly
- Steps renumbered 5-8 → 4-7 after filter removal
- All notification and log strings updated from "Amazon" to "order confirmation" language
- `payeeName: parsed.retailer` passed to `createYnabTransaction` so YNAB payee reflects actual retailer
- Euro-currency detection added: EUR-denominated orders route to Euro Wise YNAB account
- TypeScript compiles clean; all tests pass
- Human verification confirmed: eBay (non-Amazon) and Amazon both create YNAB transactions with correct retailer payee

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Amazon filter and wire retailer through webhook handler** - `a783c07` (feat)
2. **Deviation: Route Euro-only orders to Euro Wise YNAB account** - `32d2db5` (feat)

**Plan metadata:** `f1d710d` (docs: complete plan — at human-verify checkpoint)

## Files Created/Modified

- `src/app/api/webhook/route.ts` - Amazon filter removed; parseOrderEmail called; steps renumbered; all strings updated; Euro routing added
- `src/lib/claude.ts` - Updated to support Euro routing detection
- `src/lib/claude.test.ts` - Tests added for Euro routing behaviour

## Decisions Made

- Removed the Amazon filter entirely rather than replacing it with a different filter — the intent of phase 5 is to support any retailer unconditionally
- `isFromAmazon` left in `src/lib/email.ts` (untouched) — only the import and call in route.ts removed; clean-up deferred
- Euro currency routing added as a mid-task deviation to prevent Euro orders from landing in the wrong YNAB account

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Euro-order routing to Euro Wise YNAB account**
- **Found during:** Task 1 (Remove Amazon filter and wire retailer through webhook handler)
- **Issue:** With the Amazon filter removed, Euro-denominated orders would be processed but could land in the wrong YNAB account (GBP account instead of Euro Wise account)
- **Fix:** Added currency detection in webhook handler; when parsed order is EUR-denominated, `accountId` is overridden to `WISE_EUR_ACCOUNT_ID`; tests added for both paths
- **Files modified:** `src/app/api/webhook/route.ts`, `src/lib/claude.ts`, `src/lib/claude.test.ts`
- **Verification:** TypeScript compiles clean; all tests pass; human verification confirmed correct routing
- **Committed in:** `32d2db5` (mid-checkpoint feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical account routing)
**Impact on plan:** Euro routing is a correctness requirement — without it, Euro orders would appear in the wrong YNAB account. No scope creep.

## Issues Encountered

None beyond the Euro routing deviation documented above, which was caught and fixed automatically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 retailer support is fully wired end-to-end: any forwarded order email reaches Claude, retailer is extracted, and YNAB payee reflects the actual retailer
- Human verification passed: non-Amazon (eBay) and Amazon both confirmed working in production
- Euro orders route correctly to the Euro Wise account
- Phase 6 (category tagging) can build on this pipeline — `ParsedOrder` can be extended with a `category` field following the same pattern

---
*Phase: 05-retailer-support*
*Completed: 2026-03-24*
