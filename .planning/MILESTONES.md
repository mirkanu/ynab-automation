# Milestones

## v6.2 — Settings & UX Polish

**Shipped:** 2026-05-29
**Phases:** 2 (27-28) | **Plans:** 4 | **Requirements:** 5/5

**Delivered:** Restructured admin UI into logical Rules/Settings/Tools pages, removed Amazon-specific labels, and made the forwarding address unmissable on dashboard and wizard done page.

**Key accomplishments:**
1. Removed Amazon-specific labels from wizard step 3 and setup/done — fully generic retailer language
2. Created /rules page hosting sender and currency routing sections; 5-item nav bar
3. Settings page scoped to credentials only (API keys, YNAB connection, admin password)
4. Test Mode toggle moved from Settings to Tools page
5. Dashboard forwarding address card repositioned first with blue highlight
6. Wizard done page: copy-to-clipboard block replacing buried inline span

**Archives:** [ROADMAP](milestones/v6.2-ROADMAP.md) | [REQUIREMENTS](milestones/v6.2-REQUIREMENTS.md)

---

## v6.1 — README & Onboarding Polish

**Shipped:** 2026-04-16
**Phases:** 1 (Phase 26) | **Plans:** 1

**Delivered:** README rewritten to lead with the problem statement; Deploy button opens Railway in new tab; Install section reduced to 3 steps; wizard handles all post-deploy config.

---

## v6.0 — Single-Tenant Rollback

**Shipped:** 2026-04-16
**Phases:** 6 (20-25)

**Delivered:** Rolled back multi-tenant SaaS to single-tenant: removed Auth.js/RLS/OAuth, restored iron-session admin auth, YNAB PAT, first-install wizard, cleaned test suite, comprehensive README and Railway deploy template.

---

## v5.0 Multi-Tenant SaaS (Shipped: 2026-04-10)

**Phases completed:** 4 phases, 20 plans, 6 tasks

**Key accomplishments:**
- (none recorded)

---

## v4.0 — Admin Backend UI

**Shipped:** 2026-03-28
**Phases:** 6 (10-15) | **Plans:** 7 | **Requirements:** 22/22

**Delivered:** Password-protected admin UI with dashboard, activity log, settings editor, and test & replay tools — making the app fully self-serviceable.

**Key accomplishments:**
1. Retired old deployment, consolidated to single Railway instance
2. Cookie-based admin auth with iron-session (login, logout, session persistence)
3. Full activity logging — every email traced end-to-end in PostgreSQL
4. Dashboard with stats, success rate, last transaction, webhook URL
5. Activity log viewer with filters, pagination, expandable trace rows
6. Settings editor with YNAB account dropdowns, instant DB-backed saves
7. Test mode toggle — process emails without YNAB writes
8. Email parse preview and transaction replay tools

**Archives:** [ROADMAP](milestones/v4.0-ROADMAP.md) | [REQUIREMENTS](milestones/v4.0-REQUIREMENTS.md)

---

## v3.0 — Generic & Publishable + Setup Wizard

**Shipped:** 2026-03-26
**Archives:** [ROADMAP](milestones/v3.0-ROADMAP.md)

---

## v2.0 — Any Retailer + Category Tagging

**Shipped:** 2026-03-25
**Archives:** [ROADMAP](milestones/v2.0-ROADMAP.md)

---

## v1.0 — Core Pipeline

**Shipped:** 2026-03-24
