# Requirements: YNAB Automation — v6.1 README & Onboarding Polish

**Defined:** 2026-04-16
**Core Value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.

## v1 Requirements

Requirements for v6.1 milestone.

### README Content

- [ ] **README-01**: README opening explains the specific problem: YNAB auto-categorizes by payee, but multi-category payees (e.g. Amazon) require manually cross-referencing email receipts — this tool eliminates that manual lookup
- [ ] **README-02**: Deploy button opens in a new browser tab (target="_blank")
- [ ] **README-03**: Install section covers only: click deploy → wait for green check → find your URL → open it → set password (wizard handles the rest)
- [ ] **README-04**: Remove verbose per-step wizard instructions (Steps 2-9) — wizard UI is self-explanatory
- [ ] **README-05**: Simplify domain discovery instruction — domain is auto-generated, user just needs to know where Railway shows it

## v2 Requirements

Deferred to future release.

### Smart Categorization

- **SMART-01**: Auto-categorize transactions based on email content (e.g. Amazon purchase of "kitchen supplies" → Household category)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full wizard documentation in README | Wizard UI is self-explanatory; duplicating it in README adds maintenance burden |
| Railway API integration for URL surfacing | Railway doesn't expose a post-deploy redirect or notification API |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| README-01 | Phase 26 | Pending |
| README-02 | Phase 26 | Pending |
| README-03 | Phase 26 | Pending |
| README-04 | Phase 26 | Pending |
| README-05 | Phase 26 | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after initial definition*
