# Requirements: YNAB Automation — v6.4 Currency Tools & UI Consolidation

**Defined:** 2026-05-30
**Core Value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.

## v1 Requirements

Requirements for v6.4 milestone.

### Navigation Restructure

- [ ] **NAV-03**: Admin can navigate to an Email Automation section containing sub-pages: Activity Log, Rules, and Test & Replay (current top-level "Logs" and "Rules" fold into this section)
- [ ] **NAV-04**: Admin can navigate to a Currency section containing sub-pages: EUR→GBP Transfers, EUR Conversion, and EUR Reconciliation

### Dashboard

- [ ] **DASH-03**: Dashboard Email Automation panel shows last email processed timestamp, success rate, and last YNAB transaction created
- [ ] **DASH-04**: Dashboard Currency panel shows last transfer-fix run (date + pairs fixed), last EUR conversion run (date + transactions converted), and last reconciliation (date + gap amount)

### EUR Conversion

- [ ] **CONV-01**: Admin can view all unreconciled, unconverted EUR transactions in the €Wise Euro YNAB account (transactions with no conversion memo marker and not yet reconciled)
- [ ] **CONV-02**: Each pending transaction displays the historical EUR→GBP rate for its date, fetched from the Frankfurter API
- [ ] **CONV-03**: Admin can preview the full set of pending conversions before applying — table shows date, payee, EUR amount, rate, and GBP result
- [ ] **CONV-04**: Admin can bulk-apply all conversions — YNAB transactions are updated with GBP amount and memo is appended with `EUR X.XX @ Y.YYYY`
- [ ] **CONV-05**: Already-reconciled transactions are excluded from conversion detection and cannot be modified by the converter

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
| DASH-03 | Phase 32 | Pending |
| DASH-04 | Phase 32 | Pending |
| CONV-01 | Phase 33 | Pending |
| CONV-02 | Phase 33 | Pending |
| CONV-03 | Phase 33 | Pending |
| CONV-04 | Phase 33 | Pending |
| CONV-05 | Phase 33 | Pending |
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
