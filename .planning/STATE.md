---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Generic & Publishable
status: in-progress
stopped_at: Completed 07-01-PLAN.md — config-driven routing, all personal refs removed
last_updated: "2026-03-26T08:45:00.000Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 50
---

# Amazon to YNAB Automation — Project State

**Updated:** 2026-03-26

## Project Reference

**Core Value:** A forwarded order email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

**Users:** Manuel and Emily-Kate (two household members with separate YNAB accounts)

**Tech Stack:** Next.js (API routes) + PostgreSQL on Railway

**Key Constraint:** Reuse existing Railway infrastructure (already running Josie n8n + Claude); no new platforms.

---

## Current Position

**Milestone:** v3.0 — Generic & Publishable
**Phase:** Phase 7 — Config-driven routing (plan 01 complete)
**Status:** Phase 7 done; Phase 8 next
**Progress:** [█████░░░░░] 50%

---

## v3.0 Phase Overview

| Phase | Goal | Status |
|-------|------|--------|
| 7. Config-driven routing | SENDERS JSON env var replaces hardcoded map; all personal refs removed | Complete |
| 8. Publishing readiness | README setup guide, Railway migration, repo made public | Not started |

---

## Key Decisions (v3.0)

| Decision | Rationale |
|----------|-----------|
| SENDERS as JSON env var (not numbered env vars or config file) | Works natively on Railway/PaaS; supports any number of senders; no secrets in JSON |
| CURRENCY_ACCOUNTS as JSON env var | Same pattern as SENDERS; optional; clean generalisation of Euro routing |
| notificationLabel per sender (optional) | Replaces hardcoded senderLabel() — user controls which senders appear in notification subjects |
| loadConfig() called at handler entry (not module load) | Consistent with existing pattern for env var reading; simpler test isolation |

---

## Session Continuity

**Last Session:** 2026-03-26
**Stopped At:** Completed 07-01-PLAN.md — config-driven routing and all personal references removed
**Next Steps:** Execute 08-01-PLAN.md (README setup guide, Railway migration, make repo public).
