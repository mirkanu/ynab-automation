# Requirements: YNAB Automation — v6.4 Currency Tools & UI Consolidation

**Defined:** 2026-05-30
**Core Value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.

## v1 Requirements

Requirements for v6.4 milestone.

### Navigation Restructure

- [ ] **NAV-03**: Admin can navigate to an Email Automation section containing sub-pages: Activity Log, Rules, and Test & Replay (current top-level "Logs" and "Rules" fold into this section)
- [ ] **NAV-04**: Admin can navigate to a Currency section containing sub-pages: EUR→GBP Transfers, EUR Conversion, and EUR Reconciliation

### Dashboard

- [x] **DASH-03**: Dashboard Email Automation panel shows last email processed timestamp, success rate, and last YNAB transaction created
- [x] **DASH-04**: Dashboard Currency panel shows last transfer-fix run (date + pairs fixed), last EUR conversion run (date + transactions converted), and last reconciliation (date + gap amount)

### EUR Conversion

Reference implementation: `https://ynab.rmillan.com/` (Multi-Currency for YNAB) — the third-party tool this feature replaces. It is closed source, so the reference is its *observable behaviour* (memo conventions, skip semantics), recorded in `.planning/phases/33-eur-reconciliation-transaction-matching-gap-breakdown/33-CONVERTER-NOTES.md`. See also CONV-06 and CONV-07.

- [ ] **CONV-01**: Admin can view all unreconciled, unconverted EUR transactions in the €Wise Euro YNAB account (transactions with no conversion memo marker and not yet reconciled). "Has a conversion marker" means any of the legacy dialects already in the budget: `EUR (FX rate: …)` (third-party converter and our own pair rows), `€X` (third-party converter's split-row marker), `(skipped)`, or `using GSDlabs`. A transaction that carries any of these must never be offered for conversion — the account already holds 549 such rows, and re-converting them would rewrite settled history
- [ ] **CONV-02**: Each pending transaction displays the historical EUR→GBP rate for its date, fetched from the Frankfurter API
- [ ] **CONV-03**: Admin can preview the full set of pending conversions before applying — table shows date, payee, EUR amount, rate, and GBP result
- [ ] **CONV-04**: Admin can bulk-apply all conversions — YNAB transactions are updated with GBP amount and memo is appended in the canonical format `-X EUR (FX rate: Y.YYYY) · Converted X EUR to Y GBP using GSDlabs` (the EUR figure negative, the FX marker retained so the rate used is always recoverable). The `EUR X.XX @ Y.YYYY` format originally planned here is not used: it is a third dialect nobody else recognises
- [ ] **CONV-05**: Already-reconciled transactions are excluded from conversion detection and cannot be modified by the converter
- [ ] **CONV-06**: Split-category transactions can be converted. The YNAB API rejects an amount change on a split transaction (`the amount or date of an existing split transaction cannot be changed`) and rejects replacing its sub-transactions, so a split is converted by deleting and recreating it with proportionally scaled sub-amounts, carrying over date, payee, memo, category assignments, flag and `cleared` state. The parent amount is the sum of the scaled sub-amounts, never the other way round
- [ ] **CONV-07**: The converted GBP amount uses a rate the admin can see and override. Frankfurter is the mid-market rate; Wise's actual internal EUR→GBP conversions have run ~0.5% below it, so the preview must show which rate is being applied

### Currency Workflow

- [ ] **WKFL-01**: Currency section displays a numbered 3-step workflow (1. EUR→GBP Transfers → 2. EUR Conversion → 3. EUR Reconciliation) with last-run status indicators for each step
- [ ] **WKFL-02**: EUR Reconciliation tool runs a pre-flight check before allowing reconciliation and warns (with unconverted transaction count and link to EUR Conversion) if any cleared unreconciled transactions lack a conversion memo
- [ ] **WKFL-03**: Admin can override the pre-flight warning and proceed with reconciliation anyway

## Future Requirements

### Automation

- **AUTO-01**: Scheduled nightly conversion run (no manual trigger needed) — deferred; manual preview sufficient for household volume
- **AUTO-02**: Non-EUR currency support (CHF, USD) — deferred; only EUR accounts in use currently

## Out of Scope

| Feature | Reason |
|---------|--------|
| Non-EUR currencies (CHF, USD) | Only EUR accounts are active; complexity not justified |
| Automatic daily sync | Manual trigger with preview is the right default for financial ops |
| Crypto currency support | No crypto accounts in YNAB |
| Separate currency conversion API key | Frankfurter is free and keyless |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-03 | Phase 31 | Pending |
| NAV-04 | Phase 31 | Pending |
| DASH-03 | Phase 32 | Complete |
| DASH-04 | Phase 32 | Complete |
| CONV-01 | Phase 33 | Pending |
| CONV-02 | Phase 33 | Pending |
| CONV-03 | Phase 33 | Pending |
| CONV-04 | Phase 33 | Pending |
| CONV-05 | Phase 33 | Pending |
| CONV-06 | Phase 33 | Pending |
| CONV-07 | Phase 33 | Pending |
| WKFL-01 | Phase 34 | Pending |
| WKFL-02 | Phase 34 | Pending |
| WKFL-03 | Phase 34 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 after milestone v6.4 kickoff*
