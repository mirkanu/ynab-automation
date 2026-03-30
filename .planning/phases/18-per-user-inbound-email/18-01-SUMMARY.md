---
phase: 18-per-user-inbound-email
plan: "01"
subsystem: database
tags: [prisma, postgresql, rls, email-routing, idempotency]

# Dependency graph
requires:
  - phase: 16-user-accounts-multi-tenant-foundation
    provides: RLS pattern (FORCE ROW LEVEL SECURITY + current_setting('app.user_id', true))
  - phase: 17-ynab-oauth-token-management
    provides: User model with forwardingEmail field already added
provides:
  - EmailForwardingAddress Prisma model (mailboxHash -> userId mapping)
  - ProcessedWebhook Prisma model (provider+providerId idempotency dedup)
  - Migration SQL with FORCE ROW LEVEL SECURITY on both new tables
  - Prisma client updated with prisma.emailForwardingAddress and prisma.processedWebhook
affects: [18-per-user-inbound-email plans 03 and 04 (forwarding address generation and webhook handling)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FORCE ROW LEVEL SECURITY on all user-scoped tables (matching Phase 16-03)"
    - "Manually authored migration SQL when no local DB available (npx prisma generate then hand-write SQL)"

key-files:
  created:
    - prisma/migrations/20260401000000_email_routing_tables/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Manually created migration SQL (no local PostgreSQL) — followed existing CREATE TABLE patterns from Phase 16 migrations"
  - "ProcessedWebhook uses SERIAL (autoincrement Int) PK — consistent with ProcessedEmail which also uses Int autoincrement"
  - "RLS policy uses current_setting('app.user_id', true) not current_app_user_id() function — matches Phase 18 plan spec exactly"

patterns-established:
  - "Manually author migration SQL when prisma migrate dev is unavailable (no local DB) — generate client separately via DATABASE_URL=postgresql://localhost/test npx prisma generate"

requirements-completed: [EMAIL-01, EMAIL-04]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 18 Plan 01: Per-User Email Routing Tables Summary

**Prisma schema and PostgreSQL migration adding EmailForwardingAddress (mailboxHash routing) and ProcessedWebhook (idempotency dedup) tables with FORCE RLS isolation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T09:47:51Z
- **Completed:** 2026-03-30T09:51:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `EmailForwardingAddress` model to Prisma schema: maps unique `mailboxHash` -> `userId`, with composite UNIQUE constraint on `(userId, mailboxHash)` and FK with CASCADE delete
- Added `ProcessedWebhook` model to Prisma schema: idempotency dedup log with UNIQUE constraint on `(provider, providerId)` — the critical atomic guard against duplicate YNAB transactions
- Created migration SQL with both CREATE TABLE statements, all indexes, FK constraints, and FORCE ROW LEVEL SECURITY policies matching Phase 16-03 pattern
- Regenerated Prisma client — `prisma.emailForwardingAddress` and `prisma.processedWebhook` now available
- TypeScript compiles clean (`tsc --noEmit` exits 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EmailForwardingAddress and ProcessedWebhook to schema.prisma** - `0163d98` (feat)
2. **Task 2: Generate migration and add RLS policies** - `38fea7b` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `prisma/schema.prisma` - Added EmailForwardingAddress and ProcessedWebhook models + back-relations on User
- `prisma/migrations/20260401000000_email_routing_tables/migration.sql` - CREATE TABLE, indexes, FK constraints, FORCE RLS policies for both tables

## Decisions Made
- Manually authored migration SQL instead of using `prisma migrate dev --create-only` because no local PostgreSQL is available; used `DATABASE_URL=postgresql://localhost/test npx prisma generate` to regenerate client from schema without needing a live DB
- RLS policies use `current_setting('app.user_id', true)` directly (not the `current_app_user_id()` function) — matches the plan spec exactly; both approaches work with `getPrismaForUser()`

## Deviations from Plan

None - plan executed exactly as written. The only adaptation was using a dummy DATABASE_URL for `prisma validate` and `prisma generate` since no local DB is available — this is a known constraint in this environment.

## Issues Encountered
- `npx prisma migrate dev --create-only` requires a live database connection; no local PostgreSQL available. Resolved by manually authoring the migration SQL following the established pattern from Phase 16 migrations.

## User Setup Required
None - no external service configuration required for this plan. The migration will be applied automatically on next Railway deploy.

## Next Phase Readiness
- Phase 18-03 (forwarding address generation) can now use `prisma.emailForwardingAddress` to create/read addresses
- Phase 18-04 (webhook handling) can now use `prisma.processedWebhook` for idempotency checks with `@@unique([provider, providerId])`
- Both tables are RLS-protected — plans 03 and 04 must use `getPrismaForUser(userId)` when querying these tables

---
*Phase: 18-per-user-inbound-email*
*Completed: 2026-03-30*
