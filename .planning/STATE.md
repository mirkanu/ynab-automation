---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Any Retailer + Category Tagging
status: in_progress
stopped_at: Milestone v2.0 started — defining requirements
last_updated: "2026-03-24T19:00:00Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Amazon to YNAB Automation — Project State

**Updated:** 2026-03-24

## Project Reference

**Core Value:** A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

**Users:** Manuel and Emily-Kate (two household members with separate YNAB accounts)

**Tech Stack:** Next.js (API routes) + PostgreSQL on Railway

**Key Constraint:** Reuse existing Railway infrastructure (already running Josie n8n + Claude); no new platforms.

---

## Current Position

**Phase:** Not started (defining requirements)
**Status:** Defining requirements for v2.0
**Progress:** [          ] Phase structure TBD

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

## Out of Scope (v2 or later)

- Automated email capture (no forwarding needed)
- Claude-suggested YNAB categories
- Receipt attachments
- Non-Amazon emails
- Web UI / dashboard
- Multi-budget support

---

## Session Continuity

**Last Session:** 2026-03-24T16:00:00Z
**Stopped At:** Phase 3 complete, smoke test passed
**Next Steps:** Plan and execute Phase 4 (Error Notification)
