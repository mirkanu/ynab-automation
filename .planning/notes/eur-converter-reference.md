---
title: EUR Converter — reference implementation and live-data findings
date: 2026-11-07
context: Planning input for Phase 33 (EUR reconciliation, transaction matching, gap breakdown)
---

# Phase 33 — EUR Converter: reference implementation and live-data findings

Companion to `33-RESEARCH.md` in the Phase 33 directory (which covers the reconciliation half of
Phase 33). This file records what the Phase 33 **converter** — our native replacement for
`https://ynab.rmillan.com/` — has to reproduce, and what was learned by probing the live budget
and the YNAB API on 2026-11-07.

## The reference implementation

`ynab.rmillan.com` ("Multi-Currency for YNAB") is the third-party tool that has been converting
EUR-account transactions since before this project existed. It is a closed-source hosted app:
**no source code is available** — its JS bundles contain no `skipped`/`Converted` strings. What
follows is its *observable behaviour*, reverse-engineered from the live budget.

It is a reference for **behaviour**, not for code:

| Behaviour | Detail |
|---|---|
| Converts EUR-account rows to their GBP equivalent | Rewrites the transaction amount; the €Wise Euro account is a GBP account, so rows must hold GBP values |
| Leaves a marker | `-X EUR (FX rate: r) · <original memo>` — the marker it recognises on later runs, so it never converts the same row twice |
| Skips on request | Appends ` (skipped)` to the memo; it honours that marker on later runs, so a skipped row is never converted |
| Marks split rows differently | `€X` (e.g. `€553`) — see the split-transaction section below |
| Never touches fee/interest rows | Wise fees, asset service fees and interest are left alone |

Once Phase 33 ships, rmillan is no longer needed. It matters here only because **its output is
the legacy data our detector has to read** (CONV-01) and because it is the behavioural spec we
are replacing.

## Legacy memo dialects in the €Wise Euro account

555 non-deleted rows scanned on 2026-11-07:

| Dialect | Rows | Meaning |
|---|---|---|
| `-X EUR (FX rate: r) · …` | 511 | converted by rmillan |
| `-X EUR (FX rate: r) · Converted X EUR to Y GBP using GSDlabs (skipped)` | 19 | conversion pairs, fixed by our own transfers tool (memo format introduced 2026-11-07) |
| `(skipped)` only | 19 | 18 are our own reconciliation adjustments, 1 is a spend rmillan was told to skip |
| `€X` | 4 | converted by rmillan, on split transactions |
| no marker | 6 | unconverted — the Phase 33 candidates (€9.99 Google Photos, one per month) |

A detector that only looks for one dialect will offer already-converted rows for conversion.
The `EUR (FX rate:` marker covers 530 of the 549 marked rows; `€X` and `(skipped)` need their
own rules.

## The memo format the converter writes

`-X EUR (FX rate: r) · Converted X EUR to Y GBP using GSDlabs`

Rules that go with it:

- **No `(skipped)`.** That marker means "rmillan, leave this row alone" — it only makes sense
  while rmillan is still in use. The converter *is* the replacement, so it must not write it.
  The EUR→GBP Transfers tool keeps writing it until rmillan is retired; after that it goes too.
- **The EUR figure is negative**, so the Phase 33 reconciliation can sum EUR out of memos.
- **The FX marker must hold the EUR *input*, not the GBP output.** rmillan sometimes writes the
  GBP figure there (its own bug), which makes the marker unrecoverable. Our format must satisfy:
  re-applying the recorded rate reproduces the GBP amount exactly — `input × rate = output`.
  This is asserted in `src/lib/ynab-transfers.test.ts`.

## YNAB API behaviour on split transactions (probed live)

Probed on 2026-11-07 with throwaway splits in the €Wise Euro account (created, probed, deleted;
balance verified unchanged).

