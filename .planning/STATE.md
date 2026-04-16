---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Single-Tenant Rollback
status: planning
stopped_at: Completed 27-03-PLAN.md
last_updated: "2026-04-16T15:57:04.352Z"
last_activity: 2026-04-16 — Roadmap created for v6.2
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 29
  completed_plans: 29
  percent: 0
---

# Amazon to YNAB Automation — Project State

**Updated:** 2026-04-16

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.
**Current focus:** v6.2 Settings & UX Polish — restructure settings nav, remove Amazon-specific labels, make forwarding address prominent

## Current Position

Phase: 27 — Settings Restructure & Label Cleanup
Plan: —
Status: Not started (roadmapped, ready for planning)
Last activity: 2026-04-16 — Roadmap created for v6.2

Progress: [░░░░░░░░░░] 0%

## Roadmap Summary (v6.2)

| Phase | Name | Requirements | Depends On |
|-------|------|--------------|------------|
| 27 | Settings Restructure & Label Cleanup | LABEL-01, NAV-01, NAV-02 | Phase 26 |
| 28 | Forwarding Address Prominence | FWD-01, FWD-02 | Phase 27 |

**Coverage:** 5/5 v1 requirements mapped (100%).

**Workflow note:** All changes in this milestone stay local until user manually tests at production. No git push until user signs off.

## Roadmap Summary (v6.1, archived)

| Phase | Name | Requirements | Depends On |
|-------|------|--------------|------------|
| 26 | README & Onboarding Polish | README-01/02/03/04/05 | Phase 25 |

## Roadmap Summary (v6.0, archived)

| Phase | Name | Requirements | Depends On |
|-------|------|--------------|------------|
| 20 | Schema Rollback Migration | DATA-05/06/07/08 | — |
| 21 | iron-session Admin Auth Restoration | AUTH-04/05/06/07, DASH-07, CLEAN-02 | 20 |
| 22 | YNAB PAT & Settings API Keys | YNAB-06/07/08/09, CONFIG-01/02/03/04/05, DASH-06, CLEAN-01 | 21 |
| 23 | First-Install Wizard & Route State Machine | WIZ-01/02/03/04/05, DASH-08, CLEAN-03 | 22 |
| 24 | Test Suite Cleanup & Self-Host Docs | CLEAN-04, DOCS-01/02/03 | 23 |
| 25 | Self-Host Polish | LEGAL-01/02/03, POLISH-01/02 | 24 |

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
- [Phase 22-ynab-pat-settings-api-keys]: PAT read inline with getSetting directly in route handlers — getValidYnabToken in ynab.ts is unexported by design
- [Phase 22-ynab-pat-settings-api-keys]: Accounts route filters both deleted and closed YNAB accounts — closed accounts are archived and no longer usable
- [Phase 22-ynab-pat-settings-api-keys]: ApiKeysSection duplicates YNAB PAT field intentionally — CONFIG-01 requires all keys visible in one place; sections sync via DB on page refresh
- [Phase 22-ynab-pat-settings-api-keys]: settings/page.tsx reads budgetId server-side from getSetting — avoids client-side waterfall for initial connected state passed to SenderRules/CurrencyRules
- [Phase 23-01]: deriveWizardStep() is read-only — writing WIZARD_COMPLETE is the responsibility of the step 6 save action
- [Phase 23-01]: Step API route POST /api/setup/step is public (no auth guard) — wizard runs before ADMIN_PASSWORD exists
- [Phase 23-01]: WizardStep interface (not as const) used for key: string | string[] to avoid TypeScript union narrowing issues
- [Phase 23]: layout.tsx reads x-pathname (forwarded by middleware) to skip WIZARD_COMPLETE redirect on /setup/done — preserves success page visibility
- [Phase 23-03]: page.tsx calls getSetting('WIZARD_COMPLETE') then deriveWizardStep() only when needed — avoids extra DB queries on installed+authenticated hot path
- [Phase 23-03]: Dashboard layout WIZARD_COMPLETE gate redirects to /setup (not /setup/1) — setup layout's page.tsx calls deriveWizardStep() to find exact step
- [Phase 24-01]: loadDbSettings() deleted entirely — all callers updated to use getSetting() directly; DB is single source of truth for runtime settings
- [Phase 24-01]: process.env.TEST_MODE and process.env.YNAB_BUDGET_ID in route handlers replaced with getSetting() calls; framework secrets (DATABASE_URL, IRON_SESSION_SECRET) remain as direct process.env.X reads
- [Phase 24-test-suite-cleanup-and-self-host-docs]: Deploy button uses railway.com/new/template?template=<github-url>&plugins=postgresql — no Railway dashboard registration required
- [Phase 24-test-suite-cleanup-and-self-host-docs]: README replaces v5.0 env-var setup guide entirely — wizard is the only install path documented for non-programmers
- [Phase 24-02]: INBOUND_EMAIL is the single key for Pipedream forwarding address — aligns wizard step 6 with dashboard which already reads this key
- [Phase 24-02]: Wizard screenshots captured via Railway TCP proxy psql (clear WIZARD_COMPLETE, Playwright capture, restore) — safe atomic operation
- [Phase 25-self-host-polish]: LICENSE file created from scratch (did not exist) — MIT text with NOTICE preamble
- [Phase 25-self-host-polish]: No-warranty and AI-generated disclosures placed as blockquotes above the Deploy button in README.md
- [Phase 25-self-host-polish]: license-checker --production restricts scan to runtime deps; self-hosted Apache-2.0 attribution satisfied by node_modules LICENSE files
- [Phase 25-self-host-polish]: Dedicated ynab-screenshots Railway project created for dummy-data screenshot capture — ynab-test-production not touched
- [Phase 25-self-host-polish]: Wizard screenshots collected into single <details> block at end of Step 9 — all 7 images accessible, text instructions remain visible outside collapsible
- [Quick-7]: IRON_SESSION_SECRET auto-generated at runtime and cached in DB Setting table — env var is optional override only
- [Quick-7]: Railway template uses official postgres:16 with volume at /var/lib/postgresql (parent, not /data) so default PGDATA works without env var
- [Quick-7]: DATABASE_URL on ynab-app uses Railway reference vars (${{Postgres.POSTGRES_PASSWORD}}, etc.) — auto-wired on deploy
- [Quick-7]: RESET_PASSWORD=true env var clears ADMIN_PASSWORD + WIZARD_COMPLETE via /api/setup/reset, re-triggers wizard step 1
- [Quick-7]: Railway template code bIms_s — verified zero required fields; true one-click deploy

