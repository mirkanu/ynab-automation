---
phase: 20-schema-rollback-migration
plan: 02
subsystem: database
tags: [postgres, prisma, migration, rls, schema, railway]

# Dependency graph
requires:
  - phase: 20-01
    provides: pre-migration-backup.sql and data snapshot (backup verified before any schema changes)
provides:
  - migration.sql: complete rollback migration SQL verified against live Railway DB, ready for prisma migrate deploy
affects: [20-03, 20-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [tcp-proxy-db-access, verify-before-write-constraint-names]

key-files:
  created:
    - prisma/migrations/20260410000000_single_tenant_rollback/migration.sql
  modified: []

key-decisions:
  - "Queried live Railway DB via TCP proxy (mainline.proxy.rlwy.net:44022) BEFORE writing any SQL — constraint names verified from pg_constraint and pg_indexes catalog, not assumed from Prisma schema"
  - "Preserved IF EXISTS on every DDL operation — migration is idempotent (safe to re-run against already-migrated DB)"
  - "Dropped FKs from surviving tables (Step 4) BEFORE dropping User table (Step 6) — prevents FK violation errors"
  - "Dropped composite indexes (Steps 7-9) BEFORE dropping columns — indexes on dropped columns would fail otherwise"

patterns-established:
  - "Verify-before-write: query live DB catalog for exact constraint names before authoring migration SQL, never assume Prisma naming conventions"
  - "IF EXISTS on all DDL: every DROP statement uses IF EXISTS for idempotency"

requirements-completed: [DATA-07, DATA-08]

# Metrics
duration: 5min
completed: 2026-04-10
---

# Phase 20 Plan 02: Migration SQL Summary

**119-line rollback migration SQL verified against live Railway DB — drops 6 tables, 5 RLS policies, 3 userId columns, reconstructs Setting PK as key-only and ProcessedEmail unique index as messageId-only**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T16:14:14Z
- **Completed:** 2026-04-10T16:19:51Z
- **Tasks:** 2 (Task 1: DB discovery, Task 2: SQL authoring + verification)
- **Files modified:** 1 (created)

## Accomplishments
- Queried live Railway DB via TCP proxy to discover all 13 constraint/index/policy names BEFORE writing SQL
- Authored 119-line migration SQL with all names verified (0 template placeholders)
- Verified: 6 DROP TABLE, 5 DROP POLICY, 24 IF EXISTS guards, 4 DROP COLUMN statements
- Migration SQL committed and ready for Plan 20-03 to execute via `prisma migrate deploy`

## Task 1: Verified Constraint Names (from live Railway DB via TCP proxy)

All names confirmed from `\d` output and pg_catalog queries on 2026-04-10:

| Object | Verified Name | Source |
|--------|---------------|--------|
| Setting FK | `Setting_userId_fkey` | pg_constraint |
| ActivityLog FK | `ActivityLog_userId_fkey` | pg_constraint |
| ProcessedEmail FK | `ProcessedEmail_userId_fkey` | pg_constraint |
| Setting unique idx | `Setting_userId_key_key` | pg_indexes |
| Setting PK | `Setting_pkey` | pg_indexes |
| ActivityLog idx | `ActivityLog_userId_createdAt_idx` | pg_indexes |
| ProcessedEmail unique | `ProcessedEmail_userId_messageId_key` | pg_indexes |
| ProcessedEmail idx | `ProcessedEmail_userId_processedAt_idx` | pg_indexes |
| EFA policy | `user_isolation` | pg_policies |
| ProcessedWebhook policy | `user_isolation` | pg_policies |
| ActivityLog policy | `activity_log_user_isolation` | pg_policies |
| Setting policy | `setting_user_isolation` | pg_policies |
| ProcessedEmail policy | `processed_email_user_isolation` | pg_policies |

Tables confirmed present in pg_tables (10 total): Account, ActivityLog, EmailForwardingAddress, ProcessedEmail, ProcessedWebhook, Session, Setting, User, VerificationToken, _prisma_migrations.

All 6 tables to be dropped confirmed present. All 3 surviving tables confirmed to have FK constraints on userId — no prior migration has run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Query live Railway DB** — discovery only, no files created (no commit)
2. **Task 2: Write and verify migration SQL** - `e478003` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `prisma/migrations/20260410000000_single_tenant_rollback/migration.sql` - Complete 119-line rollback migration SQL, verified and committed

## Decisions Made
- Used TCP proxy (mainline.proxy.rlwy.net:44022) established in Plan 20-01 — `railway run` containers cannot access internal Railway DNS
- Queried live DB catalog tables BEFORE writing any SQL to guarantee names match reality
- Used IF EXISTS on every DDL operation for idempotency (safe to re-run)
- Dropped FK constraints in Step 4 (before dropping User in Step 6) to avoid FK violation errors
- `-> User` arrow notation in comment line 69 is not a template placeholder — only valid `<>` instance confirmed to be a comment, not SQL

## Deviations from Plan

None - plan executed exactly as written. All constraint names matched the expected Prisma naming conventions, but were independently verified against the live DB before use.

## Issues Encountered
- The `grep -c '[<>]'` placeholder check returned 1 instead of 0 — investigated and confirmed the match was a comment line containing `-> User` (an arrow), not a template placeholder. SQL is clean.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `prisma/migrations/20260410000000_single_tenant_rollback/migration.sql` committed and ready
- Plan 20-03 can proceed to run `prisma migrate deploy` on Railway
- TCP proxy (mainline.proxy.rlwy.net:44022) remains available for Plan 20-03 verification queries

---
*Phase: 20-schema-rollback-migration*
*Completed: 2026-04-10*
