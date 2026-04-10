---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Single-Tenant Rollback
status: defining_requirements
stopped_at: null
last_updated: "2026-04-10T10:45:00Z"
last_activity: "2026-04-10 - Milestone v6.0 started"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Amazon to YNAB Automation — Project State

**Updated:** 2026-04-10

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.
**Current focus:** v6.0 Single-Tenant Rollback — Defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-10 — Milestone v6.0 started

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.

**v6.0 kickoff decisions (2026-04-10):**
- Target audience: non-programmers self-hosting via Railway one-click deploy
- Auth: restore iron-session single admin password (v4.0 pattern)
- YNAB: restore Personal Access Token, drop OAuth + encrypted token storage
- Email ingestion: keep Pipedream `/api/webhook` (active path), delete Phase 18 `/api/email/inbound` as dead code
- First-install wizard: DB-backed settings (not Railway API), step-by-step instructions per API
- Data migration: preserve activity log, settings, sender/currency rules; drop Auth.js tables and userId columns
- Multi-tenancy: parked for possible future commercialisation, not in this milestone

### Pending Todos

None yet.

### Blockers/Concerns

- 10 failing tests from v5.0 era need cleanup (webhook route tests, multi-tenant isolation, YNAB OAuth) — bundled into relevant phase cleanup
- Existing production deployment has live data — migration must preserve it

## Session Continuity

Last session: 2026-04-10T10:45:00Z
Stopped at: v6.0 milestone started, defining requirements
Resume file: None
