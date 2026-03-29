# Requirements: Amazon to YNAB Automation

**Defined:** 2026-03-28
**Core Value:** Forwarded order confirmation email → YNAB transaction, fully automated — for any user, with zero technical setup

## v5.0 Requirements

Requirements for multi-tenant SaaS milestone. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign up with email magic link (passwordless)
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can log out

### YNAB Integration

- [ ] **YNAB-01**: User can connect YNAB account via OAuth (Authorization Code Grant)
- [ ] **YNAB-02**: YNAB OAuth tokens are encrypted at rest (AES-256-GCM)
- [ ] **YNAB-03**: YNAB tokens auto-refresh before expiry
- [ ] **YNAB-04**: User can disconnect YNAB account (revokes tokens)
- [ ] **YNAB-05**: User can select default YNAB budget and account after connecting

### Email Routing

- [ ] **EMAIL-01**: User receives a unique forwarding email address upon signup
- [ ] **EMAIL-02**: Forwarded emails are routed to the correct user via inbound email service
- [ ] **EMAIL-03**: Inbound webhook verifies signature to prevent forged emails
- [ ] **EMAIL-04**: Duplicate webhook deliveries are deduplicated (idempotency)
- [ ] **EMAIL-05**: Forwarded email is parsed and creates YNAB transaction in the user's connected account

### Multi-Tenant Data

- [x] **DATA-01**: All database tables are scoped by user_id
- [x] **DATA-02**: Existing single-user data is migrated to user #1 (Manuel)
- [ ] **DATA-03**: Row-Level Security policies enforce tenant isolation at DB level
- [ ] **DATA-04**: No user can access another user's data through any API endpoint

### Dashboard & Self-Service

- [ ] **DASH-01**: User can view their activity log (processed emails, outcomes, errors)
- [ ] **DASH-02**: User can view their dashboard with stats (success rate, last transaction, total processed)
- [ ] **DASH-03**: User can edit their settings (sender routing, currency accounts)
- [ ] **DASH-04**: User can toggle test mode (process emails without YNAB writes)
- [ ] **DASH-05**: User can see email parse transparency (Claude's reasoning for each parse)

### Onboarding & Account Management

- [ ] **ONBD-01**: New user is guided through signup → connect YNAB → get forwarding address
- [ ] **ONBD-02**: User sees provider-specific email forwarding instructions (Gmail, Outlook, etc.)
- [ ] **ONBD-03**: User can delete their account and all associated data (GDPR)
- [ ] **ONBD-04**: Homepage/landing page explains the product and has signup CTA

## v5.1+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Smart Categorization

- **CAT-01**: System learns from YNAB re-categorizations and auto-applies learned categories
- **CAT-02**: System detects account corrections and adjusts routing rules

### Richer Parsing

- **PARSE-01**: Multi-item orders create YNAB split transactions
- **PARSE-02**: Subscription charges are auto-detected and flagged as recurring
- **PARSE-03**: Refund emails create inflow YNAB transactions

### Notifications

- **NOTIF-01**: Daily digest email summarizing processed transactions
- **NOTIF-02**: Missing transaction alerts (no emails in X days)

### Billing

- **BILL-01**: Stripe subscription integration with tiered plans
- **BILL-02**: Usage tracking and billing dashboard

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Google OAuth login | Magic links sufficient for beta; add OAuth provider later if users request |
| Custom rules engine | Scope creep; defer until user demand clarified |
| Slack/Telegram notifications | Email sufficient for beta |
| Team/workspace sharing | Complex permission model; one user = one account for v5.0 |
| Custom domain per user | Enterprise feature; defer |
| Direct bank integrations | Email-based approach works; different product category |
| Receipt photo parsing | Different input modality; defer |
| Mobile app | Web-first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 16 | Complete |
| AUTH-02 | Phase 16 | Complete |
| AUTH-03 | Phase 16 | Complete |
| DATA-01 | Phase 16 | Complete |
| DATA-02 | Phase 16 | Complete |
| DATA-03 | Phase 16 | Pending |
| DATA-04 | Phase 16 | Pending |
| YNAB-01 | Phase 17 | Pending |
| YNAB-02 | Phase 17 | Pending |
| YNAB-03 | Phase 17 | Pending |
| YNAB-04 | Phase 17 | Pending |
| YNAB-05 | Phase 17 | Pending |
| EMAIL-01 | Phase 18 | Pending |
| EMAIL-02 | Phase 18 | Pending |
| EMAIL-03 | Phase 18 | Pending |
| EMAIL-04 | Phase 18 | Pending |
| EMAIL-05 | Phase 18 | Pending |
| DASH-01 | Phase 19 | Pending |
| DASH-02 | Phase 19 | Pending |
| DASH-03 | Phase 19 | Pending |
| DASH-04 | Phase 19 | Pending |
| DASH-05 | Phase 19 | Pending |
| ONBD-01 | Phase 19 | Pending |
| ONBD-02 | Phase 19 | Pending |
| ONBD-03 | Phase 19 | Pending |
| ONBD-04 | Phase 19 | Pending |

**Coverage:**
- v5.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 — traceability filled after roadmap creation*
