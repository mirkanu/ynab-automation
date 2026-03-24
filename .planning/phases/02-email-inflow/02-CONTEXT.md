# Phase 2: Email Inflow — Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** User direction + STATE.md accumulated context

<domain>
## Phase Boundary

Phase 2 receives real Pipedream webhook payloads, identifies the original sender, deduplicates by message ID, and silently ignores non-Amazon emails. No parsing or YNAB transaction creation — that is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Start Point: Real Amazon Email in Pipedream
- **LOCKED:** Phase 2 MUST begin by inspecting the actual Pipedream webhook JSON envelope from a real forwarded Amazon email (the user has already forwarded one to empk1lk0u08wjyn@upload.pipedream.net)
- First plan must retrieve the Pipedream event log to determine the actual payload shape before writing any parsing code
- Do NOT assume Pipedream's envelope format — derive it from the real payload

### Email Provider
- **LOCKED:** Pipedream (not Postmark, not Mailgun) — Pipedream forwards to `/api/webhook` as a POST with a JSON envelope
- Pipedream address: empk1lk0u08wjyn@upload.pipedream.net

### Deduplication
- **LOCKED:** Use PostgreSQL `ProcessedEmail` table (already migrated) to track message IDs
- Duplicate emails → reject silently with 200 OK (no error, no transaction)

### Sender Identification
- **LOCKED:** Extract original sender's email from forwarded message headers
- Two known senders: Manuel and Emily-Kate (exact emails to be confirmed from real payload)
- Non-Amazon sender → silently ignore (200 OK, no transaction)

### Amazon Filter
- **LOCKED:** Only process emails from Amazon (e.g. ship-confirm@amazon.com or similar)
- Exact Amazon sender domain to be confirmed from real payload

### Response Codes
- **LOCKED:** Always return 200 OK (Pipedream needs this to avoid retries)
- Log errors internally but never return 4xx/5xx to Pipedream

### Claude's Discretion
- How to distinguish "Amazon email" from "non-Amazon email" (domain check? subject check?)
- Whether to use a separate logging table or just console.log for observability
- How to handle Pipedream's exact header/body structure (depends on real payload)

</decisions>

<specifics>
## Specific Ideas

- Railway app URL: ynab-automation-production.up.railway.app
- Webhook endpoint: /api/webhook (POST)
- Pipedream address: empk1lk0u08wjyn@upload.pipedream.net
- A real Amazon email has been forwarded to Pipedream already — retrieve event log as step 1
- ProcessedEmail table already exists in PostgreSQL (from Phase 1)

</specifics>

<deferred>
## Deferred Ideas

- Email parsing (amount, item description) — Phase 3
- YNAB transaction creation — Phase 3
- Category assignment — v2 out of scope
- Success/failure notifications — v2 out of scope

</deferred>

---

*Phase: 02-email-inflow*
*Context gathered: 2026-03-24 from user direction*
