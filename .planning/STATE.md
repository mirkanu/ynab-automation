---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: Completed 03-02-PLAN.md — Claude parsing lib and YNAB client lib implemented
last_updated: "2026-03-24T12:18:00Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 6
  completed_plans: 5
  percent: 83
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

**Phase:** 03-parse-and-create
**Plan:** 02 (complete) — 03-03 is next
**Status:** In progress
**Progress:** [████████░░] 83% (Phases 1 & 2 complete; Phase 3 plan 2/3 done)

---

## Performance Metrics

- **Requirement Coverage:** 17/17 v1 requirements mapped
- **Phase Coherence:** 3 natural delivery boundaries (Scaffold → Inflow → Parse & Create)
- **01-01 Duration:** 7 min
- **02-02 Duration:** 8 min (488s)
- **03-02 Duration:** 6 min (380s)

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Pipedream for inbound email | User chose Pipedream over Postmark/Mailgun — free, no server-side API key needed | Implemented (01-02) |
| Railway for hosting | Reuse existing infrastructure; avoid Vercel cold starts | Implemented (01-02) |
| Sender-based YNAB account routing | Manuel and Emily-Kate each have their own account | Pending implementation |
| Uncategorized in Phase 1 | Simpler to ship; category logic can be layered in Phase 2 | Pending implementation |
| PostgreSQL for dedup | Pipedream may redeliver on failure; idempotency via message ID | Implemented (01-02) |
| next.config.mjs not .ts | Next.js 14.2 does not support TypeScript config files | Implemented (01-01) |
| GET on /api/webhook | Railway health checks need 200 response, not 405 | Implemented (01-01) |
| db:migrate on boot | Ensures ProcessedEmail table exists before app starts | Implemented (01-01) |
| Amazon sender detection via body HTML scan | Forwarded emails embed original sender in blockquote — top-level from is the forwarding user, not Amazon | Implemented (02-01) |
| Module-level PrismaClient in route.ts | Plain instance adequate for single Railway service; no global singleton needed | Implemented (02-02) |
| Non-Amazon emails get no ProcessedEmail record | Avoids filling dedup table with noise from unrelated emails | Implemented (02-02) |
| vitest over Node built-in test runner | TypeScript support without ts-node/tsx setup overhead | Implemented (02-02) |
| No plain text body in Pipedream envelope | Only HTML body available; parser must handle HTML extraction or pass HTML to Claude | Implemented (02-01) |
| Dedup key: trigger.event.headers["message-id"] | Gmail-assigned on forward, unique per delivery event | Implemented (02-01) |
| parseAmazonEmail returns null on failure, never throws | Prevents webhook handler from crashing on Claude API errors | Implemented (03-02) |
| vi.hoisted() + function constructor for Anthropic SDK mock | Arrow functions fail as vitest constructors; hoisted fn required for cross-scope mock fn references | Implemented (03-02) |
| Math.round(amount * 1000) * -1 for YNAB milliunits | Rounds floating point (e.g. 12.99 * 1000 = 12990.000...) before negating | Implemented (03-02) |

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

- Railway project: ynab-automation-production.up.railway.app — live and healthy
- PostgreSQL provisioned on Railway; DATABASE_URL auto-set; ProcessedEmail table migrated
- Inbound email: Pipedream address empk1lk0u08wjyn@upload.pipedream.net → /api/webhook
- Secrets confirmed: ANTHROPIC_API_KEY (sk-ant-api03-*), YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL
- Pipedream payload shape: documented in .planning/phases/02-email-inflow/PAYLOAD.md
- Payload routing key: trigger.event.headers.from.value[0].address (forwarding user's email)
- Payload dedup key: trigger.event.headers["message-id"]
- Amazon sender detection: scan trigger.event.body.html for @amazon.co.uk or @amazon.com in blockquote
- Confirmed Amazon sender: auto-confirm@amazon.co.uk

---

## Session Continuity

**Last Session:** 2026-03-24T12:18:00Z
**Stopped At:** Completed 03-02-PLAN.md — Claude parsing lib and YNAB client lib implemented
**Next Steps:** Execute 03-03 (wire libs into webhook route.ts, end-to-end smoke test)

---

## Blockers & Todos

- [x] Set up inbound email routing — done via Pipedream (empk1lk0u08wjyn@upload.pipedream.net)
- [x] Provision PostgreSQL on Railway — done; ProcessedEmail table migrated
- [x] Add env vars to Railway service — done (ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL)
- [x] Phase 02: Determine Pipedream webhook JSON envelope format before building email parser — done (02-01)
- [x] Phase 02: Implement email deduplication, sender detection, and non-Amazon filtering — done (02-02)
- [x] Phase 03: Create Claude parsing lib (parseAmazonEmail) — done (03-02)
- [x] Phase 03: Create YNAB client lib (createYnabTransaction) — done (03-02)
- [ ] Phase 03: Wire libs into webhook route.ts and smoke test end-to-end (03-03)

---

*State updated after 03-02 execution (2026-03-24).*
