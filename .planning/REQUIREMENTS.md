# Requirements: Amazon to YNAB Automation

**Defined:** 2026-03-23
**Updated:** 2026-03-24 (v2.0 added)
**Core Value:** A forwarded order email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

## v1 Requirements (complete)

### Infrastructure

- [x] **INFRA-01**: Next.js app is deployed and running on Railway
- [x] **INFRA-02**: PostgreSQL database is provisioned on Railway for dedup tracking
- [x] **INFRA-03**: All secrets (Claude API key, YNAB token) are stored as Railway environment variables
- [x] **INFRA-04**: Pipedream workflow is configured to POST forwarded emails to the app's webhook endpoint

### Email Ingestion

- [x] **EMAIL-01**: App receives inbound email webhook from Pipedream and responds with 200 OK
- [x] **EMAIL-02**: App rejects duplicate emails by checking message ID against PostgreSQL
- [x] **EMAIL-03**: App extracts the original sender's email address from the forwarded message to identify Manuel or Emily-Kate
- [x] **EMAIL-04**: App ignores non-Amazon emails gracefully (no error, no transaction created)

### Parsing

- [x] **PARSE-01**: Claude API extracts the total order amount from the Amazon email body
- [x] **PARSE-02**: Claude API extracts a brief, human-readable item description from the email body
- [x] **PARSE-03**: Parser handles multi-item orders by summarizing into one description

### YNAB Integration

- [x] **YNAB-01**: App creates a YNAB transaction in Manuel's account when the sender is Manuel
- [x] **YNAB-02**: App creates a YNAB transaction in Emily-Kate's account when the sender is Emily-Kate
- [x] **YNAB-03**: Transaction memo contains the sender's name and item description (e.g. "Manuel — AirPods case")
- [x] **YNAB-04**: Transaction is created with the correct amount (negative outflow)
- [x] **YNAB-05**: Transaction payee is set to "Amazon"
- [x] **YNAB-06**: Transaction is created uncategorized (no category assigned)

### Error Handling

- [x] **ERR-01**: Unknown sender (not Manuel or Emily-Kate) triggers a notification to Manuel
- [x] **ERR-02**: Claude parse failure triggers a notification to Manuel
- [x] **ERR-03**: YNAB API error triggers a notification to Manuel
- [x] **ERR-04**: Notification channel is email via Resend

---

## v2.0 Requirements

### Retailer Support

- [ ] **RETAIL-01**: App processes forwarded order confirmation emails from any retailer, not just Amazon (removes Amazon-only filter)
- [ ] **RETAIL-02**: Claude extracts the retailer/merchant name from the email and uses it as the YNAB payee (replaces hardcoded "Amazon")
- [ ] **RETAIL-03**: If Claude cannot parse a forwarded email as an order confirmation (no amount or description extracted), Manuel is notified

### Category Tagging

- [ ] **CAT-01**: App detects a category name typed on the first line of the forwarded email by the user
- [ ] **CAT-02**: App fetches the YNAB category list for the budget and matches the typed name using fuzzy matching (case-insensitive, partial name match)
- [ ] **CAT-03**: If a matching category is found, the transaction is created with that category assigned
- [ ] **CAT-04**: If no category is typed, or the typed name has no match in YNAB, the transaction is created uncategorized (no notification)

---

## Future Requirements (deferred)

### Automation

- **AUTO-01**: App captures order confirmation emails directly without manual forwarding (e.g. Gmail filter + push)
- **AUTO-02**: App monitors a mailbox automatically so no forwarding is needed

### Receipts

- **RCPT-01**: Transaction is created with the order confirmation attached as a note or linked document

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI / dashboard | Background automation tool; no UI needed |
| Multi-budget support | Single YNAB budget; routing by account within one budget |
| Email parsing without Claude | Claude handles format variance cleanly |
| Multi-budget support | Single household, single budget |
| Category suggestions by Claude | User specifies category explicitly; no AI guessing |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | 1 | Complete |
| INFRA-02 | 1 | Complete |
| INFRA-03 | 1 | Complete |
| INFRA-04 | 1 | Complete |
| EMAIL-01 | 2 | Complete |
| EMAIL-02 | 2 | Complete |
| EMAIL-03 | 2 | Complete |
| EMAIL-04 | 2 | Complete |
| PARSE-01 | 3 | Complete |
| PARSE-02 | 3 | Complete |
| PARSE-03 | 3 | Complete |
| YNAB-01 | 3 | Complete |
| YNAB-02 | 3 | Complete |
| YNAB-03 | 3 | Complete |
| YNAB-04 | 3 | Complete |
| YNAB-05 | 3 | Complete |
| YNAB-06 | 3 | Complete |
| ERR-01 | 4 | Complete |
| ERR-02 | 4 | Complete |
| ERR-03 | 4 | Complete |
| ERR-04 | 4 | Complete |
| RETAIL-01 | 5 | Pending |
| RETAIL-02 | 5 | Pending |
| RETAIL-03 | 5 | Pending |
| CAT-01 | 6 | Pending |
| CAT-02 | 6 | Pending |
| CAT-03 | 6 | Pending |
| CAT-04 | 6 | Pending |

**Coverage:**
- v1 requirements: 21 — all complete
- v2.0 requirements: 7 — mapped to Phase 5 (3) and Phase 6 (4)
- Total unmapped: 0

---

*Requirements defined: 2026-03-23*
*v2.0 requirements added: 2026-03-24*
