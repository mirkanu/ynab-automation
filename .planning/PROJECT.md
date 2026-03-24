# Amazon to YNAB Automation

## What This Is

An email-to-transaction bridge that automatically creates YNAB transactions from Amazon order confirmation emails. Manuel and Emily-Kate forward Amazon confirmation emails to a dedicated address; the app parses each email with Claude and creates a transaction in the correct YNAB account with a descriptive memo.

## Core Value

A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Postmark receives forwarded Amazon emails and fires a webhook to the app
- [ ] Claude API extracts item description and order amount from email content
- [ ] Sender identity (Manuel or Emily-Kate) is detected from the forwarding address
- [ ] Transaction is created in the correct YNAB account based on sender
- [ ] Memo contains sender name and item description
- [ ] Transactions are created uncategorized (manual categorization in YNAB)
- [ ] Duplicate emails are rejected using message ID tracking in PostgreSQL
- [ ] App is deployed on Railway alongside existing infrastructure

### Out of Scope

- Automated email capture (no forwarding needed) — Phase 2
- Claude-suggested YNAB categories — Phase 2; Phase 1 leaves transactions uncategorized
- Receipt attachments — Phase 2
- Non-Amazon emails — not in scope; app only processes Amazon order confirmations

## Context

- Manuel and Emily-Kate are the two senders; each maps to a separate YNAB account
- Existing Railway infrastructure already in use for Josie (n8n + Claude) — same platform
- YNAB API requires OAuth or personal access token; personal access token is simplest for a private household tool
- Postmark inbound: emails forwarded to a Postmark inbound address trigger a JSON webhook with parsed headers, body, and sender

## Constraints

- **Tech stack**: Next.js (API routes for webhook handler) + PostgreSQL on Railway
- **Email service**: Mailgun — switched from Postmark (Postmark rejected Gmail account signup); same inbound route → webhook model, free tier 1,000 emails/month
- **Hosting**: Railway — already provisioned, avoid introducing new platforms
- **API keys**: Claude API, YNAB personal access token, Mailgun API key — stored as Railway env vars
- **Privacy**: Email content contains order details; data should not be logged beyond what's needed for dedup

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mailgun for inbound email | Switched from Postmark — Postmark rejected Gmail signup; Mailgun accepts Gmail, same inbound route → webhook model, 1k emails/month free | — Pending |
| Railway for hosting | Reuse existing infrastructure; avoid Vercel cold starts for webhook reliability | — Pending |
| Sender-based YNAB account routing | Manuel and Emily-Kate each have their own account; routing by sender keeps transactions organized | — Pending |
| Uncategorized in Phase 1 | Simpler to ship; category logic can be layered on in Phase 2 once the pipeline is working | — Pending |
| PostgreSQL for dedup | Postmark may redeliver on failure; idempotency via message ID prevents duplicate transactions | — Pending |

---
*Last updated: 2026-03-23 after switching email provider from Postmark to Mailgun*
