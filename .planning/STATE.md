---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Any Retailer + Category Tagging
status: in_progress
stopped_at: Roadmap created — v2.0 phases defined (Phase 5 and Phase 6)
last_updated: "2026-03-24T19:00:00Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
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
**Phase:** Phase 5 — Retailer Support (not started)
**Status:** Roadmap approved; ready to plan Phase 5
**Progress:** [          ] 0/2 v2.0 phases complete

---

## v2.0 Phase Overview

| Phase | Goal | Status |
|-------|------|--------|
| 5. Retailer Support | Any order confirmation processed; retailer name as payee | Not started |
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
| Math.round(amount * 1000) * -1 for YNAB milliunits | Rounds floating point before negating | Implemented |
| Transactions created as uncleared, no category | User preference; omit category_id to prevent YNAB auto-assign | Implemented |
| Memo format: "Name: description - Automatically added from email" | User-specified format | Implemented |
| nixpacks.toml to override Railway build | BuildKit cache corruption on tsconfig.tsbuildinfo | Implemented |

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

**Last Session:** 2026-03-24T19:00:00Z
**Stopped At:** v2.0 roadmap created — Phase 5 and Phase 6 defined
**Next Steps:** Plan and execute Phase 5 (Retailer Support)