**v6.1 roadmap decisions (2026-04-16):**
- Single phase (26) for all 5 README-only requirements — coarse granularity, natural delivery boundary, no code changes involved
- All requirements (README-01 through README-05) target the same file (README.md); bundling avoids partial-edit churn
- [Phase 26]: Problem statement leads with YNAB payee-categorization pain point (Amazon multi-category example) rather than generic one-liner
- [Phase 26]: Deploy button converted to HTML anchor with target='_blank'; Install reduced to 3 steps; Prerequisites table removed; Steps 10/11 renamed to After Setup

**v6.2 roadmap decisions (2026-04-16):**
- Two phases for 5 requirements — coarse granularity; natural split between nav/settings area (27) and dashboard/wizard area (28)
- LABEL-01 bundled with NAV-01/NAV-02 in Phase 27 — all three touch wizard step 3 or settings-area pages; one code review, one test sweep
- FWD-01 and FWD-02 isolated in Phase 28 — both are about forwarding address surfacing; dashboard card and wizard done page can be built and tested together
- Phase 28 depends on Phase 27 because nav restructure must be stable before modifying dashboard layout
- No git push until user manually tests at production — local testing is the gate for each phase
- [Phase 27-settings-restructure-and-label-cleanup]: Two JSX string literals replaced in wizard step 3 and setup/done; no logic, imports, or structure changed
- [Phase 27-02]: Rules page imports SenderRulesSection and CurrencyRulesSection from ../settings/ — components stay co-located with their server actions, only rendering location changes
- [Phase 27-02]: settings/page.tsx removes budgetId/connected reads entirely — not even passed through, since no consumers remain on that page after the split
- [Phase 27-settings-restructure-and-label-cleanup]: [Phase 27-03]: SettingsForm stays co-located under settings/ folder; tools/page.tsx imports via '../settings/SettingsForm' — same pattern as rules page split in plan 02

### Pending Todos

None. Next: `/gsd:plan-phase 27`.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 7 | Zero-config Railway deploy | 2026-04-16 | bc2aa41 | [7-zero-config-railway-deploy](./quick/7-zero-config-railway-deploy/) |

## Session Continuity

Last session: 2026-04-16T15:50:44.679Z
Stopped at: Completed 27-03-PLAN.md
Resume file: None
