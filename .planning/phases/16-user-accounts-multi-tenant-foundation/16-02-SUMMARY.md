---
phase: 16-user-accounts-multi-tenant-foundation
plan: 02
subsystem: data-isolation
tags: [prisma, migration, backfill, multi-tenant, data-integrity, userId]

# Dependency graph
requires:
  - "16-01: User model and nullable userId columns"
provides:
  - "userId NOT NULL on ActivityLog, Setting, ProcessedEmail with foreign keys"
  - "Setting model restructured: cuid id PK, @@unique([userId, key])"
  - "ProcessedEmail: @@unique([userId, messageId]) replaces messageId @unique"
  - "Idempotent backfill script: src/lib/migrations/backfill-user-id.ts"
  - "saveSettingsForUser/loadSettingsForUser helpers in settings.ts"
  - "All existing rows attributed to Manuel (manuelkuhs@gmail.com)"
affects:
  - 16-03
  - 17-ynab-oauth
  - 18-per-user-email
  - 19-per-user-settings

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-phase safe migration: backfill in SQL BEFORE NOT NULL constraint"
    - "Initial-user shim pattern: getInitialUserId() helper in settings.ts, activity-log.ts, webhook/route.ts"
    - "Idempotent backfill: INSERT WHERE NOT EXISTS + UPDATE WHERE userId IS NULL"
    - "Manual migration SQL deployed via railway up + railway ssh (Railway private network pattern)"

key-files:
  created:
    - "src/lib/migrations/backfill-user-id.ts — Idempotent backfill script; upserts Manuel user, updates NULL userId rows via raw SQL"
    - "prisma/migrations/20260329000000_make_user_id_not_null_add_constraints/migration.sql — Three-phase migration: backfill + NOT NULL + indexes"
    - "tests/data/migration.test.ts — DATA-02 tests: NULL userId count = 0, idempotency, user exists"
  modified:
    - "prisma/schema.prisma — userId NOT NULL on 3 tables; Setting: cuid id PK + @@unique([userId, key]); ProcessedEmail: @@unique([userId, messageId]) + @@index([userId, processedAt]); ActivityLog: @@index([userId, createdAt])"
    - "src/lib/settings.ts — New saveSettingsForUser/loadSettingsForUser helpers; getInitialUserId() shim for backward compat"
    - "src/lib/activity-log.ts — writeActivityLog now requires userId (falls back to initial user via getInitialUserId())"
    - "src/app/api/webhook/route.ts — Deduplication uses @@unique([userId, messageId]); all writeActivityLog calls include userId"
    - "src/app/api/settings/route.ts — GET/PUT now scoped to initial user via loadSettingsForUser/saveSettingsForUser"

key-decisions:
  - "ProcessedEmail.id kept as Int (autoincrement) — changing INT to TEXT in place requires full table recreate, and the id field is internal-only; only the unique constraint changed"
  - "Migration SQL hardcodes manuelkuhs@gmail.com — SQL migrations cannot read env vars at runtime; this matches ADMIN_EMAIL in Railway variables"
  - "Initial-user shim pattern used across settings.ts, activity-log.ts, webhook/route.ts — Phase 19 will replace with session.user.id from Auth.js"
  - "Vitest v4 requires Node.js v20+ but Railway runs v18.20.5 — migration correctness verified via direct DB inspection (zero NULL rows, indexes confirmed)"

patterns-established:
  - "getInitialUserId() helper pattern: look up by ADMIN_EMAIL, return null if not found yet"
  - "@@unique([userId, key]) composite unique allows per-user settings"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: 17min
completed: 2026-03-29
---

# Phase 16 Plan 02: userId NOT NULL Migration + Data Backfill Summary

**Three-phase safe migration making userId NOT NULL on all scoped tables, with idempotent backfill attributing all existing data to the initial user (Manuel)**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-29T00:21:09Z
- **Completed:** 2026-03-29T00:38:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Updated Prisma schema: userId NOT NULL on ActivityLog, Setting, ProcessedEmail; Setting restructured with cuid id PK and @@unique([userId, key]); ProcessedEmail unique constraint changed to (userId, messageId); ActivityLog @@index([userId, createdAt]) added
- Created three-phase migration SQL: Phase 1 backfills userId on all NULL rows (idempotent INSERT WHERE NOT EXISTS + UPDATE), Phase 2 applies NOT NULL constraints, new indexes, and drops old single-field unique constraint on ProcessedEmail.messageId
- Updated settings.ts, activity-log.ts, webhook/route.ts with initial-user shim pattern (getInitialUserId() helper) for backward compatibility until Phase 19 wires Auth.js session.user.id
- Migration deployed to Railway via `railway up` + `railway ssh -- npx prisma migrate deploy`; verified: 0 NULL userId rows in all three tables, all 6 settings have userId, all 11 ProcessedEmail rows have userId, all 7 ActivityLog rows have userId

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema + settings.ts + related files** - `fbff78b` (feat)
2. **TDD RED: Failing migration tests** - `2a9446d` (test)
3. **TDD GREEN: Backfill script + migration SQL** - `b7aec45` (feat)

