# Amazon to YNAB Automation — Roadmap

## Milestones

- ✅ **v1.0** — Core pipeline: Pipedream → Claude → YNAB (2026-03-24)
- ✅ **v2.0** — Any retailer + category tagging (2026-03-25) → [archive](.planning/milestones/v2.0-ROADMAP.md)
- ✅ **v3.0** — Generic & publishable + setup wizard (2026-03-26) → [archive](.planning/milestones/v3.0-ROADMAP.md)
- ✅ **v4.0** — Admin Backend UI (2026-03-28) → [archive](.planning/milestones/v4.0-ROADMAP.md)
- ✅ **v5.0** — Multi-Tenant SaaS (2026-04-10) → [archive](.planning/milestones/v5.0-ROADMAP.md)
- 🚧 **v6.0** — Single-Tenant Rollback (in progress)

## Phases

<details>
<summary>✅ v1.0 / v2.0 / v3.0 (Phases 1-9) - SHIPPED 2026-03-26</summary>

Phases 1-9 covered core pipeline, any-retailer support, category tagging, config-driven routing, and the interactive setup wizard. See archived roadmaps for detail.

</details>

<details>
<summary>✅ v4.0 Admin Backend UI (Phases 10-15) - SHIPPED 2026-03-28</summary>

- [x] Phase 10: Deployment Retirement (1/1 plans) — completed 2026-03-26
- [x] Phase 11: Admin Authentication (1/1 plans) — completed 2026-03-26
- [x] Phase 12: Activity Log Infrastructure (1/1 plans) — completed 2026-03-27
- [x] Phase 13: Admin UI Shell + Dashboard + Log Viewer (2/2 plans) — completed 2026-03-27
- [x] Phase 14: Settings Editor (1/1 plans) — completed 2026-03-28
- [x] Phase 15: Test & Replay Tools (1/1 plans) — completed 2026-03-28

</details>

<details>
<summary>✅ v5.0 Multi-Tenant SaaS (Phases 16-19) - SHIPPED 2026-04-10</summary>

- [x] Phase 16: User Accounts & Multi-Tenant Foundation (4/4 plans) — completed 2026-03-29
- [x] Phase 17: YNAB OAuth & Token Management (6/6 plans) — completed 2026-03-30
- [x] Phase 18: Per-User Inbound Email (5/5 plans) — completed 2026-03-30
- [x] Phase 19: Dashboard, Onboarding & Account Management (5/5 plans) — completed 2026-03-30

Bugs discovered post-facto during UAT (2026-04-10) and fixed:
- Middleware signin callbackUrl pointed to `localhost:8080` behind Railway's proxy (commit 80ee088)
- Test mode toggle was not wired into the active Pipedream webhook handler (commit f92e34c)

</details>

### 🚧 v6.0 Single-Tenant Rollback (Phases 20-24)

- [x] **Phase 20: Schema Rollback Migration** — Drop multi-tenant schema (Auth.js, userId, RLS, Phase 18 tables) while preserving activity log, settings, and routing rules (completed 2026-04-10)
- [x] **Phase 21: iron-session Admin Auth Restoration** — Replace Auth.js with single-admin iron-session auth and delete all Auth.js code paths (completed 2026-04-10)
- [ ] **Phase 22: YNAB PAT & Settings API Keys** — Swap YNAB OAuth for a DB-stored Personal Access Token and surface all API keys as editable settings
- [ ] **Phase 23: First-Install Wizard & Route State Machine** — Add a non-programmer multi-step setup wizard and unify root routing based on install/auth state
- [ ] **Phase 24: Test Suite Cleanup & Self-Host Docs** — Fix or delete stale v5.0 tests and ship README + Railway deploy button for non-programmers

## Phase Details

