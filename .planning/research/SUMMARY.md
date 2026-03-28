# Project Research Summary

**Project:** Email-to-YNAB Automation Multi-Tenant SaaS (v5.0)
**Domain:** Multi-tenant automation SaaS with OAuth integration and email-based transaction processing
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

Converting the existing single-user email-to-YNAB automation into a multi-tenant SaaS requires three foundational shifts: (1) implementing Auth.js for user authentication (magic links + OAuth providers) to replace the current single-user deployment, (2) extending all database tables with `user_id` scoping and implementing PostgreSQL Row-Level Security for tenant isolation, and (3) migrating from Pipedream webhooks to Postmark or SendGrid for per-user email routing with encrypted YNAB OAuth token storage. The existing architecture is well-suited for this transition—PostgreSQL's RLS support, Prisma's schema flexibility, and Next.js API routes all enable clean tenant isolation without operational overhead of per-tenant databases. The conversion is non-breaking: existing admin routes continue functioning, new auth layers gate access, and the single current user becomes the initial tenant during migration.

The research identifies seven critical pitfalls specific to multi-tenant conversions: data leakage via missing `user_id` filters, OAuth token security vulnerabilities, concurrent token refresh race conditions, inbound email routing failures, session context loss in background jobs, database migration data integrity, and Auth.js session wiring gaps. Each pitfall has concrete prevention strategies, and all must be addressed during Phase 1 (User Accounts & Auth) and Phase 2 (Per-User Inbound Email) to prevent production incidents.

## Key Findings

### Recommended Stack

The tech stack builds on existing infrastructure with minimal new dependencies:

**Core technologies:**
- **Auth.js v5.0+** — Multi-user signup/login with magic links (Resend) and Google OAuth; database-backed sessions with built-in Account table for token storage
- **Resend** — Email transport for Auth.js magic link verification; already integrated for admin error notifications
- **PostgreSQL 15+ with Row-Level Security** — Shared database model with `user_id` on all tables; RLS policies enforce tenant isolation at the database level (prevents data leakage even with compromised session tokens)
- **Prisma 5.0+** — ORM with TypeScript support; clear schema declaration and migrations; enables `user_id` scoping across all operations
- **Postmark or SendGrid** — Inbound email routing for per-user forwarding addresses; webhook-based processing with MailboxHash for user context embedding
- **TweetNaCl.js or libsodium.js** — AES-256-GCM encryption for YNAB OAuth tokens at rest; authentication prevents tampering
- **Existing stack unchanged:** Next.js 15+, shadcn/ui, Tailwind, React Hook Form, YNAB OAuth Authorization Code Grant, Claude API for email parsing

**Version constraints:** PostgreSQL 15+ (RLS required), Auth.js v5.0+ (email + OAuth providers), Prisma 5.0+ (schema improvements)

### Expected Features

**Table stakes (users expect these for any SaaS):**
- User signup & login with magic links and Google OAuth — passwordless, friction-minimized
- Per-user data isolation via Row-Level Security — users expect their data private and separate
- YNAB account connection via OAuth (not manual token entry) — standard for OAuth-based services
- Unique per-user forwarding email address — core value proposition
- Dashboard showing transaction activity log — transparency into what's happening
- Account settings/preferences — standard SaaS UX for configuration
- Error notifications via email — users need to know when something breaks
- Account deletion with GDPR compliance — legal requirement

