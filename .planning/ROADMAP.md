# Amazon to YNAB Automation — Roadmap

**Created:** 2026-03-23
**Status:** Draft
**Granularity:** Coarse (3 phases)

## Project Goal

A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

---

## Phases

- [ ] **Phase 1: Scaffold & Deploy** — Next.js app running on Railway with database and secrets configured
- [ ] **Phase 2: Email Inflow** — Postmark webhooks received, deduplicated, and sender detected
- [ ] **Phase 3: Parse & Create** — Claude extracts data; transactions created in correct YNAB accounts

---

## Phase Details

### Phase 1: Scaffold & Deploy

**Goal:** Next.js app is deployed on Railway with PostgreSQL provisioned and all secrets configured; the webhook endpoint is ready to receive requests.

**Depends on:** Nothing (first phase)

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04

**Success Criteria** (what must be TRUE when complete):
1. Next.js app is deployed and running on Railway (accessible via HTTPS)
2. PostgreSQL database is created and accessible to the app
3. All three secret keys (Claude API, YNAB token, Postmark token) are stored as Railway environment variables
4. Postmark inbound email address is configured and points to the app's `/api/webhook` endpoint
5. Webhook endpoint returns 200 OK when called with a test payload

**Plans:** TBD

---

### Phase 2: Email Inflow

**Goal:** Emails from Postmark are received reliably, deduplicated using message ID tracking, and the original sender (Manuel or Emily-Kate) is identified for account routing.

**Depends on:** Phase 1 (infrastructure must be in place)

**Requirements:** EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04

**Success Criteria** (what must be TRUE when complete):
1. App receives Postmark webhook payloads and logs them without errors
2. Duplicate emails (same Postmark message ID) are rejected and logged
3. Original sender email address is extracted from forwarded message headers
4. Non-Amazon emails are silently ignored (no transaction, no error)
5. Webhook consistently returns 200 OK after processing each email

**Plans:** TBD

---

### Phase 3: Parse & Create

**Goal:** Email content is parsed with Claude to extract amount and item description; transactions are created in the correct YNAB account (Manuel's or Emily-Kate's) with proper memo, payee, and amount.

**Depends on:** Phase 2 (sender identification) + Phase 1 (infrastructure)

**Requirements:** PARSE-01, PARSE-02, PARSE-03, YNAB-01, YNAB-02, YNAB-03, YNAB-04, YNAB-05, YNAB-06

**Success Criteria** (what must be TRUE when complete):
1. Claude API extracts order amount from Amazon email and returns a numeric value
2. Claude API extracts item description and handles multi-item orders with a summary
3. Transaction is created in Manuel's YNAB account when sender is Manuel
4. Transaction is created in Emily-Kate's YNAB account when sender is Emily-Kate
5. Transaction memo reads as "{Sender Name} — {Item Description}" (e.g., "Manuel — AirPods case")
6. Transaction payee is "Amazon" and amount is negative (outflow)
7. Transaction is created uncategorized (no category assigned)

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold & Deploy | 0/? | Not started | — |
| 2. Email Inflow | 0/? | Not started | — |
| 3. Parse & Create | 0/? | Not started | — |

---

## Coverage

**Total v1 requirements:** 17
**Mapped to phases:** 17
**Unmapped:** 0

**Requirement mapping:**
- Phase 1: INFRA-01, INFRA-02, INFRA-03, INFRA-04 (4 requirements)
- Phase 2: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04 (4 requirements)
- Phase 3: PARSE-01, PARSE-02, PARSE-03, YNAB-01, YNAB-02, YNAB-03, YNAB-04, YNAB-05, YNAB-06 (9 requirements)

✓ All v1 requirements mapped
✓ No orphaned requirements
