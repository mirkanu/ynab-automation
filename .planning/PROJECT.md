# Amazon to YNAB Automation

## Current Milestone: v2.0 — Any Retailer + Category Tagging

**Goal:** Expand automation beyond Amazon to any retailer order confirmation, and let users optionally tag a YNAB category by typing it on the first line of the forwarded email.

**Target features:**
- Non-Amazon support: any forwarded order confirmation email is processed, with retailer name auto-detected as the payee
- YNAB category from email: typing a category name on the first line of the forwarded message assigns it to the transaction

---

## What This Is

An email-to-transaction bridge that automatically creates YNAB transactions from Amazon order confirmation emails. Manuel and Emily-Kate forward Amazon confirmation emails to a dedicated address; the app parses each email with Claude and creates a transaction in the correct YNAB account with a descriptive memo.

## Core Value

A forwarded Amazon email becomes a YNAB transaction automatically — no manual entry, no missed purchases.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Pipedream receives forwarded Amazon emails and fires a webhook to the app
- [ ] Claude API extracts item description and order amount from email content
- [ ] Sender identity (Manuel or Emily-Kate) is detected from the forwarding address
- [ ] Transaction is created in the correct YNAB account based on sender
- [ ] Memo contains sender name and item description
- [ ] Transactions are created uncategorized (manual categorization in YNAB)
- [ ] Duplicate emails are rejected using message ID tracking in PostgreSQL
- [ ] App is deployed on Railway alongside existing infrastructure

### Active (v2.0)

- [ ] Any retailer order confirmation email is processed (not just Amazon)
- [ ] Retailer name is detected from email content and used as the YNAB payee
- [ ] User can optionally type a YNAB category name on the first line of the forwarded email
- [ ] If a category is typed, it is looked up in YNAB and assigned to the transaction
- [ ] If no category is typed, transaction is created uncategorized (existing behaviour)

### Out of Scope

- Automated email capture (no forwarding needed) — future
- Receipt attachments — future

## Context

- Manuel and Emily-Kate are the two senders; each maps to a separate YNAB account
- Existing Railway infrastructure already in use for Josie (n8n + Claude) — same platform
- YNAB API requires OAuth or personal access token; personal access token is simplest for a private household tool
- Pipedream inbound: emails forwarded to empk1lk0u08wjyn@upload.pipedream.net trigger a webhook POST to Railway; no API key needed on our end

## Constraints

- **Tech stack**: Next.js (API routes for webhook handler) + PostgreSQL on Railway
- **Email service**: Pipedream — switched from Postmark/Mailgun (both had signup/plan issues); forwards emails to Railway webhook, no API key needed on our side
- **Inbound email address**: empk1lk0u08wjyn@upload.pipedream.net
- **Hosting**: Railway — already provisioned, avoid introducing new platforms
- **API keys**: Claude API, YNAB personal access token — stored as Railway env vars (no email service key needed)
- **Privacy**: Email content contains order details; data should not be logged beyond what's needed for dedup

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pipedream for inbound email | Switched from Postmark (rejected Gmail) → Mailgun (inbound locked behind paid plan) → Pipedream (free, no domain needed, no API key required on our end) | — Pending |
| Railway for hosting | Reuse existing infrastructure; avoid Vercel cold starts for webhook reliability | — Pending |
| Sender-based YNAB account routing | Manuel and Emily-Kate each have their own account; routing by sender keeps transactions organized | — Pending |
| Uncategorized in Phase 1 | Simpler to ship; category logic can be layered on in Phase 2 once the pipeline is working | — Pending |
| PostgreSQL for dedup | Postmark may redeliver on failure; idempotency via message ID prevents duplicate transactions | — Pending |

---
*Last updated: 2026-03-24 — v2.0 milestone started*