### Phase 20: Schema Rollback Migration
**Milestone:** v6.0
**Goal:** The production database has no multi-tenant machinery (Auth.js tables, userId columns, RLS policies, Phase 18 per-user email tables) while all existing single-household data — activity log, sender routing rules, currency routing rules, test mode toggle, other Setting rows — is preserved byte-for-byte.
**Depends on:** Nothing (first phase of v6.0; the app remains on v5.0 multi-tenant code during this phase — only the schema is walked back, with code fixes deferred to later phases that can read the simplified schema)
**Requirements:** DATA-05, DATA-06, DATA-07, DATA-08
**Success Criteria** (what must be TRUE):
  1. After running the rollback migration against production, every ActivityLog row present before the migration is still queryable and renders in the existing admin Activity Log UI with the same timestamps, email subjects, and traces.
  2. After the migration, the admin Settings page still loads the pre-migration `SENDERS`, `CURRENCY_ACCOUNTS`, `TEST_MODE`, and any other Setting rows; values match exactly what was in the DB before the migration (verified by snapshotting Setting rows pre/post and diffing).
  3. `psql` inspection of the production schema shows no `User`, `Account`, `Session`, `VerificationToken`, `EmailForwardingAddress`, or `ProcessedWebhook` tables; no `userId` columns on any remaining table; no RLS policies (`SELECT * FROM pg_policies` returns empty).
  4. The migration is idempotent and reversible-in-theory via a pre-migration `pg_dump` backup captured as part of the phase, so a failed migration can be rolled back without data loss.
**Plans:** 4/4 plans complete

Plans:
- [ ] 20-01-PLAN.md — Capture pg_dump backup and pre-migration data snapshot
- [ ] 20-02-PLAN.md — Write and verify the rollback migration SQL file
- [ ] 20-03-PLAN.md — Deploy migration to Railway production and verify all success criteria
- [ ] 20-04-PLAN.md — Update prisma/schema.prisma to single-tenant state and regenerate client

### Phase 21: iron-session Admin Auth Restoration
**Milestone:** v6.0
**Goal:** A single admin password — stored in the DB, editable from settings — protects every dashboard, settings, and API route via iron-session cookies; Auth.js is completely excised from the codebase and `package.json`.
**Depends on:** Phase 20 (schema must be free of Auth.js/userId constraints before Auth.js code can be removed without breaking Prisma queries)
**Requirements:** AUTH-04, AUTH-05, AUTH-06, AUTH-07, DASH-07, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. A fresh incognito visit to `https://ynab-test-production.up.railway.app/dashboard` redirects to `/login`; entering the admin password succeeds and the dashboard loads; reloading the tab keeps the admin logged in (iron-session cookie persists).
  2. Unauthenticated `curl` requests to any `/api/*` route that mutates data return HTTP 401 with a JSON error body.
  3. The admin visits Settings, enters a new admin password, saves, logs out, and can log back in with the new password; the old password no longer works — all without a redeploy or env var change.
  4. `grep -r "next-auth\|@auth/core\|authOptions" src/` returns zero matches; `package.json` contains no `next-auth` or `@auth/*` dependencies; `/onboarding`, magic-link signin page, and GDPR account deletion UI return 404.
  5. `src/lib/db.ts` exports a plain `prisma` client with no `getPrismaForUser` helper and no RLS-setting `$extends` middleware (verified by file diff).
**Plans:** 5/5 plans complete

Plans:
- [ ] 21-01-PLAN.md — Rewrite data-layer libs (db.ts, settings.ts, activity-log.ts, activity-log-queries.ts) to single-tenant schema
- [ ] 21-02-PLAN.md — Replace Auth.js middleware; delete auth.ts, /auth pages, /onboarding pages
- [ ] 21-03-PLAN.md — Rewire UI routes and API routes to iron-session; add password-change Settings section
- [ ] 21-04-PLAN.md — Remove next-auth/@auth/prisma-adapter from package.json; stub YNAB OAuth routes; verify local build
- [ ] 21-05-PLAN.md — Deploy to Railway (lift DEPLOY FREEZE); smoke-test all success criteria; human checkpoint

