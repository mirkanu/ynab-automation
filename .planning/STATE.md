---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Generic & Publishable
status: complete
stopped_at: "Completed 09-01-PLAN.md — setup wizard"
last_updated: "2026-03-26T10:55:00.000Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 3
  completed_plans: 3
  percent: 100
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
**Phase:** Phase 9 — Setup wizard (complete)
**Status:** All plans complete
**Progress:** [██████████████] 100%

---

## v3.0 Phase Overview

| Phase | Goal | Status |
|-------|------|--------|
| 7. Config-driven routing | SENDERS JSON env var replaces hardcoded map; all personal refs removed | Complete |
| 8. Publishing readiness | README setup guide, Railway migration, repo made public | Complete |
| 9. Setup wizard | Interactive config builder at app URL when unconfigured; YNAB account browser; generates env vars | Complete |

---

## Key Decisions (v3.0)

| Decision | Rationale |
|----------|-----------|
| SENDERS as JSON env var (not numbered env vars or config file) | Works natively on Railway/PaaS; supports any number of senders; no secrets in JSON |
| CURRENCY_ACCOUNTS as JSON env var | Same pattern as SENDERS; optional; clean generalisation of Euro routing |
| notificationLabel per sender (optional) | Replaces hardcoded senderLabel() — user controls which senders appear in notification subjects |
| loadConfig() called at handler entry (not module load) | Consistent with existing pattern for env var reading; simpler test isolation |
| Setup wizard: YNAB API called from browser (not server) | CORS supported by YNAB API; token never hits the Next.js server |
| Setup wizard: single-component wizard (no URL routing between steps) | Simpler state management; no back-button / URL complexity for a one-time setup flow |

---

## Session Continuity

**Last Session:** 2026-03-26
**Stopped At:** Completed 09-01-PLAN.md — setup wizard. v3.0 milestone complete.
**Next Steps:** v3.0 milestone fully complete. All phases done.
