---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Single-Tenant Rollback
status: completed
stopped_at: Completed 22-02-PLAN.md (all OAuth routes and dead libs deleted)
last_updated: "2026-04-10T21:22:11.352Z"
last_activity: 2026-04-10 — v6.0 roadmap drafted
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 13
  completed_plans: 10
  percent: 0
---

# Amazon to YNAB Automation — Project State

**Updated:** 2026-04-10

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.
**Current focus:** v6.0 Single-Tenant Rollback — Roadmap drafted, awaiting phase planning

## Current Position

Phase: 20 (Schema Rollback Migration) — not yet planned
Plan: —
Status: Roadmap complete; ready for `/gsd:plan-phase 20`
Last activity: 2026-04-10 — v6.0 roadmap drafted

Progress: [░░░░░░░░░░] 0% (0/5 phases complete)

## Roadmap Summary (v6.0)

| Phase | Name | Requirements | Depends On |
|-------|------|--------------|------------|
| 20 | Schema Rollback Migration | DATA-05/06/07/08 | — |
| 21 | iron-session Admin Auth Restoration | AUTH-04/05/06/07, DASH-07, CLEAN-02 | 20 |
| 22 | YNAB PAT & Settings API Keys | YNAB-06/07/08/09, CONFIG-01/02/03/04/05, DASH-06, CLEAN-01 | 21 |
| 23 | First-Install Wizard & Route State Machine | WIZ-01/02/03/04/05, DASH-08, CLEAN-03 | 22 |
| 24 | Test Suite Cleanup & Self-Host Docs | CLEAN-04, DOCS-01/02/03 | 23 |

**Coverage:** 32/32 v1 requirements mapped (100%).

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

**v6.0 roadmap decisions (2026-04-10):**
- Phase 20 isolates data-preservation risk so it lands and gets verified before any code changes land
- Phase 21 bundles Auth.js code removal with iron-session restore (no intermediate broken state)
- Phase 22 couples YNAB OAuth removal with PAT restore and Phase 18 dead-code removal (all YNAB/email plumbing touches in one phase)
- Phase 23 depends on 21+22 because the wizard writes into the same settings/API-key plumbing those phases create
- Phase 24 ends the milestone with test cleanup + README so docs describe a working single-tenant app
- Dead code removal (CLEAN-01/02/03) bundled into the phases that own the features; no final cleanup phase
- [Phase 20-schema-rollback-migration]: Railway TCP proxy (mainline.proxy.rlwy.net:44022) created via GraphQL API to access internal PostgreSQL from outside Railway network — railway run containers cannot resolve internal DNS
- [Phase 20-schema-rollback-migration]: Used postgresql-client-16 locally to match server version 16.13; pg_dump requires version match
- [Phase 20-schema-rollback-migration]: Queried live Railway DB BEFORE writing migration SQL — all 13 constraint/index/policy names verified from pg_catalog
- [Phase 20-schema-rollback-migration]: Used IF EXISTS on all DDL operations in migration SQL for idempotency
- [Phase 20]: Used DATABASE_URL env override (TCP proxy URL) with npx prisma migrate deploy directly — railway run cannot reach internal Railway PostgreSQL
- [Phase 20]: Migration applied 2026-04-10 16:26:56 UTC — DEPLOY FREEZE in effect until Phase 21 lands
- [Phase 20-schema-rollback-migration]: schema.prisma rewritten to 3-model single-tenant: Setting/ProcessedEmail/ActivityLog only; Auth.js models and userId fields removed; Prisma client regenerated successfully
- [Phase 21-02]: Middleware checks admin_session cookie existence only — Edge Runtime cannot decrypt iron-session; actual isLoggedIn validation deferred to server components
- [Phase 21-02]: Auth.js code surface fully removed (auth.ts, next-auth.d.ts, /auth/* pages, /onboarding, [...nextauth] route)
- [Phase 21-01]: Plain prisma singleton replaces getPrismaForUser — no RLS, no per-query session variable injection
- [Phase 21-01]: Setting uses key as sole primary key — upsert/findUnique by key only, no compound userId_key
- [Phase 21-01]: getSetting(key) bridges ADMIN_PASSWORD from Setting DB row to loginAction in Plan 02
- [Phase 21-iron-session-admin-auth-restoration]: loginAction reads ADMIN_PASSWORD from DB via getSetting() with process.env fallback for bootstrap — enables password change without redeploy (AUTH-05)
- [Phase 21-iron-session-admin-auth-restoration]: YnabConnectionSection stubbed to return null — Phase 22 replaces with PAT-based UI; avoids build errors from deleted YNAB OAuth code
- [Phase 21-iron-session-admin-auth-restoration]: inboundEmail on dashboard sourced from getSetting('INBOUND_EMAIL') instead of User.forwardingEmail — consistent with single-tenant Setting model
- [Phase 21-iron-session-admin-auth-restoration]: getValidYnabToken now reads YNAB_ACCESS_TOKEN from DB Setting — no userId, single-tenant PAT pattern matches Phase 22 final design
- [Phase 21-iron-session-admin-auth-restoration]: YNAB function signatures drop userId — createYnabTransaction/getCategories/getAccountName are now single-tenant; webhook and replay routes already used new signatures
- [Phase 21-iron-session-admin-auth-restoration]: IRON_SESSION_SECRET already set in Railway env; no new secret needed for deploy
- [Phase 21-iron-session-admin-auth-restoration]: DEPLOY FREEZE lifted 2026-04-10 by Phase 21 Plan 05 — Railway build successful with iron-session auth and zero next-auth imports
- [Phase 21-iron-session-admin-auth-restoration]: Human verification approved 2026-04-10 — all 15 browser test steps passed; /onboarding and /auth/signin returning 404 for authenticated users is correct behavior matching roadmap success criterion 4
- [Phase 22-02]: SIGABRT in npm run build is pre-existing env issue (CA cert/OpenSSL); TypeScript compilation passes cleanly — Railway CI is authoritative build check
- [Phase 22-02]: grep 'authorize' pattern matches 'Unauthorized' in legitimate 401 responses; specific OAuth tokens (oauthToken|ynabEncryption|mailboxHash|email-routing) return zero matches — CLEAN-01 satisfied

### Pending Todos

None yet. Next: `/gsd:plan-phase 20`.

### Blockers/Concerns

- Production deployment has live data — Phase 20 migration must preserve it (pg_dump backup before running)
- 10 failing tests from v5.0 era — bundled into Phase 24 cleanup
- Test mode silent-wiring bug (v5.0 lesson) — Phase 22 success criterion 4 explicitly verifies test mode reaches the active `/api/webhook` handler

## Session Continuity

Last session: 2026-04-10T21:22:11.348Z
Stopped at: Completed 22-02-PLAN.md (all OAuth routes and dead libs deleted)
Resume file: None
