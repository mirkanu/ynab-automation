# Requirements: Amazon to YNAB Automation — v6.0 Single-Tenant Rollback

**Defined:** 2026-04-10
**Core Value:** Forwarded order confirmation email → YNAB transaction, fully automated, with zero per-transaction effort.
**Target User:** Non-programmers self-hosting the app on Railway via a one-click deploy button.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Data & Schema

- [x] **DATA-05**: Existing activity log entries survive the rollback migration with no data loss
- [x] **DATA-06**: Existing settings (sender routing rules, currency routing rules, test mode, other Setting rows) survive the rollback migration
- [x] **DATA-07**: Auth.js tables (User, Account, Session, VerificationToken), Phase 18 tables (EmailForwardingAddress, ProcessedWebhook), and `userId` columns are dropped cleanly with no orphaned rows or broken foreign keys
- [x] **DATA-08**: PostgreSQL Row-Level Security policies are removed from all tables (no longer needed for single tenant)

### Authentication

- [x] **AUTH-04**: A single admin password protects the dashboard and settings via iron-session cookie-based auth
- [x] **AUTH-05**: Admin can change the admin password via the settings page without editing env vars or redeploying
- [x] **AUTH-06**: Unauthenticated visitors to `/dashboard`, `/settings`, and other protected routes are redirected to `/login`; unauthenticated API calls return HTTP 401
- [x] **AUTH-07**: Auth.js dependency is fully removed from `package.json`, `src/lib/auth.ts`, signin/signout pages, and all middleware imports

### YNAB Configuration

- [ ] **YNAB-06**: YNAB API calls use a Personal Access Token stored as a DB setting (not OAuth)
- [ ] **YNAB-07**: Admin can paste a new YNAB PAT in settings and it takes effect immediately (no redeploy)
- [ ] **YNAB-08**: YNAB OAuth flow code is fully removed: `/api/ynab/authorize`, `/api/ynab/callback`, `src/lib/crypto.ts`, proactive refresh logic, and the `oauthToken`/`oauthRefreshToken`/`oauthExpiresAt` schema fields
- [ ] **YNAB-09**: Admin selects a YNAB budget and account via live dropdowns in settings (values fetched from YNAB API using the configured PAT)

### Settings & Config UI

- [ ] **CONFIG-01**: Settings page shows an "API Keys" section with fields for YNAB PAT, Anthropic Claude API key, Resend API key, and Pipedream webhook URL
- [ ] **CONFIG-02**: Admin can edit any API key in the settings page; changes save to the DB and take effect without restart
- [ ] **CONFIG-03**: Sender routing rules UI (from Quick-4/5) is preserved and functional after rollback
- [ ] **CONFIG-04**: Currency-based account routing UI (from Quick-6) is preserved and functional after rollback
- [ ] **CONFIG-05**: Test mode toggle (from post-UAT fix) is preserved and continues to skip YNAB writes when enabled

### First-Install Wizard

- [ ] **WIZ-01**: On first install (empty settings or `wizard_complete = false`), visiting any route redirects the admin to `/setup`
- [ ] **WIZ-02**: Setup wizard is a multi-step flow: admin password → YNAB PAT → YNAB budget/account selection → Anthropic Claude API key → Resend API key → Pipedream webhook URL → done
- [ ] **WIZ-03**: Each wizard step shows plain-language instructions targeting non-programmers — numbered steps, screenshots where useful, and a direct link to the provider's API key page
- [ ] **WIZ-04**: Wizard saves each value to the DB as it is entered; closing the tab and returning resumes from the last completed step
- [ ] **WIZ-05**: After completion, wizard sets `wizard_complete = true` and never runs again; subsequent visits route to `/login` (if unauthenticated) or `/dashboard` (if authenticated)

### Dashboard & UX

- [ ] **DASH-06**: Dashboard stats, activity log, parse transparency, and replay tool all continue to work after the single-tenant rollback
- [x] **DASH-07**: Public homepage (`/`), onboarding page (`/onboarding`), GDPR account deletion UI, and magic-link signin page are removed
- [ ] **DASH-08**: `/` routes based on state: first install → `/setup`, unauthenticated → `/login`, authenticated → `/dashboard`

### Dead Code Removal

