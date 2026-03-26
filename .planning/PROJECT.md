# Amazon to YNAB Automation

## Current State — v3.0 Shipped (2026-03-26)

A forwarded order confirmation email (any retailer) becomes a YNAB transaction automatically — no manual entry, no missed purchases. Now deployable by anyone via a one-click Railway button and interactive setup wizard.

**Live at:** https://ynab-automation-production.up.railway.app
**Public repo:** https://github.com/mirkanu/ynab-automation
**Stack:** Next.js (API routes) + PostgreSQL on Railway
**Inbound email:** empk1lk0u08wjyn@upload.pipedream.net (Pipedream)

### What's Working

- Any order confirmation email forwarded → YNAB transaction in correct account
- Retailer auto-detected by Claude and set as YNAB payee (Amazon, eBay, Costco, Apple, etc.)
- Multi-sender routing via SENDERS JSON env var; currency routing via CURRENCY_ACCOUNTS
- Order date extracted from email (not today's date)
- Optional category: type a YNAB category name on the first line of the forward → matched and assigned
- Deduplication via message ID in PostgreSQL
- Error notifications via Resend email (unknown sender, parse fail, YNAB fail)
- Interactive setup wizard at app URL when unconfigured; auto-applies vars to Railway via API
- Railway deploy button in README; config.example.json for format reference

---

## Current Milestone: v4.0 Admin Backend UI

**Goal:** Add a password-protected admin UI for configuration, monitoring, and testing — making the app fully self-serviceable without touching environment variables or raw logs.

**Target features:**
- Retire old Railway deployment; new instance is the only active one
- Password-protected `/admin` route (single ADMIN_PASSWORD env var, cookie session)
- Full activity log: raw email received, Claude parse output, YNAB transaction result, errors
- Settings editor: all env vars (SENDERS, CURRENCY_ACCOUNTS, API keys) editable in UI
- Dashboard stats: emails this week, success rate, last transaction
- Live test tool: paste email content, preview Claude parse without hitting YNAB
- Transaction replay: re-run any logged email through the pipeline from the log view
- Webhook URL helper: inbound email endpoint displayed prominently for easy copy

---

<details>
<summary>v3.0 Milestone Context (archived)</summary>

**Goal:** Make the automation usable by anyone, not just Manuel and Emily-Kate. All personal references removed; sender routing driven by JSON config; published as open-source with an interactive setup wizard.

**Key Decisions:**
| Decision | Rationale |
|----------|-----------|
| SENDERS as JSON env var | Works natively on Railway/PaaS; supports any number of senders |
| CURRENCY_ACCOUNTS as JSON env var | Same pattern; optional; clean generalisation of Euro routing |
| loadConfig() at handler entry | Config errors surface per-request with clear message |
| YNAB API called from browser | CORS supported; token never hits the Next.js server |
| Railway API auto-apply | Uses built-in RAILWAY_PROJECT/ENV/SERVICE_ID env vars |

</details>

<details>
<summary>v2.0 Milestone Context (archived)</summary>

**Goal:** Expand automation beyond Amazon to any retailer, and allow optional YNAB category tagging from the forwarded email.

**Key Decisions:**
| Decision | Rationale |
|----------|-----------|
| Amazon filter removed entirely | Phase 5 goal is unconditional any-retailer support |
| `payeeName` required in YnabTransactionParams | Callers always have retailer from parsed.retailer |
| Euro routing to WISE_EUR_ACCOUNT_ID | EUR orders would land in wrong (GBP) account without routing |
| Order date from email, not today | More accurate for YNAB budgeting |
| Gmail signature stripping | Auto-signatures would be returned as the category hint |
| `getCategories` failure non-fatal | Single lookup failure should not block transaction creation |

</details>

---

*Last updated: 2026-03-26 — v4.0 started*
