---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: completed
stopped_at: Completed 05-01-PLAN.md — library contract updates (claude.ts, ynab.ts)
last_updated: "2026-03-24T20:11:22.132Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 11
  completed_plans: 9
  percent: 82
---

# Amazon to YNAB Automation — Project State

**Updated:** 2026-03-24

## Project Reference

**Core Value:** A forwarded order email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

**Users:** Manuel and Emily-Kate (two household members with separate YNAB accounts)

**Tech Stack:** Next.js (API routes) + PostgreSQL on Railway

**Key Constraint:** Reuse existing Railway infrastructure (already running Josie n8n + Claude); no new platforms.

---

## Current Position

**Milestone:** v2.0 — Any Retailer + Category Tagging
**Phase:** Phase 5 — Retailer Support (complete — Plans 01 and 02 done; awaiting human verify checkpoint)
**Status:** Plan 05-02 auto task complete; at human-verify checkpoint
**Progress:** [████████░░] 82%

---

## v2.0 Phase Overview

| Phase | Goal | Status |
|-------|------|--------|
| 5. Retailer Support | Any order confirmation processed; retailer name as payee | Awaiting human verify |
| 6. Category Tagging | First-line category hint assigned to YNAB transaction if matched | Not started |

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Pipedream for inbound email | User chose Pipedream over Postmark/Mailgun — free, no server-side API key needed | Implemented |
| Railway for hosting | Reuse existing infrastructure; avoid Vercel cold starts | Implemented |
| Sender-based YNAB account routing | Manuel and Emily-Kate each have their own account | Implemented |
| PostgreSQL for dedup | Pipedream may redeliver on failure; idempotency via message ID | Implemented |
| next.config.mjs not .ts | Next.js 14.2 does not support TypeScript config files | Implemented |
| GET on /api/webhook | Railway health checks need 200 response, not 405 | Implemented |
| db:migrate on boot | Ensures ProcessedEmail table exists before app starts | Implemented |
| Amazon sender detection via body HTML scan | Forwarded emails embed original sender in blockquote | Implemented |
| parseAmazonEmail returns null on failure, never throws | Prevents webhook handler from crashing on Claude API errors | Implemented |
| parseAmazonEmail renamed to parseOrderEmail with backward-compat alias | Route.ts import unaffected during wave 1; plan 02 will update it | Implemented |
| payeeName required (not optional) in YnabTransactionParams | Callers always have retailer from parsed.retailer; explicit is better than implicit | Implemented |
| Math.round(amount * 1000) * -1 for YNAB milliunits | Rounds floating point before negating | Implemented |
| Transactions created as uncleared, no category | User preference; omit category_id to prevent YNAB auto-assign | Implemented |
| Memo format: "Name: description - Automatically added from email" | User-specified format | Implemented |
| nixpacks.toml to override Railway build | BuildKit cache corruption on tsconfig.tsbuildinfo | Implemented |
| Amazon-only filter removed from webhook | Phase 5 goal is any-retailer support; no sender-content gate needed | Implemented |
| isFromAmazon left in email.ts but not imported | Unused but harmless; clean-up deferred to avoid scope creep | Deferred |

## Infrastructure

- Railway: ynab-automation-production.up.railway.app — live and healthy
- PostgreSQL: DATABASE_URL set; ProcessedEmail table migrated
- Inbound email: Pipedream empk1lk0u08wjyn@upload.pipedream.net → /api/webhook
- Secrets: ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL, YNAB_BUDGET_ID, YNAB_MANUEL_ACCOUNT_ID, YNAB_EMILY_ACCOUNT_ID, EMILY_KATE_EMAIL

## Out of Scope (future)

- Automated email capture (no forwarding needed)
- Claude-suggested YNAB categories
- Receipt attachments
- Web UI / dashboard
- Multi-budget support

---

## Session Continuity

**Last Session:** 2026-03-24T20:09:30Z
**Stopped At:** Completed 05-02-PLAN.md Task 1 (auto) — at checkpoint:human-verify
**Next Steps:** Human verification: forward a non-Amazon order email to Pipedream inbound; verify YNAB payee shows retailer name. Then approve checkpoint to complete Phase 5.
