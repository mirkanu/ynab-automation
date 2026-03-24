# Amazon to YNAB Automation — Roadmap

**Created:** 2026-03-23
**Status:** Draft
**Granularity:** Coarse (3 phases)

## Project Goal

A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

---

## Phases

- [x] **Phase 1: Scaffold & Deploy** — Next.js app running on Railway with database and secrets configured
- [x] **Phase 2: Email Inflow** — Pipedream webhooks received, deduplicated, and sender detected
- [x] **Phase 3: Parse & Create** — Claude extracts data; transactions created in correct YNAB accounts
- [x] **Phase 4: Error Notification** — Unknown sender, parse failure, and YNAB errors notify Manuel
- [ ] **Phase 5: Retailer Support** — Any order confirmation email processed; retailer name used as payee
- [ ] **Phase 6: Category Tagging** — First-line category hint looked up in YNAB and assigned if matched

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

**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js app with webhook stub, Prisma schema, and Railway config
- [x] 01-02-PLAN.md — Deploy to Railway, provision PostgreSQL, configure secrets and Pipedream inbound email

---

### Phase 2: Email Inflow

**Goal:** Emails from Pipedream are received reliably, deduplicated using message ID tracking, and the original sender (Manuel or Emily-Kate) is identified for account routing.

**Depends on:** Phase 1 (infrastructure must be in place)

**Requirements:** EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04

**Success Criteria** (what must be TRUE when complete):
1. App receives Pipedream webhook payloads and logs them without errors
2. Duplicate emails (same message ID) are rejected silently with 200 OK
3. Original sender email address is extracted from forwarded message headers
4. Non-Amazon emails are silently ignored (no transaction, no error)
5. Webhook consistently returns 200 OK after processing each email

**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Capture real Pipedream payload from Railway logs and document envelope shape
- [x] 02-02-PLAN.md — Implement webhook handler with dedup, sender extraction, and Amazon filter

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

**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — Discover YNAB budget/account IDs via API and set Railway env vars (includes Emily-Kate email)
- [x] 03-02-PLAN.md — Create Claude parsing lib and YNAB client lib with unit tests
- [ ] 03-03-PLAN.md — Wire libs into webhook handler and run end-to-end smoke test

---

### Phase 4: Error Notification

**Goal:** Any email that cannot be processed — unknown sender, non-Amazon content, parse failure, or YNAB API error — triggers a notification to Manuel via Telegram or email so nothing silently disappears.

**Depends on:** Phase 3 (processing pipeline must exist to know what can fail)

**Requirements:** ERR-01, ERR-02, ERR-03, ERR-04

**Success Criteria** (what must be TRUE when complete):
1. An email from an unknown sender (not Manuel or Emily-Kate) triggers a notification to Manuel
2. An email that passes Amazon detection but fails Claude parsing triggers a notification
3. A YNAB API error (transaction creation failure) triggers a notification
4. A non-Amazon email that reaches the handler triggers a notification (or is silently dropped — TBD)
5. Happy-path emails produce no notification noise

**Plans:** TBD

---

### Phase 5: Retailer Support

**Goal:** Any forwarded order confirmation email is processed regardless of retailer; Claude extracts the retailer name and uses it as the YNAB payee instead of the hardcoded "Amazon".

**Depends on:** Phase 4 (full v1 pipeline complete)

**Requirements:** RETAIL-01, RETAIL-02, RETAIL-03

**Success Criteria** (what must be TRUE when complete):
1. Forwarding an Amazon order confirmation creates a transaction with payee "Amazon"
2. Forwarding a non-Amazon order confirmation (e.g. Costco, Apple) creates a transaction with the correct retailer name as payee
3. A forwarded email that Claude cannot parse as any order confirmation triggers a notification to Manuel
4. A forwarded email that has no identifiable amount or description produces no transaction and no silent failure

**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md — Update claude.ts (ParsedOrder + retailer field) and ynab.ts (dynamic payeeName) with tests
- [ ] 05-02-PLAN.md — Wire retailer through webhook handler; remove Amazon filter; human verify end-to-end

---

### Phase 6: Category Tagging

**Goal:** Users can optionally type a YNAB category name on the first line of a forwarded email; the app looks it up, fuzzy-matches it against the YNAB category list, and assigns it to the transaction if found.

**Depends on:** Phase 5 (retailer support; consistent parse pipeline must be in place)

**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04

**Success Criteria** (what must be TRUE when complete):
1. Typing a valid YNAB category name on the first line of a forwarded email assigns that category to the created transaction
2. Category matching is case-insensitive and works for partial name matches (e.g. "groceries" matches "Groceries & Dining")
3. Forwarding an email with no first-line text creates an uncategorized transaction (existing behaviour unchanged)
4. Typing a category name that has no match in YNAB creates an uncategorized transaction with no error notification

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold & Deploy | 2/2 | Complete | 2026-03-24 |
| 2. Email Inflow | 2/2 | Complete | 2026-03-24 |
| 3. Parse & Create | 3/3 | Complete | 2026-03-24 |
| 4. Error Notification | 2/2 | Complete | 2026-03-24 |
| 5. Retailer Support | 0/2 | Not started | - |
| 6. Category Tagging | 0/? | Not started | - |

---

## Coverage

**Total v1 requirements:** 21
**Mapped to phases:** 21
**Unmapped:** 0

**Requirement mapping:**
- Phase 1: INFRA-01, INFRA-02, INFRA-03, INFRA-04 (4 requirements)
- Phase 2: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04 (4 requirements)
- Phase 3: PARSE-01, PARSE-02, PARSE-03, YNAB-01, YNAB-02, YNAB-03, YNAB-04, YNAB-05, YNAB-06 (9 requirements)
- Phase 4: ERR-01, ERR-02, ERR-03, ERR-04 (4 requirements — v1 complete)
- Phase 5: RETAIL-01, RETAIL-02, RETAIL-03 (3 requirements — v2.0)
- Phase 6: CAT-01, CAT-02, CAT-03, CAT-04 (4 requirements — v2.0)

✓ All v1 requirements mapped
✓ All v2.0 requirements mapped
✓ No orphaned requirements
