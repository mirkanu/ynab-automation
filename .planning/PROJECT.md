# Amazon to YNAB Automation

## Current State — v4.0 Shipped (2026-03-28)

A forwarded order confirmation email (any retailer) becomes a YNAB transaction automatically — no manual entry, no missed purchases. Fully self-serviceable via a password-protected admin UI.

**Live at:** https://ynab-test-production.up.railway.app
**Public repo:** https://github.com/mirkanu/ynab-automation
**Stack:** Next.js (API routes) + PostgreSQL on Railway
**Inbound email:** empk1lk0u08wjyn@upload.pipedream.net (Pipedream)

### What's Working

- Any order confirmation email forwarded → YNAB transaction in correct account
- Retailer auto-detected by Claude and set as YNAB payee (Amazon, eBay, Costco, Apple, etc.)
- Multi-sender routing via SENDERS config; currency routing via CURRENCY_ACCOUNTS
- Order date extracted from email (not today's date)
- Optional category: type a YNAB category name on the first line of the forward → matched and assigned
- Deduplication via message ID in PostgreSQL
- Error notifications via Resend email (unknown sender, parse fail, YNAB fail)
- Interactive setup wizard at app URL when unconfigured; auto-applies vars to Railway via API
- Railway deploy button in README; config.example.json for format reference
- **Admin UI** (v4.0): password-protected dashboard, activity log, settings editor, test & replay tools
- **Activity logging**: every email traced end-to-end (sender, parse result, YNAB outcome, errors)
- **Settings editor**: all config editable in UI with YNAB account/budget dropdowns, instant save (DB-backed, no restart)
- **Test mode**: toggle to process emails without YNAB writes, visible in log as "Test Only"
- **Test & replay**: paste email to preview parse, replay logged emails, "Run live" for test entries

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SENDERS as JSON env var | Works natively on Railway/PaaS | ✓ Good |
| CURRENCY_ACCOUNTS as JSON env var | Same pattern; optional | ✓ Good |
| loadConfig() at handler entry | Config errors surface per-request | ✓ Good |
| YNAB API called from browser (setup) | CORS supported; token never hits server | ✓ Good |
| Railway API auto-apply | Uses built-in RAILWAY_PROJECT/ENV/SERVICE_ID | ✓ Good |
| iron-session v8.0.4 for admin auth | Edge-compatible, zero DB deps, Next.js recommended | ✓ Good |
| DB-backed settings (Setting table) | Instant config changes without Railway restart | ✓ Good |
| Test mode via TEST_MODE flag | Safe email testing without YNAB side effects | ✓ Good |
| Inline CSS throughout admin UI | Matches SetupWizard patterns, zero build config | ✓ Good |
| Activity log stores account name + category name | Human-readable log entries without extra API calls on view | ✓ Good |

---

<details>
<summary>v3.0 Milestone Context (archived)</summary>

**Goal:** Make the automation usable by anyone, not just Manuel and Emily-Kate. All personal references removed; sender routing driven by JSON config; published as open-source with an interactive setup wizard.

</details>

<details>
<summary>v2.0 Milestone Context (archived)</summary>

**Goal:** Expand automation beyond Amazon to any retailer, and allow optional YNAB category tagging from the forwarded email.

</details>

---

*Last updated: 2026-03-28 after v4.0 milestone*
