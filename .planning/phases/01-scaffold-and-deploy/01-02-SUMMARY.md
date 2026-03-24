---
phase: 01-scaffold-and-deploy
plan: "02"
subsystem: infra
tags: [railway, postgresql, prisma, pipedream, webhook, next.js]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js scaffold with /api/webhook stub, Prisma schema, Railway config
provides:
  - Live Next.js app at https://ynab-automation-production.up.railway.app
  - GET /api/webhook returns {"status":"ok"} with 200
  - POST /api/webhook returns {"received":true} with 200
  - PostgreSQL on Railway with DATABASE_URL auto-set
  - ProcessedEmail table migrated via Prisma on boot
  - All secrets configured with real values (ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL)
  - Pipedream inbound email address (empk1lk0u08wjyn@upload.pipedream.net) routes to /api/webhook
affects:
  - 02-inbound-email

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Railway CLI deploy with railway up --detach for async background builds
    - Prisma migrate deploy on boot via Railway startCommand (zero-downtime schema bootstrap)
    - Pipedream as inbound email webhook relay (replaces Postmark/Mailgun)

key-files:
  created: []
  modified:
    - ".env.example (EMAIL_PROVIDER note updated conceptually — Pipedream replaces Mailgun)"

key-decisions:
  - "Pipedream replaces Mailgun/Postmark for inbound email — user configured Pipedream as the email routing service; inbound address empk1lk0u08wjyn@upload.pipedream.net forwards to the Railway webhook"
  - "No MAILGUN_API_KEY or POSTMARK_SERVER_TOKEN needed — Pipedream does not require a server-side API key for webhook routing"
  - "Three secrets set in Railway: ANTHROPIC_API_KEY (sk-ant-api03-*), YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL (auto-set by Railway PostgreSQL)"

patterns-established:
  - "Pipedream inbound: email arrives at Pipedream address, Pipedream POSTs JSON payload to /api/webhook — no API key needed on the app side"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04]

# Metrics
duration: 2-session (checkpoint)
completed: 2026-03-24
---

# Phase 01 Plan 02: Deploy and Configure Summary

**Next.js app live on Railway at https://ynab-automation-production.up.railway.app with PostgreSQL, Prisma migrations on boot, real API secrets, and Pipedream inbound email routing to /api/webhook**

## Performance

- **Duration:** 2 sessions (deploy + checkpoint resolution)
- **Started:** 2026-03-23T22:20:00Z
- **Completed:** 2026-03-24T09:26:12Z
- **Tasks:** 3 (Tasks 1-2 automated, Task 3 human checkpoint)
- **Files modified:** 0 local (Railway remote configuration only)

## Accomplishments
- Next.js app deployed to Railway, accessible via HTTPS with Railway-assigned domain
- PostgreSQL provisioned on Railway; DATABASE_URL auto-set; ProcessedEmail table migrated via Prisma on first boot
- All secrets configured with real values: ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL
- Pipedream configured as inbound email relay — empk1lk0u08wjyn@upload.pipedream.net routes to /api/webhook
- GET /api/webhook returns `{"status":"ok"}` (200); POST /api/webhook returns `{"received":true}` (200)

## Task Commits

Each task was committed atomically:

1. **Task 1: Deploy Next.js app to Railway** - `93f878c` (feat)
2. **Task 2: Provision PostgreSQL and set placeholder env vars** - `fd3602e` (chore)
3. **Task 3 (checkpoint): Set real secrets + configure Pipedream inbound** - resolved manually; email provider switch committed in `b654440` and `889f2c9`

**Plan metadata:** _(final docs commit to follow)_

## Files Created/Modified

No local files were created or modified in this plan — all changes were Railway remote configuration (environment variables, provisioned database service).

## Decisions Made

- **Pipedream instead of Mailgun/Postmark:** The plan specified Mailgun as the inbound email service and Postmark as the fallback. The user chose Pipedream instead — it provides a free inbound email address that POSTs JSON to any webhook URL, with no server-side API key needed. This simplifies the app: no `MAILGUN_API_KEY` or `POSTMARK_SERVER_TOKEN` variable required.
- **Inbound address:** `empk1lk0u08wjyn@upload.pipedream.net` — this is the address Manuel and Emily-Kate will forward Amazon emails to.
- **No MAILGUN_API_KEY set:** Plan originally specified four secrets (including MAILGUN_API_KEY). With Pipedream, only three are needed: ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Plan Mismatch] Email provider changed from Mailgun to Pipedream**
- **Found during:** Task 3 checkpoint resolution
- **Issue:** Plan specified Mailgun for inbound email, but user configured Pipedream instead. The plan's `MAILGUN_API_KEY` requirement became irrelevant.
- **Fix:** Accepted Pipedream as the inbound provider. No code change required — webhook endpoint is provider-agnostic. Updated `.planning` commits to reflect Pipedream.
- **Files modified:** None (Railway env vars only; no MAILGUN_API_KEY was set)
- **Verification:** Pipedream configured to POST to https://ynab-automation-production.up.railway.app/api/webhook. GET + POST verified 200 OK.
- **Committed in:** 889f2c9 (chore: switch email provider to Pipedream)

---

**Total deviations:** 1 (plan change — email provider substitution)
**Impact on plan:** Simplifies the app — one fewer secret to manage. Webhook endpoint is provider-agnostic so no code change was needed. Phase 2 email parsing will need to handle Pipedream's JSON envelope format rather than Mailgun's.

## Issues Encountered

None beyond the email provider substitution above. Railway deploy, database provisioning, and secret configuration all proceeded as planned.

## User Setup Required

**External services configured during this plan:**

- **Railway secrets:** ANTHROPIC_API_KEY, YNAB_PERSONAL_ACCESS_TOKEN — set manually in Railway dashboard
- **Pipedream inbound:** `empk1lk0u08wjyn@upload.pipedream.net` configured to POST to `https://ynab-automation-production.up.railway.app/api/webhook`

**Note for Phase 2:** Pipedream POSTs a JSON envelope when an email arrives. Phase 2 will need to parse that envelope format to extract the email sender, subject, and body. The exact Pipedream webhook payload schema should be verified before building the parser.

## Next Phase Readiness

- Live HTTPS endpoint verified: GET and POST both return 200
- PostgreSQL up with ProcessedEmail table for dedup tracking
- All secrets configured (real values, not placeholders)
- Inbound email routing live: Pipedream address routes to Railway webhook
- **Phase 2 can begin:** Infrastructure gate cleared — ready to implement email parsing and YNAB transaction creation

---
*Phase: 01-scaffold-and-deploy*
*Completed: 2026-03-24*

## Self-Check: PASSED

- FOUND: .planning/phases/01-scaffold-and-deploy/01-02-SUMMARY.md
- FOUND: commit 93f878c (Task 1 — Railway deploy)
- FOUND: commit fd3602e (Task 2 — PostgreSQL + placeholder secrets)
- FOUND: commit 889f2c9 (Pipedream email provider switch)
- VERIFIED: GET /api/webhook → {"status":"ok"} HTTP 200
- VERIFIED: POST /api/webhook → {"received":true} HTTP 200
- VERIFIED: Railway secrets — ANTHROPIC_API_KEY (sk-ant-api03-*), YNAB_PERSONAL_ACCESS_TOKEN, DATABASE_URL all set
