# Pipedream Webhook Payload Shape

Captured from a real forwarded Amazon order email on 2026-03-24.
Manuel forwarded an Amazon.co.uk order confirmation from his Gmail account to the Pipedream address.

---

## Top-Level Structure

```json
{
  "trigger": {
    "event": {
      "headers": { ... },   // Parsed email headers (from, subject, message-id, etc.)
      "body": {             // Email body — HTML only (no plain text field)
        "html": "...",
        "htmlUrl": "...",   // S3 pre-signed URL with full HTML (temporary)
      },
      "rawUrl": "..."       // S3 pre-signed URL with raw MIME email (temporary)
    },
    "trace_id": "...",
    "context": {
      "id": "...",
      "project_id": "...",
      "ts": "2026-03-24T10:09:02.087Z",
      "workflow_id": "...",
      "deployment_id": "...",
      "emitter_id": "..."
    },
    "source_type": "COMPONENT",
    "verified": false,
    "test": false,
    "replay": false,
    "owner_id": "...",
    "platform_version": "3.62.0"
  }
}
```

---

## Field Path Table

| Purpose | JSON Path | Example Value |
|---------|-----------|---------------|
| Forwarding user's email (for account routing) | `trigger.event.headers.from.value[0].address` | `[EMAIL]` (manuelkuhs@gmail.com) |
| Forwarding user name | `trigger.event.headers.from.value[0].name` | `""` |
| Forwarding user (text form) | `trigger.event.headers.from.text` | `[EMAIL]` |
| Message-ID of the forwarded email (dedup key) | `trigger.event.headers["message-id"]` | `<8A6ECA90-6F2A-432C-977E-F6622E6BF878@gmail.com>` |
| Subject line | `trigger.event.headers.subject` | `Fwd: Ordered: 'The Pirates' Treasure: 3...'` |
| Date sent | `trigger.event.headers.date` | `2026-03-24T10:08:47.000Z` (ISO 8601) |
| Recipient (Pipedream address) | `trigger.event.headers.to.value[0].address` | `empk1lk0u08wjyn@upload.pipedream.net` |
| References (original Amazon message-ID) | `trigger.event.headers.references` | `<0102019d1afd38a6-...@eu-west-1.amazonses.com>` |
| Email body HTML | `trigger.event.body.html` | Full HTML string (see notes) |
| Email body HTML (full, S3 URL) | `trigger.event.body.htmlUrl` | S3 pre-signed URL (temporary, expires quickly) |
| Raw MIME email (S3 URL) | `trigger.event.rawUrl` | S3 pre-signed URL (temporary, expires quickly) |
| Return-path address | `trigger.event.headers["return-path"][0].value[0].address` | `[EMAIL]` |
| SES spam verdict | `trigger.event.headers["x-ses-spam-verdict"]` | `"PASS"` |
| SES virus verdict | `trigger.event.headers["x-ses-virus-verdict"]` | `"PASS"` |

---

## Amazon Sender Detection

This was a **forwarded** email. The original Amazon sender is NOT in the top-level `from` header — it appears only inside the forwarded message body.

**Original Amazon sender found in `trigger.event.body.html`:**

The HTML body contains a `<blockquote>` with the forwarded message header:
```html
<b>From:</b> "Amazon.co.uk" &lt;auto-confirm@amazon.co.uk&gt;
```

**Confirmed Amazon sender domain:** `amazon.co.uk` (specifically `auto-confirm@amazon.co.uk`)

**Important:** The top-level `from` header always shows the **user who forwarded** the email, not Amazon. To detect Amazon emails, the parser must scan the body HTML for the embedded forwarded headers.

**Detection strategy:** Search `body.html` for patterns like:
- `@amazon.co.uk`
- `@amazon.com`
- `ship-confirm@amazon.`
- `auto-confirm@amazon.`

---

## Body Structure Notes

- `body.html` is a string containing the **user's forwarding wrapper** (e.g. "Kind regards, Manuel") plus the original Amazon HTML embedded in `<blockquote type="cite">` tags
- **No plain text field** — only `html` is present in `body`
- `htmlUrl` and `rawUrl` are S3 pre-signed URLs that expire quickly (within minutes of the event) — do NOT rely on them at processing time
- The HTML is potentially very large (full Amazon order email with images/CSS)

