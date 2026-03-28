# Amazon to YNAB Automation

## What This Is

A SaaS app that turns forwarded order confirmation emails into YNAB transactions automatically. Users sign up, connect their YNAB account via OAuth, get a unique forwarding address, and start forwarding receipts — no code, no config, no external setup. Currently in beta, targeting YNAB power users who want zero-effort transaction entry.

## Core Value

Forwarded order confirmation email → YNAB transaction, fully automated — for any user, with zero technical setup.

## Current Milestone: v5.0 Multi-Tenant SaaS

**Goal:** Transform single-user automation into a multi-tenant SaaS app where anyone can sign up, connect YNAB, and start processing receipts.

**Target features:**
- User accounts (signup/login via Auth.js with magic links + Google OAuth)
- YNAB OAuth per user (no manual API tokens)
- Per-user inbound email addresses (via Postmark/SendGrid)
- Multi-tenant data model (all tables scoped by user_id)
- Per-user dashboard, activity log, settings, and test mode
- User onboarding flow (signup → connect YNAB → get forwarding address → done)
- Privacy: encrypted OAuth tokens, data retention, account deletion
- Existing user (Manuel) migrated as user #1

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Any order confirmation email forwarded → YNAB transaction — v1.0
- ✓ Retailer auto-detected by Claude, set as YNAB payee — v2.0
- ✓ Optional category tagging (first line of forward) — v2.0
- ✓ Multi-sender routing via SENDERS config — v3.0
- ✓ Currency-based account routing via CURRENCY_ACCOUNTS — v3.0
- ✓ Deduplication via message ID — v1.0
- ✓ Error notifications via Resend email — v1.0
- ✓ Interactive setup wizard — v3.0
- ✓ Railway deploy button + open source — v3.0
- ✓ Admin UI with dashboard, activity log, settings editor — v4.0
- ✓ Activity logging (end-to-end email tracing) — v4.0
- ✓ DB-backed settings (instant save, no restart) — v4.0
- ✓ Test mode toggle — v4.0
- ✓ Email parse preview and transaction replay — v4.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] User accounts with signup/login (Auth.js, magic links + Google OAuth)
- [ ] YNAB OAuth per user (connect/disconnect, encrypted token storage)
- [ ] Per-user unique inbound email addresses
- [ ] Multi-tenant data model (user_id on all tables)
- [ ] Per-user dashboard, activity log, settings
- [ ] User onboarding flow (signup → connect YNAB → get address)
- [ ] Account deletion (GDPR-ready)
- [ ] Migrate existing single-user deployment to multi-tenant

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Billing/Stripe integration — deferred to post-beta; data model has `plan` field ready
- Category learning/reconciliation — deferred to user feedback phase
- Refund handling — deferred to user feedback phase
- Split transactions — deferred to user feedback phase
- Daily digest email — deferred to user feedback phase
- Mobile app — web-first
- Direct bank integrations — email-based approach works

## Context

- Current stack: Next.js (API routes) + PostgreSQL on Railway
- Live at: https://ynab-test-production.up.railway.app
- Inbound email currently via single Pipedream webhook — will be replaced with Postmark/SendGrid
- YNAB supports OAuth (authorization code flow)
- Target scale: dozens of users initially, architecture should handle thousands
- Beta phase: free only, no billing
- Domain TBD — deploy on Railway subdomain for early beta

## Constraints

- **Minimum user hassle**: End users know zero code. No external setup except YNAB OAuth.
- **Railway deployment**: Stay on Railway for infrastructure simplicity
- **Privacy**: Encrypt YNAB tokens at rest (AES-256), 30-day raw email retention, account deletion
- **Budget**: Keep infrastructure costs minimal (shared DB, single instance)
- **Backward compatibility**: Migrate existing data/config as user #1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SENDERS as JSON env var | Works natively on Railway/PaaS | ✓ Good |
| CURRENCY_ACCOUNTS as JSON env var | Same pattern; optional | ✓ Good |
| loadConfig() at handler entry | Config errors surface per-request | ✓ Good |
| YNAB API called from browser (setup) | CORS supported; token never hits server | ✓ Good |
| Railway API auto-apply | Uses built-in RAILWAY_PROJECT/ENV/SERVICE_ID | ✓ Good |
| iron-session v8.0.4 for admin auth | Edge-compatible, zero DB deps, Next.js recommended | ⚠️ Revisit — replacing with Auth.js for multi-user |
| DB-backed settings (Setting table) | Instant config changes without Railway restart | ✓ Good — extending to per-user |
| Test mode via TEST_MODE flag | Safe email testing without YNAB side effects | ✓ Good — becoming per-user |
| Inline CSS throughout admin UI | Matches SetupWizard patterns, zero build config | ✓ Good |
| Activity log stores account name + category name | Human-readable log entries without extra API calls on view | ✓ Good |
| Auth.js for multi-user auth | Free, built for Next.js, magic links + OAuth | — Pending |
| YNAB OAuth per user | No manual tokens, minimum hassle | — Pending |
| Postmark/SendGrid inbound email | Per-user addresses, no Pipedream dependency | — Pending |
| Shared DB with user_id (multi-tenant) | Simple, cheap, proven at target scale | — Pending |
| plan field on user model from day one | Stripe integration later is trivial | — Pending |

---

<details>
<summary>v4.0 Milestone Context (archived)</summary>

**Goal:** Password-protected admin UI with dashboard, activity log, settings editor, and test & replay tools — making the app fully self-serviceable.

</details>

<details>
<summary>v3.0 Milestone Context (archived)</summary>

**Goal:** Make the automation usable by anyone, not just Manuel and Emily-Kate. All personal references removed; sender routing driven by JSON config; published as open-source with an interactive setup wizard.

</details>

<details>
<summary>v2.0 Milestone Context (archived)</summary>

**Goal:** Expand automation beyond Amazon to any retailer, and allow optional YNAB category tagging from the forwarded email.

</details>

---

*Last updated: 2026-03-28 after v5.0 milestone started*