### Phase 22: YNAB PAT & Settings API Keys
**Milestone:** v6.0
**Goal:** The app talks to YNAB exclusively via a Personal Access Token stored as a DB setting, the Settings page exposes every runtime secret (YNAB PAT, Claude key, Resend key, Pipedream webhook URL) as editable fields, the Pipedream email path still delivers forwarded emails to YNAB end-to-end, and the Phase 18 dead-code email path is removed.
**Depends on:** Phase 21 (Settings API routes must be protected by iron-session before secrets can be exposed there; also, deleting YNAB OAuth code depends on Auth.js already being gone since they share middleware touchpoints)
**Requirements:** YNAB-06, YNAB-07, YNAB-08, YNAB-09, CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, DASH-06, CLEAN-01
**Success Criteria** (what must be TRUE):
  1. The admin pastes a YNAB PAT into Settings, saves, and without a redeploy the YNAB budget dropdown populates with live budgets from the YNAB API; selecting a budget populates the account dropdown with that budget's accounts; selections persist.
  2. A live Pipedream-forwarded order confirmation email results in a new transaction in the selected YNAB account within 60 seconds, verified by the Activity Log showing a green "YNAB transaction created" trace row and the transaction appearing in the YNAB UI.
  3. The Settings page "API Keys" section shows editable fields for YNAB PAT, Anthropic Claude API key, Resend API key, and Pipedream webhook URL; changing the Claude key and submitting a replay immediately uses the new key (verified by rotating to an invalid key and seeing a Claude auth error in the replay trace).
  4. Sender routing rules, currency-based account routing rules, and the test mode toggle all load, edit, and save correctly on the restored Settings page; toggling test mode ON and forwarding an email produces an Activity Log entry with no corresponding YNAB transaction (confirms test mode reaches the active `/api/webhook` handler, closing the v5.0 UAT gap).
  5. `grep -r "authorize\|oauthToken\|oauthRefreshToken\|ynabEncryption\|mailboxHash\|email-routing" src/` returns zero matches; `/api/ynab/authorize`, `/api/ynab/callback`, `/api/email/inbound`, `src/lib/crypto.ts`, `src/lib/email-routing.ts`, and `src/lib/mailbox-hash.ts` do not exist on disk.
**Plans:** 4 plans

Plans:
- [ ] 22-01-PLAN.md — TBD
- [ ] 22-02-PLAN.md — TBD
- [ ] 22-03-PLAN.md — TBD
- [ ] 22-04-PLAN.md — TBD

### Phase 23: First-Install Wizard & Route State Machine
**Milestone:** v6.0
**Goal:** A brand-new Railway deployment walks a non-programmer through setting the admin password and every API key in a multi-step wizard with plain-language instructions, saves progress as they go, never runs again after completion, and the root route intelligently dispatches to `/setup`, `/login`, or `/dashboard` based on install and auth state.
**Depends on:** Phase 22 (the wizard writes into the same DB-backed Settings that Phase 22 makes editable; also depends on Phase 21 for admin-password storage)
**Requirements:** WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05, DASH-08, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. On a fresh Railway deployment with an empty Settings table, visiting the app root redirects to `/setup` step 1; completing all steps (admin password → YNAB PAT → budget/account → Claude key → Resend key → Pipedream webhook URL) results in a working single-tenant install where the next visit to `/` routes to `/login` (and after login, `/dashboard`).
  2. Mid-wizard, the non-programmer closes the browser tab after step 3; reopening the app returns them to step 4 with steps 1-3 values already saved to the DB (verified by `SELECT * FROM "Setting"` showing the entered values).
  3. Each wizard step displays numbered plain-language instructions and a direct link to the provider's API key page (ynab.com/settings/developer, console.anthropic.com, resend.com/api-keys, pipedream.com) — verified by eyeballing the rendered `/setup/*` pages.
  4. After wizard completion, `wizard_complete` is `true` in the DB; manually visiting `/setup` redirects to `/dashboard` (authenticated) or `/login` (unauthenticated); the wizard cannot be accidentally re-run.
  5. `src/app/onboarding/`, `src/app/(dashboard)/settings/DangerZone.tsx`, and `src/app/api/account/delete/` do not exist on disk; test mode toggling is handled by the single Settings endpoint (no separate DangerZone handler).