---

## Routing (From Header)

The `from` field directly identifies which user forwarded the email. This is the routing key for selecting the correct YNAB account:

```json
"from": {
  "value": [{ "address": "manuelkuhs@gmail.com", "name": "" }],
  "html": "...",
  "text": "manuelkuhs@gmail.com"
}
```

- Manuel's Gmail: `manuelkuhs@gmail.com` → Manuel's YNAB account
- Emily-Kate's email: `[EMAIL]` → Emily-Kate's YNAB account

---

## Deduplication Key

Use `trigger.event.headers["message-id"]` as the idempotency key stored in the `ProcessedEmail` table.

Example value: `<8A6ECA90-6F2A-432C-977E-F6622E6BF878@gmail.com>`

This is the Message-ID of the forwarding email (Gmail-assigned), not the original Amazon email's Message-ID. That's fine — it's unique per delivery event.

---

## Payload Skeleton (Redacted)

```json
{
  "trigger": {
    "event": {
      "headers": {
        "return-path": [{ "value": [{ "address": "[EMAIL]", "name": "" }], "text": "[EMAIL]" }],
        "received": ["...routing hops..."],
        "x-ses-spam-verdict": "PASS",
        "x-ses-virus-verdict": "PASS",
        "received-spf": "pass ...",
        "authentication-results": "amazonses.com; spf=pass; dkim=pass; dmarc=pass",
        "dkim-signature": { "value": "v=1", "params": { "d": "gmail.com", ... } },
        "content-type": { "value": "multipart/alternative", "params": { "boundary": "..." } },
        "from": {
          "value": [{ "address": "[EMAIL]", "name": "" }],
          "text": "[EMAIL]"
        },
        "subject": "Fwd: Ordered: '...'",
        "message-id": "<[GUID]@gmail.com>",
        "references": "<[AMAZON-MESSAGE-ID]@eu-west-1.amazonses.com>",
        "to": {
          "value": [{ "address": "empk1lk0u08wjyn@upload.pipedream.net", "name": "" }],
          "text": "empk1lk0u08wjyn@upload.pipedream.net"
        },
        "date": "2026-03-24T10:08:47.000Z",
        "mime-version": "1.0 (1.0)",
        "x-mailer": "iPhone Mail (23D8133)"
      },
      "body": {
        "html": "<html>...<blockquote><b>From:</b> \"Amazon.co.uk\" &lt;auto-confirm@amazon.co.uk&gt;...</blockquote></html>",
        "htmlUrl": "https://pipedream-emails.s3.amazonaws.com/parsed/[UUID]?..."
      },
      "rawUrl": "https://pipedream-emails.s3.amazonaws.com/[SES-ID]?..."
    },
    "trace_id": "[TRACE_ID]",
    "context": {
      "id": "[CONTEXT_ID]",
      "project_id": "proj_[ID]",
      "ts": "2026-03-24T10:09:02.087Z",
      "workflow_id": "p_[ID]",
      "deployment_id": "d_[ID]",
      "emitter_id": "ei_[ID]",
      "attachments": {}
    },
    "source_type": "COMPONENT",
    "verified": false,
    "test": false,
    "replay": false,
    "hops": null,
    "owner_id": "o_[ID]",
    "platform_version": "3.62.0"
  }
}
```

---

## Unexpected / Notable Fields

- **No plain text body** — only `html` present in `body`. Parser must handle HTML.
- **S3 URLs expire** — `htmlUrl` and `rawUrl` should not be stored or relied on after initial processing.
- **Forwarded email structure** — Amazon sender is in the body HTML, not in top-level headers. This is expected for user-forwarded emails.
- **`references` header** contains the original Amazon Message-ID — could be used as a secondary dedup check against the original email.
- **`x-mailer: iPhone Mail`** — the user forwarded from iPhone Mail (Apple Mail iOS). This confirms the email was forwarded manually, not via a filter rule.
