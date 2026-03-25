# Amazon to YNAB Automation

## Current State — v2.0 Shipped (2026-03-25)

A forwarded order confirmation email (any retailer) becomes a YNAB transaction automatically — no manual entry, no missed purchases.

**Live at:** https://ynab-automation-production.up.railway.app
**Stack:** Next.js (API routes) + PostgreSQL on Railway
**Inbound email:** empk1lk0u08wjyn@upload.pipedream.net (Pipedream)

### What's Working

- Any order confirmation email forwarded by Manuel or Emily-Kate → YNAB transaction in correct account
- Retailer auto-detected by Claude and set as YNAB payee (Amazon, eBay, Costco, Apple, etc.)
- Euro-denominated orders routed to Euro Wise YNAB account
- Order date extracted from email (not today's date)
- Optional category: type a YNAB category name on the first line of the forward → it's matched and assigned
- Gmail signatures and quoted email content excluded from category hint detection
- Deduplication via message ID in PostgreSQL
- Error notifications to Manuel via Resend email (unknown sender, parse fail, YNAB fail)

### Known Outstanding

- Phase 06-02 human verify (3-case category tagging test) — deferred, code complete

---

## Next Milestone Goals

_(not yet defined — run `/gsd:new-milestone` to start v3.0 planning)_

---

<details>
<summary>v2.0 Milestone Context (archived)</summary>

**Goal:** Expand automation beyond Amazon to any retailer, and allow optional YNAB category tagging from the forwarded email.

**Users:** Manuel and Emily-Kate (two household members, separate YNAB accounts)

**Key Constraints:**
- Reuse existing Railway infrastructure (already running Josie n8n + Claude); no new platforms
- Pipedream for inbound email (free, no server-side API key needed)
- PostgreSQL on Railway for dedup

**Key Decisions:**
| Decision | Rationale |
|----------|-----------|
| Amazon filter removed entirely | Phase 5 goal is unconditional any-retailer support |
| `payeeName` required in YnabTransactionParams | Callers always have retailer from parsed.retailer |
| Euro routing to WISE_EUR_ACCOUNT_ID | EUR orders would land in wrong (GBP) account without routing |
| Order date from email, not today | More accurate for YNAB budgeting |
| Gmail signature stripping | Auto-signatures would be returned as the category hint |
| `getCategories` failure non-fatal | Single lookup failure should not block transaction creation |

**Infrastructure:**
- Railway: ynab-automation-production.up.railway.app
- PostgreSQL: DATABASE_URL set; ProcessedEmail table migrated on boot
- Secrets: ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL, YNAB_BUDGET_ID, YNAB_MANUEL_ACCOUNT_ID, YNAB_EMILY_ACCOUNT_ID, YNAB_EURO_ACCOUNT_ID, EMILY_KATE_EMAIL, RESEND_API_KEY, MANUEL_EMAIL

</details>

---

*Last updated: 2026-03-25 — v2.0 archived*
