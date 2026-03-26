# Requirements: v4.0 — Admin Backend UI

## Deployment Retirement
- [ ] **DEPL-01**: Old Railway deployment is decommissioned (service deleted or redirected)
- [ ] **DEPL-02**: README and docs updated to reference only the new deployment URL

## Admin Authentication
- [ ] **AUTH-01**: `/admin` routes protected by single ADMIN_PASSWORD env var
- [ ] **AUTH-02**: Cookie-based session persists after successful login
- [ ] **AUTH-03**: Login page at `/admin/login` with password field
- [ ] **AUTH-04**: Logout clears session and redirects to login

## Activity Log
- [ ] **LOG-01**: Every inbound email written to DB (from address, subject, timestamp, raw body)
- [ ] **LOG-02**: Claude parse output stored per entry (retailer, amount, date, currency)
- [ ] **LOG-03**: YNAB result stored per entry (success/fail, transaction ID, amount, account)
- [ ] **LOG-04**: Errors stored with full detail (type, message)
- [ ] **LOG-05**: Log UI with status filter, date range filter, and pagination
- [ ] **LOG-06**: Full request trace expandable per log row

## Settings Editor
- [ ] **SET-01**: SENDERS routing editable in UI (add/edit/remove email→account mappings)
- [ ] **SET-02**: CURRENCY_ACCOUNTS editable in UI (add/edit/remove currency→account mappings)
- [ ] **SET-03**: API keys editable in UI (YNAB_API_KEY, RESEND_API_KEY, RAILWAY_API_TOKEN)
- [ ] **SET-04**: Other env vars editable (ADMIN_EMAIL, NOTIFICATION_LABEL, etc.)
- [ ] **SET-05**: Settings changes applied to Railway env vars via API (reuse wizard mechanism)

## Dashboard
- [ ] **DASH-01**: Emails processed this week and success rate displayed
- [ ] **DASH-02**: Last transaction summary (retailer, amount, account, timestamp)
- [ ] **DASH-03**: Webhook URL displayed prominently with one-click copy

## Test & Replay
- [ ] **TEST-01**: Paste email content → preview Claude parse output (no YNAB write)
- [ ] **TEST-02**: Replay any logged email through full pipeline (creates real YNAB transaction)

## Future Requirements
_(deferred from this milestone — none identified)_

## Out of Scope
- Multi-user accounts / role-based access — single admin password is sufficient
- Email sending from admin UI — notifications already handled by existing Resend flow
- YNAB budget/category browser in admin — already handled by setup wizard

## Traceability
_(filled by roadmapper)_
