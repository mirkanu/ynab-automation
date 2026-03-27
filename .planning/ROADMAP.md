# Amazon to YNAB Automation — Roadmap

## Milestones

- ✅ **v1.0** — Core pipeline: Pipedream → Claude → YNAB (2026-03-24)
- ✅ **v2.0** — Any retailer + category tagging (2026-03-25) → [archive](.planning/milestones/v2.0-ROADMAP.md)
- ✅ **v3.0** — Generic & publishable + setup wizard (2026-03-26) → [archive](.planning/milestones/v3.0-ROADMAP.md)
- 🚧 **v4.0 Admin Backend UI** — Phases 10-15 (in progress)

## Phases

<details>
<summary>✅ v1.0 / v2.0 / v3.0 (Phases 1-9) - SHIPPED 2026-03-26</summary>

Phases 1-9 covered core pipeline, any-retailer support, category tagging, config-driven routing, and the interactive setup wizard. See archived roadmaps for detail.

</details>

### 🚧 v4.0 Admin Backend UI (In Progress)

**Milestone Goal:** Password-protected admin UI for configuration, monitoring, and testing — making the app fully self-serviceable without touching environment variables or raw logs.

- [x] **Phase 10: Deployment Retirement** - Decommission old Railway deployment and update docs (completed 2026-03-26)
- [x] **Phase 11: Admin Authentication** - Password-protected /admin routes with cookie sessions (completed 2026-03-26)
- [ ] **Phase 12: Activity Log Infrastructure** - DB schema and write path for full pipeline logging
- [ ] **Phase 13: Admin UI Shell + Dashboard + Log Viewer** - Shell, stats dashboard, and log viewer with filters
- [ ] **Phase 14: Settings Editor** - In-UI editing of all env vars with Railway API sync
- [ ] **Phase 15: Test & Replay Tools** - Email parse preview and logged-email replay

## Phase Details

### Phase 10: Deployment Retirement
**Goal**: The old Railway deployment is gone and all documentation points to the new instance only
**Depends on**: Nothing (standalone cleanup)
**Requirements**: DEPL-01, DEPL-02
**Success Criteria** (what must be TRUE):
  1. The old Railway service no longer receives or processes any traffic
  2. README and all documentation reference only the current deployment URL with no dead links
**Plans**: 1 plan
Plans:
- [x] 10-01-PLAN.md — Update docs to new deployment URL + decommission old Railway service (completed 2026-03-26)

### Phase 11: Admin Authentication
**Goal**: Users can securely access the /admin area and their session persists without re-login
**Depends on**: Phase 10
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Visiting any /admin route without a session redirects to /admin/login
  2. Entering the correct ADMIN_PASSWORD grants access and sets a persistent cookie
  3. The session survives a page refresh without requiring re-login
  4. Clicking logout clears the session and returns the user to /admin/login
**Plans**: 1 plan
Plans:
- [x] 11-01-PLAN.md — Install iron-session, create middleware, login/logout flow, admin layout and dashboard placeholder (completed 2026-03-26)

### Phase 12: Activity Log Infrastructure
**Goal**: Every email processed by the pipeline is durably recorded in the database with full trace data
**Depends on**: Phase 11
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04
**Success Criteria** (what must be TRUE):
  1. Forwarding an email creates a DB record containing the sender address, subject, timestamp, and raw body
  2. The DB record includes the Claude parse output (retailer, amount, date, currency)
  3. The DB record includes the YNAB result (success/fail, transaction ID, amount, account)
  4. Pipeline errors are captured in the DB record with error type and full message
**Plans**: 1 plan
Plans:
- [x] 12-01-PLAN.md — Add ActivityLog model, writeActivityLog helper, and instrument webhook handler (completed 2026-03-27)

### Phase 13: Admin UI Shell + Dashboard + Log Viewer
**Goal**: An authenticated admin visits /admin and can see pipeline health at a glance and drill into individual email logs
**Depends on**: Phase 12
**Requirements**: LOG-05, LOG-06, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. The /admin dashboard displays emails processed this week and overall success rate
  2. The last processed transaction is shown with retailer, amount, account, and timestamp
  3. The webhook inbound URL is displayed prominently with a working one-click copy button
  4. The log view lists entries filterable by status and date range, with pagination
  5. Clicking a log row expands the full request trace (raw email, parse result, YNAB outcome, any errors)
**Plans**: 2 plans
Plans:
- [x] 13-01-PLAN.md — Dashboard with stats, webhook URL, navigation (DASH-01, DASH-02, DASH-03) (completed 2026-03-27)
- [x] 13-02-PLAN.md — Activity log viewer with filters, pagination, expandable rows (LOG-05, LOG-06) (completed 2026-03-27)

### Phase 14: Settings Editor
**Goal**: An admin can view and update all routing and API configuration from the UI without touching Railway directly
**Depends on**: Phase 13
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05
**Success Criteria** (what must be TRUE):
  1. SENDERS routing entries can be added, edited, and removed from the UI
  2. CURRENCY_ACCOUNTS entries can be added, edited, and removed from the UI
  3. API keys (YNAB_API_KEY, RESEND_API_KEY, RAILWAY_API_TOKEN) are editable in the UI
  4. Other env vars (ADMIN_EMAIL, NOTIFICATION_LABEL, etc.) are editable in the UI
  5. Saving settings applies the changes to Railway env vars via the API (same mechanism as setup wizard)
**Plans**: TBD

### Phase 15: Test & Replay Tools
**Goal**: An admin can validate Claude parsing without side effects and re-run any past email through the full pipeline
**Depends on**: Phase 14
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Pasting email content and submitting shows the Claude parse result (retailer, amount, date) without creating a YNAB transaction
  2. Clicking replay on a log entry re-runs that email through the full pipeline and creates a real YNAB transaction
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Deployment Retirement | 1/1 | Complete    | 2026-03-26 | - |
| 11. Admin Authentication | v4.0 | 1/1 | Complete | 2026-03-26 |
| 12. Activity Log Infrastructure | v4.0 | 1/1 | Complete | 2026-03-27 |
| 13. Admin UI Shell + Dashboard + Log Viewer | v4.0 | 2/2 | Complete | 2026-03-27 |
| 14. Settings Editor | v4.0 | 0/TBD | Not started | - |
| 15. Test & Replay Tools | v4.0 | 0/TBD | Not started | - |
