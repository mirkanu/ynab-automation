# YNAB Automation

Automatically creates YNAB transactions from forwarded order confirmation emails. Forward any order confirmation email to a dedicated address — a transaction appears in YNAB within seconds, no manual entry needed.

> **Note:** This project was planned and coded exclusively using [Claude Code](https://claude.ai/claude-code) with the [GSD (Get Shit Done)](https://github.com/punkpeye/get-shit-done) workflow system. No code was written by hand.

---

## How It Works

1. Receive an order confirmation email from any retailer (Amazon, eBay, Costco, Apple, etc.)
2. Forward it to your Pipedream inbound address
3. Pipedream fires a webhook to the Railway-hosted app
4. Claude extracts the amount, description, retailer, currency, and order date from the email HTML
5. A YNAB transaction is created in the correct account with the retailer as payee

Optionally, type a YNAB category name on the **first line** of the forwarded email before sending — it will be matched (case-insensitive, partial) against your YNAB category list and assigned to the transaction.

---

## Features

- **Any retailer** — Amazon, eBay, Costco, Apple, or anywhere else; Claude infers the retailer from the email
- **Multi-user routing** — separate YNAB accounts for each household member, routed by sender email
- **Euro support** — EUR-denominated orders automatically routed to a separate Euro account
- **Category tagging** — type a category hint on the first line of your forward; matched and assigned if found
- **Deduplication** — message ID tracked in PostgreSQL; Pipedream retries are safe
- **Error notifications** — unknown sender, parse failure, or YNAB API error sends an email alert via Resend
- **Order date accuracy** — date extracted from the email itself, not the processing date

---

## Stack

| Layer | Technology |
|-------|-----------|
| App | [Next.js 14](https://nextjs.org/) (App Router, API routes) |
| Hosting | [Railway](https://railway.app/) |
| Database | PostgreSQL (Railway add-on) |
| ORM | [Prisma](https://www.prisma.io/) |
| Email inbound | [Pipedream](https://pipedream.com/) (inbound email → webhook) |
| AI parsing | [Claude Haiku](https://www.anthropic.com/) via Anthropic SDK |
| YNAB | [YNAB REST API](https://api.youneedabudget.com/) |
| Notifications | [Resend](https://resend.com/) |
| Tests | [Vitest](https://vitest.dev/) |

---

## Environment Variables

```env
# Database (auto-set by Railway PostgreSQL add-on)
DATABASE_URL=

# Claude API (Anthropic)
ANTHROPIC_API_KEY=

# YNAB
YNAB_PERSONAL_ACCESS_TOKEN=
YNAB_BUDGET_ID=
YNAB_MANUEL_ACCOUNT_ID=
YNAB_EMILY_ACCOUNT_ID=
YNAB_EURO_ACCOUNT_ID=

# Sender identification
EMILY_KATE_EMAIL=

# Error notifications (Resend)
RESEND_API_KEY=
MANUEL_EMAIL=
```

---

## Development

```bash
npm install
npm test          # run Vitest test suite
npx tsc --noEmit  # type check
npm run build     # production build
```

---

## Project Structure

```
src/
  app/api/webhook/route.ts   # main webhook handler
  lib/
    email.ts                 # Pipedream payload parsing + category hint extraction
    claude.ts                # Claude API integration (order parsing)
    ynab.ts                  # YNAB API client
    notify.ts                # Resend error notification helper
    db.ts                    # Prisma client singleton
prisma/
  schema.prisma              # ProcessedEmail model (dedup tracking)
```

---

## Built With

This project was planned and built entirely using:

- **[Claude Code](https://claude.ai/claude-code)** — Anthropic's CLI coding agent
- **[GSD (Get Shit Done)](https://github.com/punkpeye/get-shit-done)** — a structured agentic workflow system for Claude Code that provides phase-based planning, atomic commits, human verification checkpoints, and milestone archival

Every file, test, and commit in this repository was produced by Claude Code executing GSD plans. The planning artifacts (phase plans, summaries, roadmap, requirements) are preserved in `.planning/`.
