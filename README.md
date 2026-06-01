# YNAB Automation

> **Personal project:** This was built to solve a specific problem for the author. It works for that purpose. It has not been tested for general deployment and is not actively maintained — use it as inspiration or a starting point, not a supported tool.

> **100% AI-generated:** No code was written by hand. Every file was produced by [Claude Code](https://claude.ai/claude-code) via the [GSD workflow](https://github.com/pablof7z/gsd). The author is a non-programmer building personal tools with AI. PRs are welcome — if one arrives, Claude Code will review and merge it. Issues are unlikely to receive a response.

YNAB automatically categorizes transactions by payee — which works great until you shop at a place like Amazon, where one order might be groceries, another electronics, and another home supplies. YNAB sees the same payee every time and can't tell them apart. This app eliminates that manual lookup: forward your order confirmation emails to a dedicated address, and it reads the receipt, extracts the line items, and creates a correctly-categorized YNAB transaction within seconds. It also handles Wise international transfers, syncing EUR bank transactions and converting amounts automatically.

## Features

- **Email-to-YNAB:** Forward any order confirmation email and get a transaction created automatically with the right amount, date, and payee
- **AI-powered parsing:** Claude reads the email and extracts what matters — handles Amazon, eBay, Apple, and most other retailers
- **Wise integration:** Syncs EUR bank transactions from Wise and reconciles them against YNAB
- **Activity log:** Every processed email gets a row — green for success, red for failure, with full detail and one-click replay
- **Settings UI:** Change any configuration from the browser — no server restarts, no editing files
- **Test mode:** Try things without creating real YNAB transactions

> **Tip:** Not sure where to start? Paste the link to this page into [Claude](https://claude.ai), [ChatGPT](https://chat.openai.com), or any AI assistant and ask it to walk you through the setup. These tools can read GitHub pages and guide you step by step.

## Quick Setup

1. **Clone the repo** and install dependencies: `npm install`
2. **Set up a PostgreSQL database** and set `DATABASE_URL` in your environment
3. **Run migrations:** `npx prisma migrate deploy`
4. **Set required environment variables** (see `.env.example` for the full list):
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
   - `YNAB_ACCESS_TOKEN` — from [YNAB Developer Settings](https://app.ynab.com/settings/developer)
   - `RESEND_API_KEY` — from [resend.com](https://resend.com) (for error alerts)
   - `IRON_SESSION_SECRET` — any 32+ character random string
5. **Build and start:** `npm run build && npm start`
6. **Open the app** in your browser — the setup wizard walks through connecting your YNAB budget and configuring email routing
7. **Set up email forwarding:** In Gmail (or Outlook/Apple Mail), create a filter that forwards order confirmation emails to the inbound address shown in the app

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database | PostgreSQL 16 via Prisma |
| Email inbound | Resend inbound webhook |
| AI parsing | Anthropic Claude API |
| Budget API | YNAB Personal Access Token |
| Auth | iron-session |

---

*Built with [Claude Code](https://claude.ai/claude-code) using [GSD](https://github.com/pablof7z/gsd).*
