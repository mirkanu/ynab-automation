# Amazon to YNAB Automation — Roadmap

## Milestones

- ✅ **v1.0** — Core pipeline: Pipedream → Claude → YNAB (2026-03-24)
- ✅ **v2.0** — Any retailer + category tagging (2026-03-25) → [archive](.planning/milestones/v2.0-ROADMAP.md)
- ✅ **v3.0** — Generic & publishable + setup wizard (2026-03-26) → [archive](.planning/milestones/v3.0-ROADMAP.md)
- ✅ **v4.0** — Admin Backend UI (2026-03-28) → [archive](.planning/milestones/v4.0-ROADMAP.md)
- 🚧 **v5.0** — Multi-Tenant SaaS (Phases 16-19) — in progress

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

### 🚧 v5.0 Multi-Tenant SaaS (In Progress)

**Milestone Goal:** Transform single-user automation into a multi-tenant SaaS where anyone can sign up, connect YNAB, and start processing forwarded receipts with zero technical setup.

- [x] **Phase 16: User Accounts & Multi-Tenant Foundation** — Auth.js sessions, multi-tenant DB schema with RLS, existing data migrated to user #1 (completed 2026-03-29)
- [ ] **Phase 17: YNAB OAuth & Token Management** — Per-user YNAB OAuth connect/disconnect, encrypted token storage, auto-refresh
- [ ] **Phase 18: Per-User Inbound Email** — Unique forwarding addresses, webhook routing by user, end-to-end email-to-YNAB for any user
- [ ] **Phase 19: Dashboard, Onboarding & Account Management** — Per-user dashboard, guided onboarding, settings, test mode, account deletion

## Phase Details

### Phase 16: User Accounts & Multi-Tenant Foundation
**Goal**: Any person can create an account and log in; all database tables are scoped and isolated by user
**Depends on**: Phase 15 (v4.0 complete)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A new user can sign up via email magic link and land on their dashboard
  2. A logged-in user's session persists after browser refresh and tab close/reopen
  3. A user can log out and is redirected to the login page
  4. No API endpoint returns another user's data — tenant isolation enforced at both app and DB (RLS) level
  5. Existing single-user data (activity log, settings) appears under the initial user account with no data loss
**Plans**: 4 plans

Plans:
- [ ] 16-01-PLAN.md — Auth.js install, schema (auth models + nullable userId), signin/signout pages
- [ ] 16-02-PLAN.md — Make userId NOT NULL, backfill existing rows to Manuel's user account
- [ ] 16-03-PLAN.md — PostgreSQL RLS, Prisma user middleware, API route auth enforcement
- [ ] 16-04-PLAN.md — Human verify checkpoint: magic link, session persistence, logout, isolation

### Phase 17: YNAB OAuth & Token Management
**Goal**: Users can connect their own YNAB account via OAuth, with tokens stored encrypted and refreshed automatically
**Depends on**: Phase 16
**Requirements**: YNAB-01, YNAB-02, YNAB-03, YNAB-04, YNAB-05
**Success Criteria** (what must be TRUE):
  1. User can click "Connect YNAB", complete the YNAB OAuth consent screen, and return to the app connected
  2. User can select their default YNAB budget and account after connecting
  3. User can disconnect YNAB (tokens revoked, connection status shows as disconnected)
  4. YNAB API calls succeed after token expiry without the user re-authenticating (auto-refresh)
  5. YNAB tokens are not visible in plaintext in the database (encrypted at rest)
**Plans**: 6 plans

Plans:
- [ ] 17-01-PLAN.md — AES-256-GCM crypto module + Prisma schema migration (token management fields)
- [ ] 17-02-PLAN.md — Wave 0 test scaffolds for YNAB-01, YNAB-03, YNAB-04, YNAB-05
- [ ] 17-03-PLAN.md — OAuth authorize + callback routes (YNAB consent flow, encrypted token storage)
- [ ] 17-04-PLAN.md — getValidYnabToken with proactive refresh + mutex; migrate ynab.ts to per-user tokens; disconnect route
- [ ] 17-05-PLAN.md — Budget/account selection API routes + settings page UI with connect/disconnect
- [ ] 17-06-PLAN.md — Human verify checkpoint: full OAuth flow, encrypted DB tokens, budget selection, disconnect

### Phase 18: Per-User Inbound Email
**Goal**: Every user has a unique forwarding address; forwarded emails are routed to the correct user and create YNAB transactions in their account
**Depends on**: Phase 17
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05
**Success Criteria** (what must be TRUE):
  1. Each user has a unique forwarding email address visible in their dashboard
  2. An email forwarded to User A's address creates a transaction in User A's YNAB account, not User B's
  3. Forwarding the same email twice does not create a duplicate YNAB transaction
  4. A forged/unsigned inbound webhook is rejected (returns 4xx, no transaction created)
  5. A forwarded order confirmation email results in a YNAB transaction with the correct amount, payee, and account
**Plans**: TBD

### Phase 19: Dashboard, Onboarding & Account Management
**Goal**: Users can see their automation activity, configure their setup, and a new user is guided from signup to first working transaction in under 5 minutes
**Depends on**: Phase 18
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, ONBD-01, ONBD-02, ONBD-03, ONBD-04
**Success Criteria** (what must be TRUE):
  1. A new user completing signup is guided step-by-step: connect YNAB → receive forwarding address → see forwarding instructions for their email client
  2. User can view their activity log showing processed emails, outcomes, and error details
  3. User can view their dashboard stats (total processed, success rate, last transaction)
  4. User can enable test mode and confirm forwarded emails parse without writing to YNAB
  5. User can delete their account and all associated data is removed
  6. A visitor landing on the homepage understands the product and can click through to sign up
**Plans**: TBD

## Progress

**Execution Order:** 16 → 17 → 18 → 19

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Deployment Retirement | v4.0 | 1/1 | Complete | 2026-03-26 |
| 11. Admin Authentication | v4.0 | 1/1 | Complete | 2026-03-26 |
| 12. Activity Log Infrastructure | v4.0 | 1/1 | Complete | 2026-03-27 |
| 13. Admin UI Shell + Dashboard + Log Viewer | v4.0 | 2/2 | Complete | 2026-03-27 |
| 14. Settings Editor | v4.0 | 1/1 | Complete | 2026-03-28 |
| 15. Test & Replay Tools | v4.0 | 1/1 | Complete | 2026-03-28 |
| 16. User Accounts & Multi-Tenant Foundation | v5.0 | 4/4 | Complete | 2026-03-29 |
| 17. YNAB OAuth & Token Management | 3/6 | In Progress|  | - |
| 18. Per-User Inbound Email | v5.0 | 0/? | Not started | - |
| 19. Dashboard, Onboarding & Account Management | v5.0 | 0/? | Not started | - |
