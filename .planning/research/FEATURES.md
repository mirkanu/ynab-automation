# Feature Research: Multi-Tenant SaaS Onboarding & Email Automation

**Domain:** Multi-tenant SaaS with OAuth integration, per-user email routing, and self-service dashboards
**Researched:** 2026-03-28
**Confidence:** HIGH (multi-source, industry standard patterns)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete for a multi-tenant SaaS.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User signup & login | Every SaaS requires authentication; users won't use a shared account | MEDIUM | Auth.js with magic links + Google OAuth (passwordless, friction-minimized) |
| Per-user data isolation | Users expect their data private/separate from other users | MEDIUM | Row-level security via `user_id` on all tables; shared DB schema |
| YNAB account connection via OAuth | Users expect OAuth, not manual token entry; token security expected | MEDIUM | YNAB Authorization Code Grant flow; refresh token rotation; AES-256 encryption at rest |
| Unique forwarding email address per user | Core value prop: each user gets their own address to forward to | HIGH | Postmark/SendGrid inbound + database mapping per user; MX record routing to webhook |
| Dashboard showing activity | Users expect to see what's happening (transactions processed, errors, etc.) | MEDIUM | Activity log with end-to-end email tracing; transaction details (payee, category, account) |
| Account settings & preferences | Standard SaaS UX; users expect to manage their config without code | MEDIUM | Settings editor UI; DB-backed (no restart needed); encryption for sensitive data |
| Error notifications | Users expect to know when something breaks | LOW | Email alerts (via Resend) when transaction fails; matches existing pattern |
| Account deletion (GDPR) | Legal requirement in most markets; users expect self-service option | MEDIUM | Hard delete of user + all associated data; 30-day email retention before purge |

### Differentiators (Competitive Advantage)