**Plans:** 4 plans

Plans:
- [ ] 23-01-PLAN.md — TBD
- [ ] 23-02-PLAN.md — TBD
- [ ] 23-03-PLAN.md — TBD
- [ ] 23-04-PLAN.md — TBD

### Phase 24: Test Suite Cleanup & Self-Host Docs
**Milestone:** v6.0
**Goal:** `npm test` is fully green locally and in CI with zero skipped or failing tests, and the README makes a non-programmer able to go from "clicked a GitHub link" to "forwarding emails into YNAB" using only numbered instructions and screenshots with no code edits.
**Depends on:** Phase 23 (README walks the user through the wizard, so the wizard must exist and work before docs describe it)
**Requirements:** CLEAN-04, DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. `npm test` reports zero failing and zero skipped tests; the 10 v5.0-era failing tests are either rewritten against the simplified single-tenant schema or deleted, with deletions justified per-file in the phase summary.
  2. The README's "Deploy on Railway" button, when clicked by the roadmapper as a dry-run test, produces a Railway deployment template that provisions PostgreSQL, sets `DATABASE_URL`, and auto-generates an `IRON_SESSION_SECRET` — verified by the Railway template preview screen.
  3. The README walks end-to-end from "click deploy" through "complete wizard" to "forward first email" with numbered steps and at least one screenshot per major step; the flow has been dry-run by the roadmapper or user against the live deployment without consulting any file outside the README.
  4. The README's "costs" section names each paid provider (Claude, Resend, Railway hobby tier) with a link to its pricing page and a plain-language expectation ("likely a few cents per month at household volume") — no hard dollar amounts that will age.
**Plans:** 4 plans

Plans:
- [ ] 24-01-PLAN.md — TBD
- [ ] 24-02-PLAN.md — TBD
- [ ] 24-03-PLAN.md — TBD
- [ ] 24-04-PLAN.md — TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Deployment Retirement | v4.0 | 1/1 | Complete | 2026-03-26 |
| 11. Admin Authentication | v4.0 | 1/1 | Complete | 2026-03-26 |
| 12. Activity Log Infrastructure | v4.0 | 1/1 | Complete | 2026-03-27 |
| 13. Admin UI Shell + Dashboard + Log Viewer | v4.0 | 2/2 | Complete | 2026-03-27 |
| 14. Settings Editor | v4.0 | 1/1 | Complete | 2026-03-28 |
| 15. Test & Replay Tools | v4.0 | 1/1 | Complete | 2026-03-28 |
| 16. User Accounts & Multi-Tenant Foundation | v5.0 | 4/4 | Complete | 2026-03-29 |
| 17. YNAB OAuth & Token Management | v5.0 | 6/6 | Complete | 2026-03-30 |
| 18. Per-User Inbound Email | v5.0 | 5/5 | Complete | 2026-03-30 |
| 19. Dashboard, Onboarding & Account Management | v5.0 | 5/5 | Complete | 2026-03-30 |
| 20. Schema Rollback Migration | v6.0 | 4/4 | Complete | 2026-04-10 |
| 21. iron-session Admin Auth Restoration | 5/5 | Complete   | 2026-04-10 | — |
| 22. YNAB PAT & Settings API Keys | v6.0 | 0/4 | Not started | — |
| 23. First-Install Wizard & Route State Machine | v6.0 | 0/4 | Not started | — |
| 24. Test Suite Cleanup & Self-Host Docs | v6.0 | 0/4 | Not started | — |