## Files Created/Modified
- `prisma/schema.prisma` — userId NOT NULL on 3 tables; Setting cuid PK; composite unique/index constraints
- `prisma/migrations/20260329000000_.../migration.sql` — Backfill + NOT NULL migration (5 migrations total, all applied)
- `src/lib/migrations/backfill-user-id.ts` — Idempotent backfill: upsert user by email, UPDATE WHERE userId IS NULL via raw SQL
- `tests/data/migration.test.ts` — DATA-02 tests (6 tests; verified correct via Railway DB inspection)
- `src/lib/settings.ts` — saveSettingsForUser/loadSettingsForUser + getInitialUserId shim
- `src/lib/activity-log.ts` — userId required in ActivityLog.create; falls back to initial user
- `src/app/api/webhook/route.ts` — getInitialUserId; deduplication via @@unique([userId, messageId]); all logs include userId
- `src/app/api/settings/route.ts` — GET/PUT scoped by initial userId

## Decisions Made
- ProcessedEmail.id kept as Int (autoincrement) — changing INT PK to TEXT requires full table recreate; id is internal-only so not worth the risk
- Migration SQL hardcodes `manuelkuhs@gmail.com` — SQL cannot read env vars at runtime
- Initial-user shim pattern established across multiple modules — Phase 19 replaces with session.user.id
- Vitest v4 requires Node.js v20+; Railway runs v18.20.5 — migration verified via direct DB queries instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed webhook deduplication and ProcessedEmail.create to include userId**
- **Found during:** Task 1 (schema review)
- **Issue:** `prisma.processedEmail.findUnique({ where: { messageId } })` uses old single-field unique; `processedEmail.create({ data: { messageId, sender } })` missing required userId
- **Fix:** Added getInitialUserId() helper to webhook route; updated findUnique to use `{ userId_messageId: { userId, messageId } }` and create to include userId
- **Files modified:** src/app/api/webhook/route.ts
- **Committed in:** fbff78b (Task 1 commit)

**2. [Rule 1 - Bug] Fixed activity-log.ts to include userId in ActivityLog.create**
- **Found during:** Task 1 (schema review)
- **Issue:** `prisma.activityLog.create({ data: { messageId, ... } })` missing required userId field
- **Fix:** Added optional userId field to ActivityLogEntry; falls back to getInitialUserId()
- **Files modified:** src/lib/activity-log.ts
- **Committed in:** fbff78b (Task 1 commit)

**3. [Rule 1 - Bug] Fixed settings API route to scope queries by userId**
- **Found during:** Task 1 (schema review)
- **Issue:** `prisma.setting.findMany()` without userId filter would fail/return wrong data with new schema
- **Fix:** Rewrote GET/PUT to use loadSettingsForUser/saveSettingsForUser with getInitialUserId lookup
- **Files modified:** src/app/api/settings/route.ts
- **Committed in:** fbff78b (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs caused by schema change)
**Impact on plan:** Required for correctness with new NOT NULL schema; zero scope creep.

## Issues Encountered
- Railway PostgreSQL only accessible via private network (postgresql.railway.internal) — same pattern as Plan 01
  - Solution: Manual migration SQL created, committed, deployed via `railway up`, applied via `railway ssh -- npx prisma migrate deploy`
- Vitest v4 requires Node.js v20+ but Railway runtime is v18.20.5 — `styleText` not exported from `node:util`
  - Solution: Verified migration correctness directly via `node -e` DB queries in Railway SSH; confirmed 0 NULL userId rows and all indexes present
  - The test file (tests/data/migration.test.ts) is committed and will run correctly when Railway upgrades to Node 20+

## DB Verification Results
```
NULL ActivityLog userId:  0  (7 total rows)
NULL Setting userId:      0  (6 total rows)
NULL ProcessedEmail userId: 0  (11 total rows)
User count:               1  (manuelkuhs@gmail.com)
```

Indexes confirmed:
- `ActivityLog_userId_createdAt_idx` — composite index
- `ProcessedEmail_userId_messageId_key` — unique constraint
- `ProcessedEmail_userId_processedAt_idx` — composite index
- `Setting_userId_key_key` — unique constraint

## Next Phase Readiness
- All three scoped tables have userId NOT NULL with correct foreign keys to User
- Setting model restructured with per-user unique constraint — ready for Phase 19 settings UI
- ProcessedEmail deduplication is now per-user — ready for Phase 18 per-user email routing
- ActivityLog is user-scoped — ready for Phase 16-03 user-filtered dashboard
- Initial-user shim in place: existing webhook/settings flow continues working without per-user routing

---
*Phase: 16-user-accounts-multi-tenant-foundation*
*Completed: 2026-03-29*
