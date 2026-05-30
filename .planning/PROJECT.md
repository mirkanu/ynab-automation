# Amazon to YNAB Automation

## What This Is

A self-hosted YNAB automation for a single household. Turns forwarded order confirmation emails into YNAB transactions automatically, and provides a suite of currency reconciliation tools for managing multi-currency Wise accounts alongside YNAB.

## Core Value

Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.

## Current State

v6.3 shipped 2026-05-30. App runs on Hetzner VPS (`hetzner-vps`) as a Docker container (`ynab-api`, port 3001), with PostgreSQL (`ynab-db`). Includes two currency tools: EUR→GBP transfer reconciliation and EUR Wise account reconciliation. Phase 32 complete — dashboard redesigned with two-panel layout: Email Automation panel (server-rendered stats) and Currency panel (live-polling tool status). Forwarding Address grouped under Email Automation.

## Current Milestone: v6.4 Currency Tools & UI Consolidation

**Goal:** Restructure the admin UI into logical Email Automation and Currency sections, add a EUR transaction converter, and wire all currency tools into an explicit ordered workflow with pre-flight checks.

**Target user:** Single admin household user managing a multi-currency Wise account alongside YNAB.

**Target features:**
- Restructure navigation: Email Automation (Activity Log, Rules, Test & Replay) + Currency (EUR→GBP Transfers, EUR Conversion, EUR Reconciliation) + Settings (unchanged)
- Redesign Dashboard as a true two-panel overview (Email Automation stats + Currency stats/last-run)
- Build EUR Multi-Currency Converter: detect unconverted unreconciled EUR transactions, fetch historical EUR→GBP rates via Frankfurter, preview and bulk-apply with memo
- Currency workflow integration: numbered 1→2→3 step UI with status badges; Reconciliation pre-flight warns if unconverted transactions remain

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
- ✓ iron-session admin auth — v6.0
- ✓ Single-tenant schema with Settings/ActivityLog/ProcessedEmail — v6.0
- ✓ First-install wizard — v6.0
- ✓ Settings restructured (Rules / Settings / Tools) — v6.2
- ✓ Forwarding address prominent on dashboard — v6.2
- ✓ EUR→GBP transfer reconciliation tool — v6.3
- ✓ EUR Wise account reconciliation tool — v6.3
- ✓ Dashboard redesigned with Email Automation panel (stats) and Currency panel (live tool status) — Phase 32

### Active

<!-- Current scope. Building toward these. -->

- [ ] Restructure nav into Email Automation + Currency + Settings sections with sub-navigation
- [ ] EUR Multi-Currency Converter (detect, preview, bulk-apply historical-rate conversions)
- [ ] Currency workflow UI (numbered steps, status badges, reconciliation pre-flight check)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Billing/Stripe integration — single-tenant deployment doesn't need it
- Multi-user support — single household, rolled back in v6.0
- Category learning/reconciliation — deferred to user feedback phase
- Refund handling — deferred to user feedback phase
- Split transactions — deferred to user feedback phase
- Daily digest email — deferred to user feedback phase
- Mobile app — web-first
- Direct bank integrations — email-based approach works
- Non-EUR currencies — only EUR accounts are in use (CHF/USD out of scope for now)
- Automatic daily sync — manual trigger with preview is sufficient for this use case

## Context

- Stack: Next.js (App Router, TypeScript) + PostgreSQL 16 + Prisma + iron-session
- Inbound email: Pipedream → `/api/webhook` (active path)
- Deployment: Hetzner VPS, Docker Compose (`/home/services/hetzner-vps/docker-compose.yml`)
- Currency APIs: Wise API (live rates, account balances) + Frankfurter (historical ECB rates, free, no key)
- YNAB accounts in use: €Wise Euro (EUR), Wise GBP (GBP), others
- Single admin household; no multi-user, no public signup

## Constraints

- **No new API keys**: Frankfurter is free and keyless — no account needed
- **Hetzner VPS memory**: 3.7GB total, ~1.8GB available — keep builds lean
- **Deploy via SSH**: `ssh hetzner-vps "git -C /home/services/ynab fetch..."`
- **Privacy**: YNAB PAT stored as DB Setting, not committed to code

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SENDERS/CURRENCY_ACCOUNTS as JSON config | Works natively on Railway | ✓ Good |
| DB-backed settings (Setting table) | Instant config changes without restart | ✓ Good |
| Activity log stores account/category names | Human-readable without extra API calls | ✓ Good |
| iron-session single admin password | Simpler than OAuth for single-household use | ✓ Good |
| Frankfurter for historical EUR→GBP rates | Free, ECB-sourced, no API key, covers all needed currencies | — Pending |
| Detect unconverted EUR txns by memo absence | Memos with conversion marker are considered converted | — Pending |
| Reconciliation pre-flight warns, not blocks | User can override — respects admin's judgment | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

<details>
<summary>v6.3 Milestone Context (archived)</summary>

**Goal:** Build financial reconciliation tools — EUR→GBP transfer reconciliation (phase 29) and EUR Wise account reconciliation (phase 30). Shipped 2026-05-30.

</details>

<details>
<summary>v6.2 Milestone Context (archived)</summary>

**Goal:** Settings restructure & UX polish — Rules / Settings / Tools nav, forwarding address prominence. Shipped 2026-05-06.

</details>

<details>
<summary>v5.0 Milestone Context (archived)</summary>

**Goal:** Transform single-user automation into a multi-tenant SaaS. Shipped 2026-04-10; rolled back in v6.0.

</details>

---

*Last updated: 2026-05-30 after Phase 32 complete (dashboard redesign)*