**Competitive differentiators (features that set this apart):**
- One-step onboarding: signup → connect YNAB → receive forwarding address → done in <5 minutes
- Inline test mode (preview parsed transaction before sending to YNAB) — reduces fear of breaking YNAB
- Email parse transparency (show Claude's reasoning) — builds user confidence; debugging aid
- Smart YNAB account routing (multi-currency, multi-account awareness) — handles complex setups without user config
- Activity log with human-readable YNAB account/category names — implemented in v4.0, carries forward

**Defer to v5.1+ (avoid scope creep):**
- Auto-category suggestions based on retailer patterns — valuable but requires user feedback + training data
- Custom forwarding rules engine — scope creep; defer until user demand clarified
- Slack/Telegram notifications — email sufficient for beta; integrations are v2+
- Billing/Stripe integration — keep free-only for validation; data model has `plan` field ready
- Team/workspace sharing — complex permission model; one user = one address for v5.0
- Custom domain per user — enterprise feature; defer
- Refund tracking and split transactions — unclear demand; rare use cases

**Feature dependency chain:** User signup → Per-user data isolation → YNAB OAuth → Per-user forwarding address → Email inbound routing → Activity log. Test mode, settings, and account deletion extend the dashboard. Onboarding flow integrates all of these.

### Architecture Approach

The migration uses a shared database schema (single database, all users, `user_id` on every table) with Row-Level Security policies at the PostgreSQL level. This avoids operational complexity of per-tenant databases while enabling cross-tenant aggregation for later analytics. The data flow is straightforward: Auth.js authenticates users and stores encrypted YNAB OAuth tokens in the User table; API routes extract `user_id` from the session and apply it to every database query; Postmark/SendGrid webhooks route inbound emails to the `/api/email/inbound` handler, which identifies the user by the forwarding email address (using MailboxHash for context embedding), decrypts their YNAB token, and processes the transaction scoped to that user. Activity logs and settings are stored per-user with `user_id` foreign keys and RLS policies enforcing isolation.

**Major components and responsibilities:**
1. **Auth.js + Resend** — Session management; user signup/login; magic link verification; OAuth provider integration
2. **User & Session Tables** — Per-user storage: encrypted YNAB OAuth tokens, forwarding email address, settings, plan information
3. **Tenant-scoped Tables** — ActivityLog, Settings, etc.; all rows include `user_id` and are isolated via RLS
4. **Postmark/SendGrid Inbound** — Routes forwarded emails to webhook; validates signature; embeds user context via MailboxHash
5. **Email Parsing & YNAB API** — Existing Claude API call (stateless) + YNAB transaction creation (scoped to user's token)
6. **Dashboard & Settings UI** — Per-user activity view, forwarding address display, settings editor, test mode toggle
7. **Background Jobs** — Token refresh, email parsing (if async), webhook deduplication; must pass `user_id` as parameter

### Critical Pitfalls

**1. Data leakage via missing user_id filters** — The most common pitfall in multi-tenant conversions. A single forgotten `WHERE user_id = ?` clause exposes another user's data. Prevention: establish a rule that every query must include `user_id` filtering or reference the user through a foreign key; use database RLS as a backstop; test with multiple users; code review checklist on every query.

**2. OAuth token security (storage, refresh, revocation)** — Tokens leaked in logs, stored unencrypted, or refreshed concurrently causing race conditions. Prevention: use YNAB's Authorization Code Grant (supports refresh tokens), encrypt tokens at rest with AES-256, implement refresh token rotation with database-level locking, never log tokens, revoke on disconnect, use Auth.js Account table for built-in encryption support.

**3. Concurrent refresh token exhaustion** — Two simultaneous requests detect an expired token and both attempt to refresh, causing one token to become invalid and locking the account. Prevention: use database-level row locking on token updates, implement refresh mutex/debounce with `last_refresh_attempt_at` timestamp, handle "too many refresh attempts" errors gracefully by forcing re-auth, test with concurrent requests.

**4. Inbound email routing to wrong user** — Forwarding address routed to the wrong user's YNAB account or lost entirely. Prevention: use MailboxHash to embed user context in the inbound address, implement webhook idempotency with `processed_webhooks` table, verify webhook signature with per-user secret, scope deduplication by user (not just message ID), test email routing with multiple users.

**5. Session context lost in background jobs and webhooks** — Background jobs or webhooks can't access Auth.js session context, so they either process for the wrong user or all users. Prevention: always include `user_id` in webhook payloads and job parameters, use a job queue with explicit user_id parameter, test background jobs with multiple users.

**6. Database migration data integrity** — When adding `user_id` to existing tables, data can become orphaned or assigned to the wrong user. Prevention: plan migrations in phases (add nullable column, backfill, add NOT NULL constraint, audit), write idempotent migration scripts, test against production-like data, have a documented rollback plan.

**7. Auth.js session user ID not wired through** — The session callback doesn't include the database user ID, so API routes can't identify the user. Prevention: explicitly add user.id to JWT token and session callback, augment TypeScript Session type, test that session.user.id is defined in every API route.

## Implications for Roadmap

Research indicates a 4-phase implementation structure, with strong dependencies requiring sequential execution. Each phase addresses specific pitfalls and delivers concrete user-facing features.

### Phase 1: User Accounts & Authentication

**Rationale:** Foundation for everything else. Without user authentication and tenant isolation at the database level, no subsequent phase can work correctly. Establishes the patterns (user_id filtering, RLS policies, session wiring) that prevent data leakage pitfalls.

**Delivers:**
- Multi-user signup via magic links (Resend) and Google OAuth
- Auth.js + database sessions with `session.user.id` wired through
- User table with encrypted YNAB OAuth token storage fields
- Row-Level Security policies on ActivityLog and Settings tables
- Migration of single-user data to initial user record (id='manuel')
- API middleware pattern for user_id extraction and filtering
- Pitfall prevention: data leakage (RLS backstop), session wiring, migration integrity

**Implements features from FEATURES.md:**
- User signup & login (P1)
- Per-user data isolation via RLS (P1)
- Account deletion with GDPR compliance (P1)

**Addresses pitfalls:**
- Data leakage via missing user_id filters (RLS enforcement at database level)
- OAuth token security foundation (Auth.js Account table + encryption infrastructure)
- Auth.js session user ID wiring (session callback with user.id included)
- Database migration data integrity (phased, non-breaking migration strategy)

**Research flags:** Standard Auth.js integration; low complexity, proven patterns. Unlikely to need deeper research. Follow official Auth.js v5 + Prisma adapter documentation.

### Phase 2: Per-User Inbound Email & Forwarding Addresses

**Rationale:** Builds on Phase 1 auth foundation. Requires user authentication to exist before assigning forwarding addresses. Implements the email routing system that handles per-user webhook processing and idempotency. Addresses all email-specific pitfalls.

**Delivers:**
- Integration with Postmark or SendGrid for inbound email routing
- Per-user forwarding email address assignment (unique per user)
- MailboxHash-based user context embedding in inbound addresses
- Webhook idempotency layer with `processed_webhooks` table
- Email inbound routing to `/api/email/inbound` with user identification
- Webhook signature validation per-user
- Existing email parsing + YNAB logic refactored for per-user token handling

**Implements features from FEATURES.md:**
- Per-user forwarding email address (P1)
- Email inbound routing & processing (P1)
- Per-user activity log (P1)
- Error notifications via email (P1)

**Addresses pitfalls:**
- Inbound email routing to wrong user (MailboxHash + user verification)
- Concurrent refresh token exhaustion (token refresh happens with user's token, with locking)
- Session context lost in webhooks (user_id extracted from MailboxHash, passed explicitly)
- Webhook deduplication and idempotency (processed_webhooks table with UNIQUE constraint on webhook_id)

**Research flags:** Postmark vs SendGrid decision needed (technical API comparison); webhook reliability patterns; MailboxHash configuration specifics; idempotency strategies. Run technical spike to select email provider.

### Phase 3: Per-User YNAB OAuth & Token Management

**Rationale:** Once forwarding addresses work, users need to connect their own YNAB accounts. Implements OAuth flow, token refresh with concurrency safety, and revocation. Requires Phase 1 user model and Phase 2 email processing to be complete.

**Delivers:**
- YNAB OAuth Authorization Code Grant flow (user consent-based)
- Token refresh logic with database-level locking (prevents refresh token exhaustion)
- Token encryption/decryption (AES-256-GCM with libsodium or TweetNaCl.js)
- Token revocation on disconnect (force re-auth if needed)
- Proactive token expiration checking before API calls
- "Connect YNAB" and "Disconnect YNAB" UI flows
- YNAB token rotation strategy (refresh tokens on each call)

**Implements features from FEATURES.md:**
- YNAB account connection via OAuth (P1)
- Inline test mode with user's YNAB account (P1)

**Addresses pitfalls:**
- OAuth token security (encryption at rest, refresh token rotation, revocation)
- Concurrent refresh token exhaustion (database lock on token update, refresh mutex)
- Token leakage in logs (redact tokens in error messages, verify encryption)
- Session context in background jobs (token refresh jobs pass user_id as parameter)

**Research flags:** Token refresh locking strategies (database transaction details); refresh token rotation edge cases; YNAB API error handling for rate limits and token exhaustion. Run load testing with concurrent token refresh attempts.

### Phase 4: User Dashboard, Settings & Onboarding Flow

**Rationale:** User-facing features that tie together Phases 1–3. Requires all backend infrastructure to be in place. Implements the guided onboarding flow that reduces friction and the dashboard for visibility into automation.

**Delivers:**
- Dashboard with per-user activity log (created in Phase 2, displayed here)
- Settings editor for per-user configuration (forwarding address, YNAB connection status, preferences)
- Settings persistence (database-backed; no app restart required)
- Guided onboarding flow: signup → YNAB connect → forwarding address assignment → ready
- Test mode toggle and replay functionality (already built in v4.0, extend per-user)
- Account deletion flow with cascading data removal
- Optional: email parse transparency (show Claude reasoning) in transaction details

**Implements features from FEATURES.md:**
- Per-user dashboard with activity log (P1)
- Settings & preferences editor (P1)
- Test mode (per-user) (P1)
- Account deletion (GDPR) (P1)
- Onboarding flow (P1) — differentiator
- Email parse transparency (P2) — low-lift confidence booster

**Addresses pitfalls:**
- Session context in background jobs (activity log queries scoped by user_id)
- Data leakage via UI (all queries filtered by session.user.id)

**Research flags:** Onboarding flow UX design and copy; consider user testing for flow validation. Email parse transparency requires Claude integration review (low complexity; parsing already implemented).

### Phase Ordering Rationale

1. **Phase 1 must come first** — Establishes user authentication, session wiring, and RLS policies. Without this, no subsequent phase can isolate tenant data. All phases depend on Phase 1's auth foundation and `user_id` filtering patterns.

2. **Phase 2 before Phase 3** — Email inbound must work before users connect their YNAB accounts, because the webhook handler needs to identify the user and load their token. Phase 2 creates the routing infrastructure; Phase 3 fills in the token storage/refresh.

3. **Phase 3 enables Phase 4** — Can't build a dashboard showing YNAB connection status or test mode without YNAB OAuth complete. Phase 4 is the user-facing layer that consumes all backend work.

4. **Avoid parallel development** — Each phase has pitfalls that affect later phases. Running them sequentially ensures each pitfall is caught and prevented before the next phase depends on it. For example, Phase 1 must get RLS right; Phase 2 depends on that isolation being solid.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Auth.js v5, Prisma, PostgreSQL RLS all have official documentation and proven track records at scale. No experimental tech. |
| Features | HIGH | Multi-source research on SaaS onboarding, OAuth integration, and email automation. Features are standard for the domain; no unknowns. |
| Architecture | HIGH | Architecture patterns are validated with Auth.js official guides, Prisma multi-tenancy docs, and PostgreSQL RLS. Data flow is straightforward. |
| Pitfalls | HIGH | Pitfalls are derived from documented patterns in multi-tenant conversions and security best practices. Prevention strategies are concrete and testable. |

**Overall confidence:** HIGH — All four research areas have HIGH confidence. Stack is proven, features are industry-standard, architecture is well-documented, and pitfalls have concrete prevention strategies. No critical unknowns.

### Gaps to Address

1. **Email provider choice (Postmark vs SendGrid):** Research identifies both as viable but doesn't include detailed cost/DX comparison. Action: During Phase 2 planning, run a technical spike on both providers' inbound APIs; evaluate webhook reliability, retry behavior, and MailboxHash support.

2. **YNAB token refresh concurrency under load:** Research identifies the pitfall and prevention strategy but doesn't include load testing numbers. Action: During Phase 3, implement the locking strategy and test with 10+ concurrent requests with expired tokens; measure latency impact.

3. **Performance at scale:** Research identifies indexes and pagination but doesn't specify exact thresholds for when they matter. Action: During Phase 4, profile activity log queries; add indexes if load testing shows >100ms latency.

4. **GDPR compliance scope:** Research mentions account deletion but doesn't detail data retention policies or audit log requirements. Action: During Phase 1 planning, clarify with the product owner whether audit logs must be retained post-deletion and for how long.

## Sources

### Primary (HIGH confidence)
- [Auth.js Official Documentation](https://authjs.dev) — Magic links, OAuth providers, session management, Prisma adapter
- [PostgreSQL Row-Level Security Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — Tenant isolation enforcement at database level
- [Prisma Multi-Tenancy Patterns](https://www.prisma.io) — Schema design, migrations, ORM patterns for multi-tenant
- [Postmark Inbound Email Processing](https://postmarkapp.com/inbound) — Email routing, webhook signatures, MailboxHash
- [SendGrid Inbound Parse Webhook](https://docs.sendgrid.com/for-developers/parsing-email) — Alternative email provider
- [YNAB OAuth Authorization Code Flow](https://api.ynab.com) — OAuth integration, token refresh, revocation
- [libsodium.js Cryptography](https://docs.libsodium.org) — Token encryption at rest

### Secondary (MEDIUM confidence)
- [Multi-Tenant Security — OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [2026 Tenant Isolation Guide: Risks, Solutions & Tips for SaaS](https://qrvey.com/blog/tenant-isolation/)
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation)
- [Webhook Security Best Practices](https://hooque.io/guides/webhook-security/)

### Tertiary (validation during implementation)
- SaaS onboarding best practices blogs (design patterns, not technical specifications)
- Community discussions on Auth.js + Prisma (real-world experience, edge cases)

---

*Research completed: 2026-03-28*
*Ready for roadmap: yes*
*Next step: Proceed to `/gsd:plan-phase` with Phase 1 (User Accounts & Auth)*
