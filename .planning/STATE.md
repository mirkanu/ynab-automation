# Amazon to YNAB Automation — Project State

**Updated:** 2026-03-23

## Project Reference

**Core Value:** A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

**Users:** Manuel and Emily-Kate (two household members with separate YNAB accounts)

**Tech Stack:** Next.js (API routes) + PostgreSQL on Railway

**Key Constraint:** Reuse existing Railway infrastructure (already running Josie n8n + Claude); no new platforms.

---

## Current Position

**Phase:** 01-scaffold-and-deploy
**Plan:** 02 (next to execute)
**Status:** In progress
**Progress:** 1/3 phases (Plan 1/N within phase 01)

---

## Performance Metrics

- **Requirement Coverage:** 17/17 v1 requirements mapped
- **Phase Coherence:** 3 natural delivery boundaries (Scaffold → Inflow → Parse & Create)
- **01-01 Duration:** 7 min

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Postmark for inbound email | Best-in-class inbound parsing, clean webhook, free tier sufficient | Pending implementation |
| Railway for hosting | Reuse existing infrastructure; avoid Vercel cold starts | Pending implementation |
| Sender-based YNAB account routing | Manuel and Emily-Kate each have their own account | Pending implementation |
| Uncategorized in Phase 1 | Simpler to ship; category logic can be layered in Phase 2 | Pending implementation |
| PostgreSQL for dedup | Postmark may redeliver on failure; idempotency via message ID | Pending implementation |
| next.config.mjs not .ts | Next.js 14.2 does not support TypeScript config files | Implemented (01-01) |
| GET on /api/webhook | Railway health checks need 200 response, not 405 | Implemented (01-01) |
| db:migrate on boot | Ensures ProcessedEmail table exists before app starts | Implemented (01-01) |

### Out of Scope (v2 or later)

- Automated email capture (no forwarding needed)
- Claude-suggested YNAB categories
- Receipt attachments
- Non-Amazon emails
- Web UI / dashboard
- Multi-budget support
- Email parsing without Claude
- Notifications on success/failure

### Infrastructure Notes

- Railway project already exists (Josie n8n + Claude)
- PostgreSQL can be added to same Railway environment
- Postmark account needs to be set up with inbound webhook routing

---

## Session Continuity

**Last Session:** 2026-03-23 (01-01 scaffold execution)
**Stopped At:** Completed 01-01-PLAN.md
**Next Steps:** Execute Plan 02 (Railway deploy + database provisioning)

---

## Blockers & Todos

- [ ] Set up Postmark account (needed for Plan 02 or Phase 02)
- [ ] Provision PostgreSQL on Railway (needed for Plan 02)
- [ ] Add env vars to Railway service (DATABASE_URL, ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, POSTMARK_SERVER_TOKEN)

---

*State updated after 01-01 execution (2026-03-23).*
