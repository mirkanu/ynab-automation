# YNAB Automation

Automatically creates YNAB transactions from forwarded order confirmation emails. Forward any order confirmation email to a dedicated address — a transaction appears in YNAB within seconds, no manual entry needed.

> **Note:** This project was planned and coded exclusively using [Claude Code](https://claude.ai/claude-code) with the [GSD (Get Shit Done)](https://github.com/punkpeye/get-shit-done) workflow system. No code was written by hand.

---

## Quickest Path (No Coding Required)

You don't need to write any code or use a terminal to run this. Everything deploys through web dashboards.

> **Does this need Claude Code running somewhere?** No. Claude Code is the tool used to *build* this app — it's not part of how it runs. At runtime, the app is a standard web service on Railway that calls the Anthropic API to parse emails. Once deployed, it runs entirely on Railway's servers, 24/7, with no local tooling needed.

**Steps at a glance:**

1. **Fork this repo** — click Fork on GitHub (top right). You now have your own copy.
2. **Create a Railway account** — [railway.app](https://railway.app/). Connect it to your GitHub account.
3. **Deploy the app on Railway** — New Project → Deploy from GitHub repo → select your fork. Railway builds and hosts it automatically.
4. **Add a PostgreSQL database** — in the same Railway project, click "+ New" → Database → PostgreSQL. Railway wires up `DATABASE_URL` for you.
5. **Create accounts and get credentials** for the services in the [Prerequisites](#prerequisites) table below. This is the only tedious part — you need API keys from Anthropic, YNAB, and Resend, and an inbound email address from Pipedream.
6. **Set environment variables** in Railway (your service → Variables tab). Use the table in [Setup Guide → Step 4](#4-set-railway-environment-variables) below.
7. **Set up Pipedream** — create a workflow with an Email trigger, add an HTTP action that POSTs to `https://your-app.railway.app/api/webhook`. Forward a test order email and check Railway logs.

> **Want Claude Code to help?** If you have [Claude Code](https://claude.ai/claude-code) installed locally (or via SSH on any machine), you can clone your fork, install [GSD](https://github.com/punkpeye/get-shit-done), and ask it to walk through the setup steps with you. It can help craft your `SENDERS` JSON, look up your YNAB account IDs via the API, and validate your configuration — but the accounts and API keys still need to be created manually on each service's website first.

---

## What It Does

YNAB Automation bridges your email inbox and your budget. When you receive an order confirmation from any online retailer, forward it to a Pipedream inbound address. The app parses the email using Claude, extracts the amount, payee, currency, and order date, and creates a transaction in the correct YNAB account — all within a few seconds.

---

## How It Works

```
Forward email → Pipedream (inbound email) → Railway webhook → Claude (parse) → YNAB API
```

1. You forward an order confirmation email to your Pipedream inbound address
2. Pipedream fires a webhook to the Railway-hosted Next.js app
3. Claude extracts the amount, retailer, currency, and order date from the email HTML
4. The app looks up the sender in the `SENDERS` config and routes the transaction to the correct YNAB account
5. A YNAB transaction is created with the retailer as payee and the order date as the transaction date

---

## Features

- **Any retailer** — Amazon, eBay, Costco, Apple, or anywhere else; Claude infers the retailer from the email
- **Multi-user routing** — configure separate YNAB accounts for each household member, routed by sender email
- **Currency routing** — transactions in foreign currencies are automatically routed to a designated account (e.g. a Euro account)
- **Category tagging** — type a category hint on the first line of a forwarded email to assign a YNAB category
- **Deduplication** — message IDs tracked in PostgreSQL; Pipedream retries are safe
- **Error notifications** — unknown sender, parse failure, or YNAB API error sends an email alert via Resend
- **Order date accuracy** — date extracted from the email itself, not the processing date

---

## Prerequisites

You will need accounts and credentials for the following services:

| Service | Purpose | Notes |
|---------|---------|-------|
| [Railway](https://railway.app/) | App hosting + PostgreSQL | Free tier sufficient to start |
| [YNAB](https://www.ynab.com/) | Budget API | Requires a personal access token |
| [Anthropic](https://www.anthropic.com/) | Claude API (email parsing) | Pay-as-you-go; cost is minimal |
| [Pipedream](https://pipedream.com/) | Inbound email → webhook | Free tier sufficient |
| [Resend](https://resend.com/) | Error notification emails | Free tier sufficient |

---

## Setup Guide

### 1. Fork and clone the repo

```bash
git clone https://github.com/your-username/ynab-automation.git
cd ynab-automation
npm install
```

### 2. Deploy to Railway

1. Create a new project at [railway.app](https://railway.app/)
2. Add a **PostgreSQL** service to the project (Railway provisions `DATABASE_URL` automatically)
3. Add a new service from your GitHub repo
4. Railway will build and deploy the Next.js app automatically

See the [Railway documentation](https://docs.railway.app/) for full deployment instructions.

### 3. Configure Pipedream

1. Create a new workflow in [Pipedream](https://pipedream.com/)
2. Add an **Email** trigger — Pipedream will give you a unique inbound email address
3. Add an **HTTP / Webhook** action that POSTs the full email payload to your Railway webhook URL:
   ```
   https://your-app.railway.app/api/webhook
   ```
4. Deploy the workflow

Forward any order confirmation email to the Pipedream inbound address to trigger the workflow.

### 4. Set Railway environment variables

In your Railway service settings, set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Auto-set by Railway PostgreSQL add-on |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `YNAB_PERSONAL_ACCESS_TOKEN` | Yes | Your YNAB personal access token |
| `YNAB_BUDGET_ID` | Yes | The ID of your YNAB budget (from the YNAB web app URL) |
| `SENDERS` | Yes | JSON array of sender configs (see below) |
| `RESEND_API_KEY` | Yes | Your Resend API key |
| `ADMIN_EMAIL` | Yes | Email address that receives error notifications |
| `CURRENCY_ACCOUNTS` | No | JSON object mapping currency codes to YNAB account IDs |

### 5. Set the SENDERS environment variable

`SENDERS` is a JSON array where each entry maps a sender's email address to their YNAB account. Set the value as a raw JSON string in Railway.

**Format:**

```json
[
  {
    "email": "alice@example.com",
    "name": "Alice",
    "accountId": "ynab-account-uuid-alice",
    "notificationLabel": "Alice"
  },
  {
    "email": "bob@example.com",
    "name": "Bob",
    "accountId": "ynab-account-uuid-bob"
  }
]
```

- `email` — the address this person forwards from
- `name` — display name (used internally)
- `accountId` — the YNAB account UUID to post transactions to (find this in the YNAB API or budget settings)
- `notificationLabel` — optional; if set, appears in error notification subjects (e.g. `failed to parse order email (Alice)`)

See `config.example.json` for the full annotated structure.

### 6. Test the integration

1. Forward an order confirmation email to your Pipedream inbound address
2. Check Railway logs — you should see the webhook received and processed
3. Open YNAB and verify the transaction appears in the correct account with the correct amount, payee, and date

---

## Optional: Category Tagging

When forwarding an email, type a YNAB category name on the **first line** of the forwarded message body before sending:

```
Groceries
---------- Forwarded message ----------
...
```

The app performs a case-insensitive partial match against your YNAB category list. If a match is found, the transaction is assigned that category. If no match is found, the transaction is created without a category (no error).

---

## Optional: Currency Accounts

If you have transactions in multiple currencies (e.g. you hold a Euro account alongside a default account), set the `CURRENCY_ACCOUNTS` environment variable to route foreign-currency transactions to a dedicated YNAB account.

**Format:**

```json
{
  "EUR": "ynab-euro-account-uuid",
  "GBP": "ynab-gbp-account-uuid"
}
```

When Claude detects that a transaction's currency matches a key in `CURRENCY_ACCOUNTS`, the transaction is routed to that account instead of the sender's default account.

If `CURRENCY_ACCOUNTS` is not set, all transactions go to the sender's default account.

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
    config.ts                # SENDERS + CURRENCY_ACCOUNTS config loading
    email.ts                 # Pipedream payload parsing + category hint extraction
    claude.ts                # Claude API integration (order parsing)
    ynab.ts                  # YNAB API client
    notify.ts                # Resend error notification helper
    db.ts                    # Prisma client singleton
prisma/
  schema.prisma              # ProcessedEmail model (dedup tracking)
config.example.json          # annotated config structure reference
```

---

## Built With

This project was planned and built entirely using:

- **[Claude Code](https://claude.ai/claude-code)** — Anthropic's CLI coding agent
- **[GSD (Get Shit Done)](https://github.com/punkpeye/get-shit-done)** — a structured agentic workflow system for Claude Code that provides phase-based planning, atomic commits, human verification checkpoints, and milestone archival

Every file, test, and commit in this repository was produced by Claude Code executing GSD plans. The planning artifacts (phase plans, summaries, roadmap, requirements) are preserved in `.planning/`.
