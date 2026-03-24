# Phase 3: Parse & Create — Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** STATE.md accumulated context + PAYLOAD.md + user direction

<domain>
## Phase Boundary

Phase 3 receives a pre-validated webhook (Phase 2 already confirmed it's Amazon, extracted sender, deduped). It now:
1. Calls Claude API to extract order amount and item description from the HTML email body
2. Creates a YNAB transaction in the correct account (Manuel's or Emily-Kate's) with the right memo, payee, and amount

No UI, no categories, no receipts. Just parse → create.

</domain>

<decisions>
## Implementation Decisions

### Claude Parsing
- **LOCKED:** Use Claude API (ANTHROPIC_API_KEY already on Railway) to parse `trigger.event.body.html`
- Claude receives the raw HTML body and returns structured JSON: `{ amount: number, description: string }`
- Claude must handle multi-item orders by summarizing into one description
- Amount must be a numeric value (pence/cents-agnostic — extract the number as shown, e.g. 12.99)
- No regex parsing — Claude handles Amazon email format variance

### YNAB Transaction Format
- **LOCKED:** Payee = "Amazon"
- **LOCKED:** Amount = negative outflow (YNAB uses milliunits: £12.99 → -12990)
- **LOCKED:** Memo = "{Sender First Name} — {Item Description}" (e.g. "Manuel — AirPods case")
- **LOCKED:** Uncategorized (no category_id)
- **LOCKED:** Date = today (date of processing, not order date)

### Account Routing
- Manuel (manuelkuhs@gmail.com) → Manuel's YNAB account
- Emily-Kate (email TBD — must be confirmed from env/config) → Emily-Kate's YNAB account
- YNAB budget ID, Manuel account ID, Emily-Kate account ID → store as Railway env vars
- Plan must include a task to call YNAB API and identify correct IDs before hardcoding anything

### YNAB API
- YNAB_PERSONAL_ACCESS_TOKEN already on Railway
- YNAB REST API: https://api.youneedabudget.com/v1
- Use native fetch (no YNAB SDK needed — simple POST to /budgets/{budgetId}/transactions)

### HTML Parsing for Claude
- Pass `trigger.event.body.html` directly to Claude — no pre-processing needed
- Claude is capable of extracting from messy HTML including forwarding wrappers
- Prompt should instruct Claude to look inside the Amazon blockquote, not the user's forwarding note

### Sender Name Mapping
- Sender email → display name mapping stored as env vars or hardcoded constants
- `manuelkuhs@gmail.com` → "Manuel"
- Emily-Kate's email → "Emily-Kate"
- This mapping is small and static — no database needed

### Claude's Discretion
- How to structure the Claude prompt (system vs user message)
- Whether to use streaming or single-shot response (single-shot is fine)
- Error handling if Claude returns unexpected format (retry once, then log and return 200)
- Whether to add a `YnabTransaction` model to Prisma (optional — could just use ProcessedEmail updated fields or a separate table)

</decisions>

<specifics>
## Specific Ideas

- Manuel's Gmail confirmed: `manuelkuhs@gmail.com`
- YNAB Personal Access Token: stored as `YNAB_PERSONAL_ACCESS_TOKEN` on Railway
- Anthropic API key: stored as `ANTHROPIC_API_KEY` on Railway
- App live at: ynab-automation-production.up.railway.app
- Payload body field: `trigger.event.body.html` (HTML string, may be large)
- Phase 2 already handles: dedup, Amazon filtering, sender extraction — Phase 3 receives a clean, validated payload
- Existing file to extend: `src/app/api/webhook/route.ts` (currently stops after storing ProcessedEmail)
- Email utilities: `src/lib/email.ts` (extractMessageId, extractOriginalSender, isFromAmazon already exist)

</specifics>

<deferred>
## Deferred Ideas

- YNAB category suggestion — v2 out of scope
- Receipt attachments — v2 out of scope
- Success/failure Telegram notifications — v2 out of scope
- Multiple YNAB budgets — out of scope
- Emily-Kate's specific email address — to be confirmed during execution (env var task)

</deferred>

---

*Phase: 03-parse-and-create*
*Context gathered: 2026-03-24 from accumulated project state*
