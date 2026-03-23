# Amazon to YNAB Automation — Project State

**Updated:** 2026-03-23

## Project Reference

**Core Value:** A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

**Users:** Manuel and Emily-Kate (two household members with separate YNAB accounts)

**Tech Stack:** Next.js (API routes) + PostgreSQL on Railway

**Key Constraint:** Reuse existing Railway infrastructure (already running Josie n8n + Claude); no new platforms.

---

## Current Position

**Phase:** None yet (roadmap draft, awaiting approval)
**Plan:** —
**Status:** Roadmap creation in progress
**Progress:** 3/3 phases identified

---

## Performance Metrics

- **Requirement Coverage:** 17/17 v1 requirements mapped ✓
- **Phase Coherence:** 3 natural delivery boundaries (Scaffold → Inflow → Parse & Create)
- **Success Criteria Density:** 5-7 observable criteria per phase ✓

---

## Accumulated Context

### Key Decisions (from PROJECT.md)

| Decision | Rationale | Status |
|----------|-----------|--------|
| Postmark for inbound email | Best-in-class inbound parsing, clean webhook, free tier sufficient | Pending implementation |
| Railway for hosting | Reuse existing infrastructure; avoid Vercel cold starts | Pending implementation |
| Sender-based YNAB account routing | Manuel and Emily-Kate each have their own account | Pending implementation |
| Uncategorized in Phase 1 | Simpler to ship; category logic can be layered in Phase 2 | Pending implementation |
| PostgreSQL for dedup | Postmark may redeliver on failure; idempotency via message ID | Pending implementation |

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

**Last Session:** 2026-03-23 (roadmap creation)
**Next Steps:** Approve roadmap → `/gsd:plan-phase 1`

---

## Blockers & Todos

- [ ] User approval of roadmap
- [ ] Set up Postmark account (if not already done)
- [ ] Coordinate with existing Railway Josie project

---

*State initialized with roadmap creation.*
