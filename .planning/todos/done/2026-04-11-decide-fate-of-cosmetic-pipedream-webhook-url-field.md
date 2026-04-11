---
created: 2026-04-11T00:04:01.360Z
title: Decide fate of cosmetic Pipedream Webhook URL field
area: ui
files:
  - src/app/(dashboard)/settings/ApiKeysSection.tsx
---

## Problem

The "Pipedream Webhook URL" field in Settings → API Keys (key `PIPEDREAM_WEBHOOK_URL`) is cosmetic — no runtime code reads it. A grep across `src/` confirms it only appears in the UI component and planning docs, never in webhook/email handling.

This is confusing for two reasons:
1. The field label says "URL" but the real Pipedream-related env var is `INBOUND_EMAIL=empk1lk0u08wjyn@upload.pipedream.net` — an email address, not a URL.
2. The actual "webhook URL" in the flow is the Railway app's own `/api/webhook` endpoint, which Pipedream POSTs to. That URL is configured inside Pipedream, not in this app.

Discovered during Phase 22 human verification on 2026-04-11. User pasted the Railway `/api/webhook` URL as a placeholder to move verification forward.

## Solution

Pick one of:

- **(a) Wire it up** — have `/api/webhook` or email processing read `PIPEDREAM_WEBHOOK_URL` for something meaningful (e.g., display on dashboard, use in an outbound call). Only makes sense if there's a real use case.
- **(b) Rename + repurpose** — rename the field to "Inbound Email Address" and store/surface `INBOUND_EMAIL`. Makes the Settings page match what the user actually needs to know (where to forward emails).
- **(c) Drop the field** — remove it from `ApiKeysSection.tsx` entirely. Simplest.

Recommendation: **(b)** — non-programmer self-hosters need to know the forward-to address, and there's currently no place in the UI that shows it.
