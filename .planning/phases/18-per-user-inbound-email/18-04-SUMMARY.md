---
phase: 18-per-user-inbound-email
plan: "04"
subsystem: api-routing
tags: [postmark, email-routing, idempotency, ynab, rls, tdd]

# Dependency graph
requires:
  - phase: 18-01
    provides: EmailForwardingAddress and ProcessedWebhook Prisma models
  - phase: 18-02
    provides: POSTMARK_INBOUND_DOMAIN env var pattern
  - phase: 17-ynab-oauth-token-management
    provides: createYnabTransaction, getValidYnabToken, getCategories, findCategory, getAccountName
  - phase: 16-user-accounts-multi-tenant-foundation
    provides: getPrismaForUser(userId) RLS pattern

provides:
  - POST /api/email/inbound webhook handler with IP check, dedup, routing, YNAB creation
  - verifyPostmarkIp utility (POSTMARK_IPS env var allowlist)
  - getUserFromForwardingAddress utility (mailboxHash -> userId via EmailForwardingAddress)
  - EMAIL-02 through EMAIL-05 fully implemented

affects:
  - Phase 18-05 (if any): integration and deployment

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: RED (test stubs) → GREEN (implementation) → verify cycle for both tasks"
    - "Global prisma for pre-userId reads (idempotency dedup check); getPrismaForUser for all known-user writes"
    - "ProcessedWebhook ordering: insert AFTER YNAB for success path; insert BEFORE return for early-exit paths"
    - "P2002 unique constraint violation caught at outer catch — race condition safe"

key-files:
  created:
    - src/lib/email-routing.ts
    - src/app/api/email/inbound/route.ts
    - tests/email/routing.test.ts
    - tests/email/security.test.ts
    - tests/email/idempotency.test.ts
    - tests/email/transaction-creation.test.ts
  modified:
    - .env.example

key-decisions:
  - "ProcessedWebhook for unknown recipient uses global prisma (no real userId) — RLS cannot be scoped without a userId"
  - "ProcessedWebhook for known user always uses getPrismaForUser(userId) — satisfies FORCE RLS policy"
  - "ProcessedWebhook inserted AFTER createYnabTransaction on success path — ensures retry is possible if YNAB fails"
  - "POSTMARK_IPS added to .env.example with real Postmark production IPs as reference"
  - "vi.importActual is async — must be awaited; mocked module imported at top level for use in beforeEach"

requirements-completed: [EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05]

# Metrics
duration: 12min
completed: 2026-03-30
---

# Phase 18 Plan 04: Inbound Email Webhook Handler Summary

**Inbound email webhook at POST /api/email/inbound: IP allowlist enforcement, idempotency via ProcessedWebhook, MailboxHash routing to userId, YNAB transaction creation with RLS-correct prisma scoping**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T09:59:21Z
- **Completed:** 2026-03-30T10:11:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `src/lib/email-routing.ts` with two exported utilities:
  - `verifyPostmarkIp(ip)`: checks IP against `POSTMARK_IPS` comma-separated env var; returns false if env var not set
  - `getUserFromForwardingAddress(toAddress)`: extracts local part from email address, queries `EmailForwardingAddress.findUnique({ where: { mailboxHash } })`, returns userId or null
- Created `POST /api/email/inbound` handler implementing the complete routing pipeline:
  1. IP verification (403 for non-Postmark IPs)
  2. Idempotency dedup via `processedWebhook.findUnique` (200 skipped for duplicates)
  3. MailboxHash routing (200 unknown_recipient for unrecognized addresses)
  4. User YNAB account verification (200 no_ynab_account if no oauthToken)
  5. Config/sender lookup, Claude email parsing, category hint resolution
  6. YNAB transaction creation via `createYnabTransaction(userId, params)`
  7. `processedWebhook.create` (with `userPrisma`) AFTER YNAB success
  8. Activity log write
  9. P2002 race condition caught and returns 200 gracefully
