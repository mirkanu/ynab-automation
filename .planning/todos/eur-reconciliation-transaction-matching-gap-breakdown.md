---
title: EUR Reconciliation — transaction matching pre-flight and split gap postings
type: future-phase
captured: 2026-11-07
---

An enhancement to the EUR Wise reconciliation tool was researched, reviewed and verified on
2026-06-06 under the phase number **33** — which was later reused by the v6.4 roadmap for the
EUR Multi-Currency Converter. Its artefacts are kept (local, gitignored) in
`.planning/phases/orphaned-eur-reconciliation-transaction-matching-gap-breakdown/`
(`33-RESEARCH.md`, `33-REVIEW.md`, `33-VALIDATION.md`, `33-VERIFICATION.md`).

**What it proposed** — the reconciliation tool (`src/lib/ynab-eur-reconciliation.ts`,
`ReconcileEurWiseCard`) currently computes one GBP gap and posts one combined "Wise Interest"
transaction. The June work proposed:

1. A **transaction-matching pre-flight** — match Wise statement transactions against the YNAB
   rows before reconciling, and show a *directional* breakdown of anything unmatched (expected in
   Wise but missing from YNAB vs. present in YNAB but not in the memos). Not implemented: no
   `txnMatchStatus` anywhere in `src/`.
2. **Splitting the gap into two adjustment transactions** — one for Wise interest, one for
   "Currency Fluctuation" (the payee id must be resolved or created at apply time). Not
   implemented: `applyReconciliation` still posts a single combined transaction.
3. **Removing the hard block on negative gaps.** Partly delivered: the FX/interest breakdown and
   the explained-% band exist (quick tasks 260711-erc / 260711-h4n), so a negative gap can be
   explained rather than merely rejected.

**Why it is not on the roadmap:** it was planned under a phase number that the v6.4 roadmap
reassigned, and it never made it into a milestone roadmap as written.

**Next step if wanted:** give it a fresh phase number in a future milestone and re-read the
research doc before planning — the live-data assumptions in it (Wise statement API unavailable
without SCA, memo parsing regexes) are from June 2026 and should be re-verified.
