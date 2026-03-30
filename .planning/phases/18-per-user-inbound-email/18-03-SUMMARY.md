---
phase: 18-per-user-inbound-email
plan: "03"
subsystem: auth
tags: [postmark, email, crypto, auth-js, prisma, tdd]

# Dependency graph
requires:
  - phase: 18-01
    provides: "Prisma schema with EmailForwardingAddress model and User.forwardingEmail field"
  - phase: 18-02
    provides: "Wave test stubs for email plans"
provides:
  - "generateMailboxHash: deterministic SHA256-based mailbox hash with user_ prefix"
  - "assignForwardingAddress: idempotent function that creates EmailForwardingAddress + updates User.forwardingEmail"
  - "Auth.js createUser event hook that auto-assigns forwarding address on signup"
affects:
  - 18-04
  - 18-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:crypto createHash('sha256') for deterministic non-reversible user identifiers"
    - "Auth.js events.createUser hook pattern for post-signup side effects"
    - "try/catch in createUser event — non-fatal errors never block signup"
    - "Idempotency via findFirst check before create in assignForwardingAddress"

key-files:
  created:
    - src/lib/email-forwarding.ts
    - tests/email/forwarding-address.test.ts
  modified:
    - src/lib/auth.ts
    - .env.example

key-decisions:
  - "generateMailboxHash embeds first 8 chars of userId for debugging but never the full userId — partial prefix + SHA256 suffix"
  - "assignForwardingAddress is idempotent via findFirst guard rather than upsert — simpler, avoids race write"
  - "createUser event errors are caught and logged, never propagated — signup must never be blocked by email assignment failure"
  - "POSTMARK_INBOUND_DOMAIN env var with default inbound.postmarkapp.com — configurable per environment"

patterns-established:
  - "Email forwarding: generateMailboxHash -> format user_{userId[0:8]}_{sha256[0:16]}"
  - "Email forwarding: forwardingEmail = mailboxHash@INBOUND_DOMAIN"
  - "Auth.js events: non-critical side effects go in events.* with try/catch"

requirements-completed: [EMAIL-01]

# Metrics
duration: 7min
completed: 2026-03-30
---

# Phase 18 Plan 03: Email Forwarding Library and Auth.js Hook Summary

**SHA256-based unique per-user mailbox hash library wired into Auth.js createUser event so every new user auto-receives a Postmark forwarding address at signup**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-30T09:58:08Z
- **Completed:** 2026-03-30T10:05:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented `generateMailboxHash(userId)` using SHA256 — deterministic, non-reversible, unique per user
- Implemented `assignForwardingAddress(userId)` — idempotent, creates EmailForwardingAddress record and updates User.forwardingEmail atomically
- Wired `assignForwardingAddress` into Auth.js `events.createUser` hook — every new signup automatically gets a forwarding address
- 7 tests passing (TDD RED→GREEN), no `it.todo` stubs remaining in forwarding-address.test.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement email-forwarding.ts with tests (TDD)** - `aac600c` (feat)
2. **Task 2: Wire assignForwardingAddress into Auth.js createUser event** - `0c586be` (feat)

**Plan metadata:** (see final commit below)

_Note: Task 1 was a TDD task — test file written first (RED), then implementation (GREEN) in same commit_

## Files Created/Modified
- `src/lib/email-forwarding.ts` - generateMailboxHash and assignForwardingAddress exports
- `tests/email/forwarding-address.test.ts` - 7 passing tests covering hash format, determinism, idempotency
- `src/lib/auth.ts` - Added events.createUser block importing and calling assignForwardingAddress
- `.env.example` - Added POSTMARK_INBOUND_DOMAIN with default value

## Decisions Made
- `generateMailboxHash` embeds first 8 chars of userId for debugging debuggability but never the full userId — attacker cannot reverse the email address to a user
- `assignForwardingAddress` uses `findFirst` guard for idempotency rather than upsert — avoids the ON CONFLICT complexity; acceptable for low-frequency signups
- `createUser` event wraps `assignForwardingAddress` in try/catch — signup must never be blocked by email assignment failure (e.g., DB timeout, Postmark domain not yet configured)
- `POSTMARK_INBOUND_DOMAIN` defaults to `inbound.postmarkapp.com` — no config required for local dev

## Deviations from Plan

None - plan executed exactly as written.

The only minor fix was changing the TypeScript type cast in the test file from `as { ... }` to `as unknown as { ... }` to satisfy the TypeScript compiler — this is a standard test pattern, not a deviation.

## Issues Encountered
Pre-existing test failures in `tests/email/security.test.ts`, `idempotency.test.ts`, `transaction-creation.test.ts` reference modules from future plans (18-04, 18-05) that don't exist yet. These failures are expected and existed before this plan. The target test file `tests/email/forwarding-address.test.ts` passes 7/7.

## Next Phase Readiness
- EMAIL-01 complete: every new user gets a unique, deterministic Postmark forwarding address
- Plan 18-04 (webhook routing) can now use `getUserFromForwardingAddress` to route inbound emails by mailboxHash
- `assignForwardingAddress` can be called retroactively for existing users (idempotent)

---
*Phase: 18-per-user-inbound-email*
*Completed: 2026-03-30*