- All 5 test files under `tests/email/` pass (27 tests, 0 todos)
- TypeScript compiles clean (`tsc --noEmit` exits 0)
- Added `POSTMARK_IPS` to `.env.example` with Postmark production IPs

## Task Commits

Each task was committed atomically:

1. **Task 1: email-routing.ts utilities + routing/security tests** - `5710d41` (feat)
2. **Task 2: POST /api/email/inbound route + idempotency/transaction tests + .env.example** - `1871db8` (feat)

## Files Created/Modified

- `src/lib/email-routing.ts` — verifyPostmarkIp, getUserFromForwardingAddress utilities
- `src/app/api/email/inbound/route.ts` — POST handler with IP check, dedup, routing, YNAB call
- `tests/email/routing.test.ts` — 5 tests for getUserFromForwardingAddress
- `tests/email/security.test.ts` — 6 tests for verifyPostmarkIp + IP check behavior
- `tests/email/idempotency.test.ts` — 4 tests for ProcessedWebhook deduplication
- `tests/email/transaction-creation.test.ts` — 5 tests for YNAB routing and transaction creation
- `.env.example` — added POSTMARK_IPS with comment and reference IPs

## Decisions Made

- Global `prisma` used for idempotency read (before userId is known) and for `unknown_recipient` write (no real userId to scope RLS to)
- `getPrismaForUser(userId)` used for ALL ProcessedWebhook inserts where userId is a real user — satisfies FORCE RLS policy
- ProcessedWebhook for `success` path inserted AFTER `createYnabTransaction` — if YNAB fails, no ProcessedWebhook row exists so retry is permitted
- ProcessedWebhook for early-exit paths (`no_ynab_account`, `unknown_sender`, `parse_error`) inserted BEFORE return — prevents infinite retries for unroutable emails

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.importActual misuse in security.test.ts**

- **Found during:** Task 1 RED phase
- **Issue:** `vi.importActual` returns a Promise and must be awaited; the original attempt also tried to call it synchronously inside `it()`
- **Fix:** Changed test to use the already-imported mocked `verifyPostmarkIp` directly for the behavior test
- **Files modified:** tests/email/security.test.ts

**2. [Rule 1 - Bug] Fixed require() alias path in beforeEach**

- **Found during:** Task 2 RED phase
- **Issue:** `require('@/lib/email-routing')` inside `beforeEach` failed — CJS `require` does not resolve `@/` path aliases in the vitest environment
- **Fix:** Changed `require('@/lib/email-routing').verifyPostmarkIp` to use the top-level ESM import (`import { verifyPostmarkIp } from '@/lib/email-routing'`) which is properly resolved by vitest
- **Files modified:** tests/email/idempotency.test.ts, tests/email/transaction-creation.test.ts

## Pre-existing Test Failures (Out of Scope)

The following test failures existed before this plan and were NOT introduced by this work:
- `tests/data/migration.test.ts` — 2 failures (DATA-02 migration tests)
- `tests/data/multi-tenant-isolation.test.ts` — failures (require live DB)
- `src/lib/activity-log.test.ts` — 2 failures (pre-existing)
- `src/app/api/webhook/route.test.ts` — 5 failures (pre-existing)

These are deferred to appropriate fix plan and documented in `deferred-items.md`.

## Self-Check

---

## Self-Check: PASSED

Files verified:
- FOUND: src/lib/email-routing.ts
- FOUND: src/app/api/email/inbound/route.ts
- FOUND: tests/email/routing.test.ts (5 tests passing)
- FOUND: tests/email/security.test.ts (6 tests passing)
- FOUND: tests/email/idempotency.test.ts (4 tests passing)
- FOUND: tests/email/transaction-creation.test.ts (5 tests passing)

Commits verified:
- FOUND: 5710d41 (Task 1 — email-routing.ts + routing/security tests)
- FOUND: 1871db8 (Task 2 — route handler + remaining tests)

TypeScript: clean (tsc --noEmit exits 0)
Test suite: 27/27 email tests passing
