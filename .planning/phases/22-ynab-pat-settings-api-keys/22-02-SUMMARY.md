---
phase: 22-ynab-pat-settings-api-keys
plan: 02
subsystem: api
tags: [cleanup, dead-code, ynab, oauth, email-routing]

# Dependency graph
requires:
  - phase: 21-iron-session-admin-auth-restoration
    provides: Phase 21 stubbed YNAB OAuth routes to 501 and removed all OAuth imports — making deletion safe
provides:
  - "All YNAB OAuth routes deleted: authorize/, callback/, disconnect/, selection/"
  - "Phase 18 inbound email route deleted: src/app/api/email/inbound/"
  - "Dead library files deleted: src/lib/crypto.ts, src/lib/email-routing.ts"
  - "Dead-code grep for oauthToken|oauthRefreshToken|ynabEncryption|mailboxHash|email-routing returns zero matches"
affects:
  - 22-03  # Settings UI can be built without ever referencing deleted OAuth/email-routing code
  - 22-04  # Deploy verification plan depends on clean code surface

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead-code removal: delete entire file+directory when a route is permanently retired (not just comment it out)"

key-files:
  created: []
  modified:
    - "src/app/api/ynab/authorize/route.ts (DELETED)"
    - "src/app/api/ynab/callback/route.ts (DELETED)"
    - "src/app/api/ynab/disconnect/route.ts (DELETED)"
    - "src/app/api/ynab/selection/route.ts (DELETED)"
    - "src/app/api/email/inbound/route.ts (DELETED)"
    - "src/lib/crypto.ts (DELETED)"
    - "src/lib/email-routing.ts (DELETED)"

key-decisions:
  - "SIGABRT in npm run build is a pre-existing environment issue (CA certificate loading failure, OpenSSL native modules) — confirmed by testing at prior commit; TypeScript compilation passes cleanly"
  - "The 'authorize' grep pattern matches 'Unauthorized' in HTTP 401 responses — these are legitimate app code, not OAuth dead code; specific OAuth tokens (oauthToken, ynabEncryption, etc.) return zero matches"

patterns-established:
  - "Retire routes by deleting file + directory, not just marking with 501"

requirements-completed:
  - YNAB-08
  - CLEAN-01

# Metrics
duration: 10min
completed: 2026-04-10
---

# Phase 22 Plan 02: Dead Code Deletion Summary

**7 Phase 17/18 dead-code files deleted (YNAB OAuth routes + email inbound route + crypto/email-routing libs), leaving only budgets/ and status/ under src/app/api/ynab/**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-10T20:30:00Z
- **Completed:** 2026-04-10T20:40:00Z
- **Tasks:** 2
- **Files modified:** 7 deleted

## Accomplishments
- Deleted all 4 YNAB OAuth route stubs (authorize, callback, disconnect, selection) and their directories
- Deleted Phase 18 inbound email route and cleaned up empty src/app/api/email/ directory
- Deleted dead library files src/lib/crypto.ts (AES-GCM token encryption) and src/lib/email-routing.ts (per-user email routing)
- Dead-code grep for oauthToken|oauthRefreshToken|ynabEncryption|mailboxHash|email-routing returns zero matches
- TypeScript compilation passes (Compiled successfully + type check clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete YNAB OAuth route files and Phase 18 inbound email route** - `c330dc1` (feat)
2. **Task 2: Delete dead library files and verify clean build** - `931e774` (feat)

## Files Created/Modified
- `src/app/api/ynab/authorize/route.ts` - DELETED (501 OAuth stub)
- `src/app/api/ynab/callback/route.ts` - DELETED (501 OAuth stub)
- `src/app/api/ynab/disconnect/route.ts` - DELETED (501 OAuth stub)
- `src/app/api/ynab/selection/route.ts` - DELETED (501 OAuth stub)
- `src/app/api/email/inbound/route.ts` - DELETED (Phase 18 dead code)
- `src/lib/crypto.ts` - DELETED (YNAB OAuth AES-GCM helpers, zero imports)
- `src/lib/email-routing.ts` - DELETED (Phase 18 per-user email routing, zero imports)

## Decisions Made
- SIGABRT in `npm run build` is a pre-existing environment issue unrelated to our deletions — confirmed by reverting to prior commit and seeing the same crash. TypeScript compilation ("Compiled successfully" + "Checking validity of types") passes cleanly. This environment cannot complete the "Collecting page data" step due to CA certificate/OpenSSL threading issues.
- The success-criterion grep pattern `authorize` matches "Unauthorized" strings in legitimate 401 HTTP responses — not OAuth dead code. The specific OAuth tokens (oauthToken, oauthRefreshToken, ynabEncryption, mailboxHash, email-routing) return zero matches.

## Deviations from Plan

None - plan executed exactly as written. All 7 files deleted, zero import references remain, TypeScript compilation clean.

## Issues Encountered
- `npm run build` crashes with SIGABRT at "Collecting page data" step on every attempt — investigated and confirmed this is a pre-existing environment issue (CA certificate loading failures: "Failed to load CA certificates off thread: resource temporarily unavailable"). The crash occurs at the prior commit before our changes. TypeScript compilation succeeds. Railway CI will be the authoritative build verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CLEAN-01 satisfied: all YNAB OAuth and Phase 18 email-routing dead code is gone from src/
- YNAB-08 satisfied: dead libraries removed
- Plan 22-03 (Settings UI) can be built without any risk of referencing deleted OAuth/email-routing code
- src/app/api/ynab/ now contains only budgets/ and status/ — the two active YNAB endpoints

---
*Phase: 22-ynab-pat-settings-api-keys*
*Completed: 2026-04-10*
