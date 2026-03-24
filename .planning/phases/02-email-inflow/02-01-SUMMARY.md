---
phase: 02-email-inflow
plan: "01"
subsystem: api
tags: [pipedream, webhook, email, nextjs, railway]

# Dependency graph
requires:
  - phase: 01-scaffold-and-deploy
    provides: Railway-hosted Next.js app with /api/webhook POST endpoint
provides:
  - Documented Pipedream JSON envelope shape with exact field paths
  - Confirmed Amazon sender domain (auto-confirm@amazon.co.uk)
  - Confirmed forwarding user routing key (trigger.event.headers.from.value[0].address)
  - Confirmed dedup key (trigger.event.headers["message-id"])
  - PAYLOAD.md artifact for Phase 2 parser implementation
affects:
  - 02-02 (webhook implementation — needs PAYLOAD.md field paths)
  - 03-parse-and-create (needs Amazon sender detection pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipedream email envelope: trigger.event.headers + trigger.event.body.html"
    - "Amazon sender detection via body HTML scan (not top-level from header)"
    - "Forwarded email routing via trigger.event.headers.from.value[0].address"

key-files:
  created:
    - .planning/phases/02-email-inflow/PAYLOAD.md
  modified:
    - src/app/api/webhook/route.ts

key-decisions:
  - "Amazon sender is NOT in top-level from header — must scan body.html for embedded forwarded headers"
  - "Dedup key is trigger.event.headers[\"message-id\"] (Gmail-assigned on forward, unique per delivery)"
  - "No plain text body field — only html present in body; parser must handle HTML"
  - "S3 URLs in htmlUrl/rawUrl expire quickly — do not store or rely on them post-processing"

patterns-established:
  - "Payload path: trigger.event.headers.from.value[0].address for routing user identification"
  - "Payload path: trigger.event.headers[\"message-id\"] for idempotency key"
  - "Amazon detection: search body.html for @amazon.co.uk or @amazon.com patterns"

requirements-completed: [EMAIL-01]

# Metrics
duration: 35min
completed: 2026-03-24
---

# Phase 2 Plan 01: Pipedream Payload Discovery Summary

**Captured real Pipedream email envelope from Railway logs — documented exact JSON field paths for forwarded Amazon email parsing (forwarding user, dedup key, Amazon sender detection via body HTML)**

## Performance

- **Duration:** ~35 min (including human-action checkpoint wait)
- **Started:** 2026-03-24T09:45:00Z
- **Completed:** 2026-03-24T10:15:00Z
- **Tasks:** 3 (1 auto + 1 human-action + 1 auto)
- **Files modified:** 2

## Accomplishments

- Added temporary PIPEDREAM_PAYLOAD logging to webhook and deployed to Railway
- Received a real forwarded Amazon order email; captured the full Pipedream JSON envelope in Railway logs
- Documented exact field paths in PAYLOAD.md including message-id dedup key, forwarding user routing key, and Amazon sender detection strategy
- Confirmed no plain text body — only HTML body with forwarded email embedded in `<blockquote>` tags
- Reverted route.ts to clean stub and redeployed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add temporary body logging to webhook and deploy** - `eaa578e` (feat)
2. **Task 2: Forward a real Amazon email to Pipedream** - human-action checkpoint (no commit)
3. **Task 3: Extract payload shape from Railway logs and document it** - `7e0c7c2` (feat)

## Files Created/Modified

- `.planning/phases/02-email-inflow/PAYLOAD.md` — Full Pipedream envelope documentation with field path table, dedup key, routing key, Amazon sender detection strategy, and redacted payload skeleton
- `src/app/api/webhook/route.ts` — Reverted to clean stub (removed console.log, added TODO Phase 2 comment)

## Decisions Made

- **Amazon sender is NOT in top-level from header.** When a user forwards an email via iPhone Mail, the `from` header shows the user's Gmail address. The original Amazon sender (`auto-confirm@amazon.co.uk`) appears only inside the body HTML in a `<blockquote>` — must parse body HTML to detect Amazon emails.
- **Use body.html scan for Amazon detection** — search for `@amazon.co.uk` / `@amazon.com` patterns in the HTML body content.
- **message-id as dedup key** — the Gmail-assigned Message-ID on the forwarding email is unique per delivery event and safe to use as the idempotency key.
- **No plain text field** — `body` only contains `html`. The parser will need to handle HTML extraction (e.g., using a library like `html-to-text` or passing raw HTML to Claude for parsing).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- PAYLOAD.md is complete with all field paths needed by Plan 02-02
- Phase 2 plan 02 executor can read PAYLOAD.md and implement parsing/routing/dedup logic without guesswork
- Key insight for next phase: Claude will receive the `body.html` content and must extract order details from the full HTML including forwarding wrapper — prompt should instruct Claude to look inside blockquote tags for the Amazon order content

---
*Phase: 02-email-inflow*
*Completed: 2026-03-24*
