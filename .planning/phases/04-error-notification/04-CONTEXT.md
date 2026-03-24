# Phase 4 Context — Error Notification

**Captured:** 2026-03-24

## What the User Wants

When an email cannot be processed for any reason, the relevant person gets an email notification so nothing disappears silently.

## Notification Channel

**Email** (not Telegram).

Email service TBD during planning — options include Resend, SendGrid, Postmark, or nodemailer+SMTP. Should be simple to integrate with Railway env vars.

## Error Cases and Routing

| Error case | Recipient |
|------------|-----------|
| Unknown sender (email not in SENDER_MAP) | Manuel |
| Non-Amazon email (passes webhook but fails Amazon detection) | Sender (Manuel or Emily-Kate, based on forwarding address) |
| Claude parse failure (returns null — can't extract amount/description) | Sender |
| YNAB API error (non-2xx response from YNAB) | Sender |
| Manuel is sender → any failure | Manuel only |
| Emily-Kate is sender → any failure | Emily-Kate (To:) + Manuel (CC:) |

## Happy Path

No notification sent on success.

## Email Content (rough)

Subject: something like "YNAB automation: failed to process your Amazon email"
Body: human-readable explanation of what failed and which email triggered it (subject line or message-id).

## Environment Variables Needed

- `MANUEL_EMAIL` = manuelkuhs@gmail.com (already known)
- `EMILY_KATE_EMAIL` = kuhs.emilykate@gmail.com (already in Railway)
- Email service API key (e.g. `RESEND_API_KEY` or `SENDGRID_API_KEY`) — TBD

## Key Constraint

The webhook handler must always return 200 to Pipedream even on error (prevents redelivery loops). Notifications are fire-and-forget — a notification failure must not affect the response.