- [ ] **CLEAN-01**: Delete `/api/email/inbound` route, `src/lib/email-routing.ts`, `src/lib/mailbox-hash.ts`, and all Phase 18 per-user forwarding address code
- [x] **CLEAN-02**: Remove `getPrismaForUser` middleware and RLS-setting `$extends` from `src/lib/db.ts`
- [ ] **CLEAN-03**: Delete `src/app/onboarding/`, `src/app/(dashboard)/settings/DangerZone.tsx`, `src/app/api/account/delete/`, and unify test-mode toggling into the main settings endpoint
- [ ] **CLEAN-04**: Fix or delete the 10 failing tests that accumulated during v5.0 (webhook route tests, multi-tenant isolation tests, YNAB OAuth tests, migration tests)

### Docs & Distribution

- [ ] **DOCS-01**: `README.md` has a "Deploy on Railway" one-click button that creates a fresh deployment with the required env vars (DATABASE_URL provisioned, IRON_SESSION_SECRET auto-generated)
- [ ] **DOCS-02**: `README.md` walks a non-programmer end-to-end: click deploy → open deployment URL → complete setup wizard → start forwarding emails, with numbered steps and screenshots
- [ ] **DOCS-03**: `README.md` explains in principle what services cost the user (e.g. "Claude API charges per email processed — you'll probably pay a few cents a month") with direct links to each provider's pricing page — no hard numbers that will age

## v2 Requirements

Deferred to future release. Tracked but not in this milestone.

### Multi-Tenant Commercialisation

- **MULTI-01**: User signup with Auth.js (restore from v5.0 git history if commercialising)
- **MULTI-02**: Per-user YNAB OAuth (restore from v5.0)
- **MULTI-03**: Per-user Postmark forwarding addresses (restore from v5.0)
- **MULTI-04**: Row-Level Security policies (restore from v5.0)
- **MULTI-05**: Stripe billing integration
- **MULTI-06**: Plan tiers (free, paid)

**Note:** v5.0 git tag preserves all the multi-tenant code. If/when commercialisation happens, cherry-pick from there rather than rebuilding from scratch.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Magic-link / OAuth signup | Rollback explicitly drops this; use single admin password |
| YNAB OAuth flow | Personal Access Token is sufficient for self-host; simpler for non-programmers |
| Per-user Postmark addresses | Single-tenant only needs one shared forwarding path (Pipedream) |
| PostgreSQL RLS | Not needed for single tenant |
| Public marketing homepage | This is a self-hosted tool, not a SaaS |
| GDPR account deletion endpoint | No user accounts to delete in single-tenant mode |
| Billing / Stripe | No pricing model in free open-source single-tenant |
| Mobile app | Web-first via Railway URL |
| Postmark inbound email path | Pipedream is the active path and will remain |
| Category learning / reconciliation | Deferred to user feedback phase post-v6.0 |
| Refund handling | Deferred to user feedback phase post-v6.0 |
| Split transactions | Deferred to user feedback phase post-v6.0 |
| Daily digest email | Deferred to user feedback phase post-v6.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-05 | Phase 20 | Complete |
| DATA-06 | Phase 20 | Complete |
| DATA-07 | Phase 20 | Complete |
| DATA-08 | Phase 20 | Complete |
| AUTH-04 | Phase 21 | Complete |
| AUTH-05 | Phase 21 | Complete |
| AUTH-06 | Phase 21 | Complete |
| AUTH-07 | Phase 21 | Complete |
| YNAB-06 | Phase 22 | Pending |
| YNAB-07 | Phase 22 | Pending |
| YNAB-08 | Phase 22 | Pending |
| YNAB-09 | Phase 22 | Pending |
| CONFIG-01 | Phase 22 | Pending |
| CONFIG-02 | Phase 22 | Pending |
| CONFIG-03 | Phase 22 | Pending |
| CONFIG-04 | Phase 22 | Pending |
| CONFIG-05 | Phase 22 | Pending |
| WIZ-01 | Phase 23 | Pending |
| WIZ-02 | Phase 23 | Pending |
| WIZ-03 | Phase 23 | Pending |
| WIZ-04 | Phase 23 | Pending |
| WIZ-05 | Phase 23 | Pending |
| DASH-06 | Phase 22 | Pending |
| DASH-07 | Phase 21 | Complete |
| DASH-08 | Phase 23 | Pending |
| CLEAN-01 | Phase 22 | Pending |
| CLEAN-02 | Phase 21 | Complete |
| CLEAN-03 | Phase 23 | Pending |
| CLEAN-04 | Phase 24 | Pending |
| DOCS-01 | Phase 24 | Pending |
| DOCS-02 | Phase 24 | Pending |
| DOCS-03 | Phase 24 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after roadmap creation (phases 20-24 mapped)*
