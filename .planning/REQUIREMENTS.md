# Requirements: Amazon to YNAB Automation

**Defined:** 2026-03-23
**Core Value:** A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Next.js app is deployed and running on Railway
- [ ] **INFRA-02**: PostgreSQL database is provisioned on Railway for dedup tracking
- [ ] **INFRA-03**: All secrets (Claude API key, YNAB token, Postmark token) are stored as Railway environment variables
- [ ] **INFRA-04**: Postmark inbound email address is configured to route to the app's webhook endpoint

### Email Ingestion

- [ ] **EMAIL-01**: App receives inbound email webhook from Postmark and responds with 200 OK
- [ ] **EMAIL-02**: App rejects duplicate emails by checking Postmark message ID against PostgreSQL
- [ ] **EMAIL-03**: App extracts the original sender's email address from the forwarded message to identify Manuel or Emily-Kate
- [ ] **EMAIL-04**: App ignores non-Amazon emails gracefully (no error, no transaction created)

### Parsing

- [ ] **PARSE-01**: Claude API extracts the total order amount from the Amazon email body
- [ ] **PARSE-02**: Claude API extracts a brief, human-readable item description from the email body
- [ ] **PARSE-03**: Parser handles multi-item orders by summarizing into one description

### YNAB Integration

- [ ] **YNAB-01**: App creates a YNAB transaction in Manuel's account when the sender is Manuel
- [ ] **YNAB-02**: App creates a YNAB transaction in Emily-Kate's account when the sender is Emily-Kate
- [ ] **YNAB-03**: Transaction memo contains the sender's name and item description (e.g. "Manuel — AirPods case")
- [ ] **YNAB-04**: Transaction is created with the correct amount (negative outflow)
- [ ] **YNAB-05**: Transaction payee is set to "Amazon"
- [ ] **YNAB-06**: Transaction is created uncategorized (no category assigned)

## v2 Requirements

### Automation

- **AUTO-01**: App captures Amazon confirmation emails directly without manual forwarding (e.g. via Gmail filter + push)
- **AUTO-02**: App monitors a mailbox automatically so no forwarding is needed

### Categorization

- **CAT-01**: Claude reads existing YNAB categories and suggests the most appropriate category for each transaction
- **CAT-02**: Users can confirm or override Claude's category suggestion before transaction is created

### Receipts

- **RCPT-01**: Transaction is created with the Amazon order confirmation attached as a note or linked document

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI / dashboard | This is a background automation tool; no UI needed in v1 |
| Multi-budget support | Single YNAB budget; routing is by account within one budget |
| Email parsing without Claude | Claude handles variance in Amazon email formats cleanly; no regex approach |
| Notifications on success/failure | Nice to have but not blocking; add in v2 if missing transactions become a problem |
| Non-Amazon order emails | Only Amazon confirmation emails are in scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| EMAIL-01 | — | Pending |
| EMAIL-02 | — | Pending |
| EMAIL-03 | — | Pending |
| EMAIL-04 | — | Pending |
| PARSE-01 | — | Pending |
| PARSE-02 | — | Pending |
| PARSE-03 | — | Pending |
| YNAB-01 | — | Pending |
| YNAB-02 | — | Pending |
| YNAB-03 | — | Pending |
| YNAB-04 | — | Pending |
| YNAB-05 | — | Pending |
| YNAB-06 | — | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️ (to be mapped during roadmap creation)

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after initial definition*
