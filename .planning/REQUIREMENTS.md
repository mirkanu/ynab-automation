# Requirements: v3.0 — Generic & Publishable

**Defined:** 2026-03-26
**Core Goal:** Any household can deploy this automation without editing code — just configure env vars.

---

## v3.0 Requirements

### Configuration

- [ ] **CFG-01**: Senders and their YNAB accounts are defined via a `SENDERS` JSON env var (array of objects with email, name, accountId, optional notificationLabel)
- [ ] **CFG-02**: Currency-to-account overrides are defined via a `CURRENCY_ACCOUNTS` JSON env var (e.g. `{"EUR":"uuid"}`) — replaces hardcoded YNAB_EURO_ACCOUNT_ID
- [ ] **CFG-03**: Admin notification recipient is defined via `ADMIN_EMAIL` env var — replaces MANUEL_EMAIL
- [ ] **CFG-04**: App validates config at startup and fails fast with a clear error if SENDERS JSON is malformed or missing required fields
- [ ] **CFG-05**: `notificationLabel` on a sender config is appended to notification email subjects when set (e.g. `" (Emily-Kate)"`) — allows household members to distinguish whose transaction failed

### Code hygiene

- [ ] **HYG-01**: No personal email addresses in source code, comments, or tests
- [ ] **HYG-02**: No personal names (Manuel, Emily-Kate, Emily) in source code, comments, or tests — use generic names in tests (e.g. Alice, Bob)
- [ ] **HYG-03**: No personal-prefixed env var names (`YNAB_MANUEL_ACCOUNT_ID`, `YNAB_EMILY_ACCOUNT_ID`, `EMILY_KATE_EMAIL`, `MANUEL_EMAIL`) in code or .env.example
- [ ] **HYG-04**: `senderLabel()` function removed and replaced with config-driven label logic

### Documentation

- [ ] **DOC-01**: README contains a step-by-step setup guide for a new user deploying to Railway
- [ ] **DOC-02**: README documents the SENDERS and CURRENCY_ACCOUNTS JSON format with examples
- [ ] **DOC-03**: README documents all required env vars
- [ ] **DOC-04**: A `config.example.json` file shows the full config structure with placeholder values

### Deployment

- [ ] **DEP-01**: Live Railway deployment updated to use new env vars (SENDERS, CURRENCY_ACCOUNTS, ADMIN_EMAIL) pre-configured for Manuel and Emily-Kate
- [ ] **DEP-02**: Old personal env vars removed from Railway (YNAB_MANUEL_ACCOUNT_ID, YNAB_EMILY_ACCOUNT_ID, EMILY_KATE_EMAIL, MANUEL_EMAIL, YNAB_EURO_ACCOUNT_ID)
- [ ] **DEP-03**: GitHub repo made public

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| CFG-01–05 | 7 |
| HYG-01–04 | 7 |
| DOC-01–04 | 8 |
| DEP-01–03 | 8 |
