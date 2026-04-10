# Amazon to YNAB Automation

## What This Is

A YNAB automation that turns forwarded order confirmation emails into transactions. Currently shipped as a multi-tenant SaaS on Railway (v5.0), but in practice only used by a single household — next milestone rolls it back to single-tenant to shed unnecessary complexity.

## Core Value

Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.

## Current State

v5.0 Multi-Tenant SaaS is live at https://ynab-test-production.up.railway.app. Users can sign up via magic link, connect YNAB via OAuth (AES-256-GCM encrypted tokens, 5-min proactive refresh), receive a unique Postmark forwarding address, and see their own activity log + stats dashboard. PostgreSQL Row-Level Security enforces tenant isolation.

**However**: the multi-tenant machinery is overkill for the actual user base (one household). The next milestone walks it back.

## Next Milestone: Single-Tenant Rollback (Planned)

**Goal:** Simplify deployment by removing the multi-tenant layer while keeping everything users actually rely on — the settings UI, sender/currency routing rules, test mode, activity log, and email → YNAB pipeline. Scope to be defined via `/gsd:new-milestone`.

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
- ✓ Test mode toggle — v4.0 (rewired per-user in v5.0, silently broken until UAT fixed it 2026-04-10)
- ✓ Email parse preview and transaction replay — v4.0
- ✓ User accounts with passwordless magic links (Auth.js v5) — v5.0
- ✓ YNAB OAuth per user with AES-256-GCM encrypted token storage — v5.0
- ✓ Per-user Postmark forwarding addresses (SHA256 mailbox hash) — v5.0
- ✓ PostgreSQL Row-Level Security enforcing tenant isolation — v5.0
- ✓ Per-user dashboard, activity log, settings, onboarding — v5.0
- ✓ GDPR account deletion with cascade — v5.0
- ✓ Per-sender routing rules UI (restored via quick tasks) — post-v5.0
- ✓ Currency-based account routing UI (restored via quick tasks) — post-v5.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] Single-tenant rollback — scope TBD in next `/gsd:new-milestone`

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Billing/Stripe integration — single-tenant deployment doesn't need it
- Multi-user support — rolled back in next milestone; one household is the real user base
- Category learning/reconciliation — deferred to user feedback phase
- Refund handling — deferred to user feedback phase
- Split transactions — deferred to user feedback phase
- Daily digest email — deferred to user feedback phase
- Mobile app — web-first
- Direct bank integrations — email-based approach works

## Context

- Stack: Next.js 14 (App Router) + PostgreSQL on Railway + Prisma 5.22 + Auth.js v5
- Inbound email: Pipedream (legacy path, still active) and Postmark (Phase 18 per-user path, built but unused in practice)
- Current LOC: ~10,700 (TS/TSX/Prisma)
- Live at: https://ynab-test-production.up.railway.app
- Single-user household usage — multi-tenant infrastructure is dormant weight
- Test suite: 197 passing, 10 failing (webhook route tests stale since v5.0, multi-tenant isolation tests skip without real DB)

## Constraints

- **Minimum effort to run**: deploy on Railway with one button, keep it running with zero ongoing maintenance
- **Railway deployment**: Stay on Railway for infrastructure simplicity
- **Privacy**: YNAB tokens encrypted at rest (AES-256-GCM)
- **Backward compatibility during rollback**: don't lose activity log, settings, or forwarding address

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SENDERS/CURRENCY_ACCOUNTS as JSON config | Works natively on Railway | ✓ Good |
| DB-backed settings (Setting table) | Instant config changes without restart | ✓ Good |
| Activity log stores account/category names | Human-readable without extra API calls | ✓ Good |
| Auth.js v5 with PrismaAdapter database sessions | PrismaClient can't run in Edge runtime, so can't use JWT strategy with middleware — database sessions with lightweight middleware cookie check work around this | ✓ Good (constrained by runtime) |
| PostgreSQL FORCE RLS with Prisma `$extends` middleware | Defense-in-depth: app bug can't leak data across tenants | ✓ Good (but unnecessary for single-tenant) |
| AES-256-GCM for YNAB tokens | Random-nonce ciphertext, industry standard | ✓ Good |
| 5-min proactive YNAB refresh + 30s mutex | Avoid thundering herd on concurrent requests | ✓ Good |
| SHA256 mailbox hash for per-user forwarding | Stable, collision-free, derivable from user id | ✓ Good |
| Phase 19-02 "migrated test mode to DB" claim | Only the UI banner was migrated; both email handlers kept `process.env.TEST_MODE` | ⚠️ Gap — silent production bug until UAT 2026-04-10 |
| Middleware using `request.url` for callbackUrl | Behind Railway's proxy, resolves to `localhost:8080` | ⚠️ Gap — fixed 2026-04-10 with `request.nextUrl.pathname` |
| Multi-tenant architecture for single-household user base | Future-proofing that wasn't needed; being rolled back in next milestone | ⚠️ Revisit — rolling back |

## Key Lessons from v5.0

- **SUMMARY.md "complete" claims don't equal "verified"**: Phase 19-02 shipped with test-mode wiring only in the UI layer; both email pipelines retained the env-var check. The SUMMARY claimed the migration was complete, and no one ran UAT until 2026-04-10. Lesson: `/gsd:verify-work` against live production should gate milestone sign-off, not be optional.
- **Edge middleware is proxy-hostile**: `request.url` resolves to internal bind addresses behind Railway's proxy. Always use `request.nextUrl.pathname` or read `x-forwarded-host` explicitly.
- **Multi-tenant infrastructure has a real cost**: RLS policies, per-user token refresh, cascade deletes, and tenant-scoped prisma wrappers each added implementation time and review burden. With one household as the actual user, the cost/benefit flipped.
- **Legacy handler paths don't self-deprecate**: `/api/webhook` (Pipedream, v4.0 era) is still the active email ingestion path. `/api/email/inbound` (Phase 18) was built and tested but unused in production, so its bugs were invisible until someone ran UAT against the wrong handler.

---

<details>
<summary>v5.0 Milestone Context (archived)</summary>

**Goal:** Transform single-user automation into a multi-tenant SaaS where anyone could sign up, connect YNAB, and start processing forwarded receipts. Shipped 2026-04-10 after the core work completed 2026-03-30; full archival including UAT fixes on 2026-04-10.

Phases: 16 (User Accounts + RLS), 17 (YNAB OAuth + encrypted tokens), 18 (per-user inbound email), 19 (dashboard, onboarding, account deletion).

</details>

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

*Last updated: 2026-04-10 after v5.0 milestone completion*