Features that set the product apart in the receipt automation space. These align with the core value of "zero setup, maximum automation."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One-step onboarding (signup → connect YNAB → forwarding address → done) | Eliminates friction; users experience value in <5 minutes | MEDIUM | Guided flow; skip unnecessary steps; immediate address assignment; optional test mode intro |
| Inline test mode (preview parsed transaction before sending to YNAB) | Reduces fear of breaking YNAB; power user validation | MEDIUM | Parse email → show structured output → replay/edit → confirm; already built (v4.0) |
| Email parse transparency (show Claude's reasoning) | Builds user confidence in automation; debugging aid | MEDIUM | Show retailer detection, amount, category inference logic; add "why?" explanations |
| Auto-category suggestion based on retailer | Reduces manual categorization; learns from user patterns | HIGH | Post-MVP differentiator; requires user feedback + training data |
| Smart YNAB account routing (multi-currency, multi-account awareness) | Handles complex YNAB setups without user config | MEDIUM | Map forwarded account to YNAB account automatically; currency detection from email |
| Replay & re-run transactions | Recover from errors without re-forwarding; test configuration changes | MEDIUM | Store parsed transaction state; allow edit-in-place + re-execute; already built (v4.0) |
| Activity log with YNAB account names & category names | Human-readable logging without extra API calls on view | LOW | Store account/category names at log time; already implemented (v4.0) |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create complexity or distraction from core value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time sync of all YNAB data to user dashboard | "Users want live budget data" | Massive API overhead; YNAB rate limits; low value for a forwarding service | Show only transaction log + forwarding address status; link to YNAB for budget details |
| Custom rules engine (if retailer = X, force category Y) | Power users want programmatic control | Feature creep; UI complexity; maintenance burden | Defer to v2; start with simple suggestion → user confirms flow |
| Multi-user workspace (team access to same forwarding address) | "Multiple people forward receipts" | Data isolation complexity; permission model explosion; beta doesn't need it | Defer; one user = one address for v5.0; revisit with user feedback |
| Billing/subscription tiers in beta | "Want to monetize early" | Adds auth complexity, feature gates, churn tracking; premature for validation phase | Defer; keep free-only until product-market fit confirmed; data model has `plan` field ready |
| Telegram/Slack notifications as alternative to email | "Users prefer chat apps" | Fragmented notification surface; OAuth for each service; lower priority than getting core right | Use email (Resend already integrated); defer integrations to v2 |
| Custom domain forwarding (user's own domain instead of shared) | "Power users want branded addresses" | DNS/MX complexity; support burden; rare for beta users | Defer to enterprise tier; use `user@ynab-automation.com` pattern for beta |
| Split transaction support | "Some receipts are multi-item" | High complexity with YNAB API limitations; rare use case | Defer; users can split in YNAB manually or forward as separate items |
| Refund tracking (tag reversals automatically) | "Need to match refunds to original purchases" | Requires deduplication across forward + refund emails; complex logic | Defer; user feedback phase will clarify if needed |

## Feature Dependencies

```
[User Signup via Auth.js]
    └──requires──> [Magic Link Email Provider (Resend)]
    └──requires──> [User DB Schema]

[Per-User Data Isolation]
    └──requires──> [Multi-Tenant DB Model (user_id scoping)]
    └──requires──> [User Signup]

[YNAB OAuth Connection]
    └──requires──> [OAuth Token Storage (encrypted)]
    └──requires──> [User Signup]
    └──enhances──> [Per-User Data Isolation]

[Per-User Forwarding Address]
    └──requires──> [Postmark/SendGrid Inbound Setup]
    └──requires──> [User Signup]
    └──requires──> [Database Address ↔ User Mapping]
    └──conflicts──> [Custom Domain Per User (defer)]

[Email Inbound Routing]
    └──requires──> [Per-User Forwarding Address]
    └──requires──> [YNAB OAuth Connection (to validate + process)]
    └──requires──> [Existing Email Parsing Logic (Claude + YNAB)]

[Activity Log]
    └──requires──> [Per-User Data Isolation]
    └──enhances──> [Dashboard]

[Dashboard]
    └──requires──> [Activity Log]
    └──requires──> [User Signup]
    └──requires──> [YNAB Connection Status Display]

[Test Mode (Per-User)]
    └──requires──> [Email Parse Preview Feature]
    └──requires──> [User Dashboard]
    └──requires──> [YNAB OAuth Connection (to test against)]

[Account Settings Editor]
    └──requires──> [User Signup]
    └──enhances──> [Dashboard]

[Account Deletion]
    └──requires──> [User Signup]
    └──requires──> [All Multi-Tenant Tables]
```

### Dependency Notes

- **User Signup requires Magic Link Email Provider:** Auth.js needs Resend configured to send verification emails; can't authenticate without email transport.
- **Per-User Data Isolation requires Multi-Tenant DB Model:** All tables must have `user_id` foreign key + row-level security to prevent data leakage.
- **YNAB OAuth Connection requires encrypted token storage:** Tokens must not live in plaintext; AES-256 encryption with key rotation strategy needed.
- **Per-User Forwarding Address requires Postmark/SendGrid:** Can't create unique addresses without inbound email provider; webhook routing maps address → user_id.
- **Email Inbound Routing requires YNAB OAuth Connection:** Each email processed must verify the user has a valid, non-expired YNAB token before attempting transaction creation.
- **Activity Log enhances Dashboard:** Log data is the dashboard's content; dashboard is primarily a UI for browsing logs + forwarding address + connection status.
- **Test Mode requires Email Parse Preview:** Must show parsed output before sending; requires dry-run of Claude parsing + YNAB API validation.
- **Account Deletion impacts all tables:** Deletion logic must cascade through all user-scoped data; no orphaned records.

## MVP Definition

### Launch With (v5.0 Beta)

Minimum viable product for multi-tenant SaaS launch — what's needed to validate the concept.

- [x] **User signup & login via magic link (Auth.js + Resend)** — Core gating; users can't access their data without this
- [x] **YNAB OAuth connection (Authorization Code Grant)** — Users connect their own YNAB account; no manual tokens
- [x] **Per-user forwarding email address (Postmark/SendGrid inbound)** — Core value prop; each user has unique address
- [x] **Multi-tenant data model (user_id on all tables)** — Foundational; enables isolation + scaling
- [x] **Email inbound routing & processing** — Leverage existing email parsing + YNAB transaction logic
- [x] **Per-user activity log** — Dashboard visibility into what's happening
- [x] **Per-user test mode** — Users can validate before transactions hit YNAB
- [x] **Account settings & preferences** — DB-backed config; users control their setup
- [x] **Account deletion (GDPR)** — Legal + privacy requirement
- [x] **Error notifications via email** — Alert users to failures
- [x] **Onboarding flow** — Guided signup → YNAB connect → forwarding address → ready

### Add After Validation (v5.1–5.3)

Features to add once core is working and user feedback shapes priorities.

- [ ] **Auto-category suggestions** — Defer until seeing user patterns + feedback on categorization friction
- [ ] **Email parse transparency (show Claude reasoning)** — Low effort; high confidence booster; add after core stable
- [ ] **YNAB account auto-routing (currency-aware)** — Valuable for power users; add once we understand user YNAB setups
- [ ] **Custom forwarding rules** — Power user feature; defer until feedback clarifies demand
- [ ] **Slack/Telegram notifications** — Low priority; email sufficient for beta

### Future Consideration (v2+)

Features to defer until product-market fit is established and usage patterns clear.

- [ ] **Billing integration (Stripe)** — Post-beta; monetization; data model ready (`plan` field exists)
- [ ] **Team/workspace sharing** — Multi-user addressing; complex permission model; revisit when target market expands
- [ ] **Refund tracking** — Unclear demand; requires complex deduplication logic
- [ ] **Split transaction support** — Rare use case; YNAB API limitations
- [ ] **Mobile app** — Web-first; mobile users can use responsive web
- [ ] **Custom domain per user** — Enterprise feature; defer to paid tier
- [ ] **Daily digest email** — Nice-to-have; low priority for forwarding service
- [ ] **Direct bank integrations** — Out of scope; email-based approach is simpler + broader

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| User signup & login | HIGH | MEDIUM | **P1** | Blocker; can't access product without |
| YNAB OAuth connection | HIGH | MEDIUM | **P1** | Core differentiator; no product without it |
| Per-user forwarding address | HIGH | HIGH | **P1** | Core value prop |
| Multi-tenant data model | HIGH | MEDIUM | **P1** | Foundational; enables all other features |
| Email inbound routing | HIGH | MEDIUM | **P1** | Extends existing logic to multi-tenant |
| Activity log | MEDIUM | LOW | **P1** | Dashboard foundation; visibility required |
| Test mode (per-user) | MEDIUM | LOW | **P1** | Confidence builder; already built (v4.0) |
| Account settings | MEDIUM | MEDIUM | **P1** | Standard SaaS UX |
| Account deletion | MEDIUM | MEDIUM | **P1** | Legal requirement |
| Error notifications | MEDIUM | LOW | **P1** | Users need to know about failures |
| Onboarding flow | MEDIUM | MEDIUM | **P1** | Reduces friction; differentiator |
| Email parse transparency | MEDIUM | MEDIUM | **P2** | Confidence booster; defer to v5.1 |
| Auto-category suggestions | HIGH | HIGH | **P2** | Valuable; post-MVP; requires user data |
| YNAB account auto-routing | MEDIUM | MEDIUM | **P2** | Power user feature; defer to v5.1 |
| Custom forwarding rules | MEDIUM | HIGH | **P3** | Scope creep; defer to v2 |
| Slack/Telegram notifications | LOW | MEDIUM | **P3** | Email sufficient; defer |
| Billing/Stripe | MEDIUM | HIGH | **P3** | Post-beta; keep free-only for validation |
| Team workspace sharing | MEDIUM | HIGH | **P3** | Complex; revisit with market feedback |
| Refund tracking | MEDIUM | HIGH | **P3** | Unclear demand; defer |
| Mobile app | LOW | HIGH | **P3** | Web-first; responsive design sufficient |

**Priority key:**
- **P1:** Must have for v5.0 launch — multi-tenant SaaS core
- **P2:** Add in v5.1–5.3 when core validated — user-driven priorities
- **P3:** Future consideration — post-PMF or enterprise tier

## Competitor Feature Analysis

Multi-tenant receipt automation space is nascent. Competitors (if any) are generally payment processors (Square, Toast) with receipt automation as add-on, not primary product. Analyzing feature expectations against general SaaS onboarding + budget automation tools (YNAB, Mint legacy).

| Feature | YNAB (Budget Tool) | Plaid (Account Link) | Our Approach (Email Automation SaaS) |
|---------|------------------|--------------------|------------------------------------|
| User signup | Email/Google/Apple OAuth | Email/corporate SSO | Magic link + Google OAuth (minimal friction) |
| Data connection | Manual entry or Plaid | OAuth to banks (secured) | YNAB OAuth (user's own account) |
| Data isolation | Per-user (web) | Tenant isolation (enterprise) | Per-user via `user_id` scoping |
| Activity visibility | Full transaction history | Account sync history | Forwarding-specific log (receipts only) |
| Error handling | Manual re-entry or retry | Sync failures + notifications | Email alerts + replay-able transactions |
| Setup friction | Moderate (manual or Plaid) | High (enterprise approval) | **Low** (magic link → OAuth → address → done) |
| Onboarding UX | Guided walkthrough | Centralized provisioning | Guided workflow (differentiator) |

**Our advantage:** Minimal onboarding friction + zero integration required (user just forwards emails). YNAB requires their data connection; we leverage it but don't own it.

## Sources

**SaaS Onboarding & Best Practices:**
- [Multi-Tenant Deployment: 2026 Complete Guide & Examples | Qrvey](https://qrvey.com/blog/multi-tenant-deployment/)
- [Tenant Onboarding Best Practices in SaaS with the AWS Well-Architected SaaS Lens | AWS Partner Network](https://aws.amazon.com/blogs/apn/tenant-onboarding-best-practices-in-saas-with-the-aws-well-architected-saas-lens/)
- [SaaS Onboarding Flow: 10 Best Practices That Reduce Churn (2026) | Design Revision](https://designrevision.com/blog/saas-onboarding-best-practices)
- [SaaS Onboarding Flows That Actually Convert in 2026 | SaaSUI](https://www.saasui.design/blog/saas-onboarding-flows-that-actually-convert-2026)

**Authentication & OAuth:**
- [Auth.js | Configuring Resend](https://authjs.dev/guides/configuring-resend)
- [Auth.js Magic Links OAuth user onboarding Next.js 2026](https://nextjsstarter.com/blog/nextauth-magic-link-code-examples-for-success/)
- [YNAB API Overview | YNAB Support](https://support.ynab.com/en_us/the-ynab-api-an-overview-BJMgQ3zAq)

**Email Routing & Inbound Processing:**
- [Postmark vs SendGrid: a Detailed Comparison for 2026](https://postmarkapp.com/compare/sendgrid-alternative)
- [Best Inbound Email Notification APIs in 2026 | Pingram](https://www.pingram.io/blog/best-inbound-email-notification-apis)

**Dashboards & Analytics:**
- [2026 Self-Service Dashboards: Benefits & Implementation | Qrvey](https://qrvey.com/blog/self-service-dashboard/)
- [Top 9+ SaaS Dashboard Templates for 2026 | TailAdmin](https://tailadmin.com/blog/saas-dashboard-templates)

**SaaS MVP & Feature Prioritization:**
- [SaaS MVP Development in 2026: Expert Strategy Guide](https://saasfractionalcpo.com/blog/saas-mvp-development-guide/)
- [Sequencing Table Stakes vs. Differentiators — Product Teacher](https://www.productteacher.com/articles/sequencing-table-stakes-and-differentiators)

---

*Feature research for: Multi-tenant SaaS (email-to-YNAB automation)*
*Researched: 2026-03-28*
*Phase: v5.0 Multi-Tenant SaaS Beta Launch*