| Operation | Result |
|---|---|
| `PUT` a new amount on a split | **400** — `the amount or date of an existing split transaction cannot be changed` |
| `PUT` replacement `subtransactions` | **400** — `amount must equal the sum of subtransaction amounts, subtransactions cannot be updated on an existing split transaction` |
| `PUT` a sub-transaction by its own id | **404** — sub-transactions are not addressable as transactions |
| `DELETE` + `POST` with scaled sub-amounts | **201** — works; categories, memo, flag and `cleared` state are carried over |

This is why rmillan cannot convert a split-category transaction: it updates the amount, and the
API refuses. The only route is delete-and-recreate, so Phase 33 has to do that (CONV-06).

Consequences to design around:

- The parent amount must be **the sum of the scaled subs**, never the reverse — the API
  validates the sum, so rounding has to happen on the sub-amounts.
- Recreating the transaction changes its id and drops its `reconciled` flag. Reconciled rows are
  out of scope (CONV-05), so this is contained — but the recreated row must be re-set to
  `cleared` and re-approved.

### Scaling rule for a not-yet-converted split

**Every sub is scaled by the same rate — including fee-type subs. No sub stays in EUR.**

A split is a *category allocation of one transaction*, not a basket of transactions in different
currencies. The €Wise Euro account holds one EUR amount that YNAB shows in a GBP budget; converting
the transaction means converting that amount, and each sub is a slice of it. Leaving one sub in EUR
would mean the split no longer adds up to what Wise actually took, and the "fee" would be a figure
from a different currency than the rest of the row.

The historical data confirms this: the `Banking Fees` sub in the converted "-3,000 EUR → -2,507.01"
rows is already in GBP. There is no precedent for a mixed-currency split, and no reason to invent one.

Implementation consequences:

- The parent amount is the **sum of the scaled subs**, not the reverse — the API validates the sum.
- Rounding is absorbed by the sub-amounts (largest-remainder: scale all, then hand the leftover
  milliunits to the sub with the largest fractional remainder). The parent is never adjusted to hide
  a rounding error, because then the API rejects it.
- A sub that would round to zero is left at zero rather than dropped — dropping it would change the
  category structure the admin set up.

Of the 43 splits in the account, 13 have no conversion marker; 11 of those are reconciled and
excluded by CONV-05. The two that Phase 33 would touch are the €9.99 Google Photos splits
(2–3 sub-transactions each).

## Rate accuracy

Frankfurter (`api.frankfurter.app` now redirects to `api.frankfurter.dev/v1`; `fetch` follows
it) is the mid-market rate and matches Wise's own mid-market rate to 5 dp — e.g. 2026-07-30:
Frankfurter 0.85715, Wise 0.85720.

Wise's actual conversion rates split into two classes:

| Class | Example | Actual vs mid-market |
|---|---|---|
| Standing-order conversions (round EUR amounts, internal balance conversion) | 5,000 EUR → 4,260.31 GBP on 2026-07-30 | 0.60% **below** mid-market — converting at mid-market would give 4,285.75, i.e. £25.44 too much |
| Leftover-balance conversions (converted before being paid out) | 3,980.38 → 3,434.27 EUR on 2026-06-23 | within 0.1% of mid-market |

CONV-07 requires the preview to show the rate being applied so this is visible and overridable.

## Relationship to the EUR→GBP Transfers tool

Two different operations on two different kinds of row in the same account:

- **Transfers tool** — a conversion of a *balance* (EUR left the €Wise Euro account, GBP arrived
  in the Wise GBP or UK Current account). The EUR row is deleted and a YNAB transfer counterpart
  is created, so the movement is not counted twice.
- **Converter** — a conversion of a *transaction* (a spend in the €Wise Euro account). The row's
  amount is rewritten to its GBP equivalent; the row itself stays.

They compose safely in either order: a conversion-pair row that the converter touches first
carries the FX marker, so the transfers tool can still recover the EUR input and pair it
correctly; a row the transfers tool pairs first becomes a transfer and is excluded from
conversion. The planned order is transfers first, then conversion (Phase 34's 3-step workflow).

The recommendation is one **scan** (classify every row in the €Wise Euro account once) with two
apply actions, rather than one merged mutation — the two operations have different risk profiles
and different undo semantics.
