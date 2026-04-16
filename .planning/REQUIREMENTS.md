# Requirements: YNAB Automation — v6.2 Settings & UX Polish

**Defined:** 2026-04-16
**Core Value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.

## v1 Requirements

Requirements for v6.2 milestone.

### UI Labels

- [x] **LABEL-01**: Wizard step 3 and setup/done page use generic wording ("transactions") instead of "Amazon transactions"

### Settings Restructure

- [ ] **NAV-01**: Settings page split into two nav items: "Rules" (sender routing, currency routing) and "Settings" (API keys, YNAB connection, admin password)
- [ ] **NAV-02**: Test Mode toggle moved from Settings to Tools page

### Forwarding Address Visibility

- [ ] **FWD-01**: Dashboard shows the inbound email/forwarding address prominently — first thing the user sees, not buried in a card below stats
- [ ] **FWD-02**: Wizard done page clearly highlights the forwarding address with copy-to-clipboard and explains what to do with it

## v2 Requirements

Deferred to future release.

### Smart Categorization

- **SMART-01**: Auto-categorize transactions based on email content (e.g. Amazon purchase of "kitchen supplies" → Household category)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Settings redesign / component library | Polish only — keep existing inline styles |
| New dashboard widgets | Focus is on forwarding address prominence, not new features |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LABEL-01 | Phase 27 | Complete |
| NAV-01 | Phase 27 | Pending |
| NAV-02 | Phase 27 | Pending |
| FWD-01 | Phase 28 | Pending |
| FWD-02 | Phase 28 | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after v6.2 roadmap creation (Phases 27-28)*
