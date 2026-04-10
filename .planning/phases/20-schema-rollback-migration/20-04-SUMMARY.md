---
phase: 20-schema-rollback-migration
plan: 04
subsystem: database
tags: [prisma, schema, postgres, single-tenant, auth-js-removal]

# Dependency graph
requires:
  - phase: 20-03
    provides: production DB in single-tenant state (Auth.js tables dropped, userId columns removed)
provides:
  - prisma/schema.prisma: single-tenant schema with 3 models only (Setting, ProcessedEmail, ActivityLog)
  - npx prisma generate succeeds — Prisma client regenerated against single-tenant schema
affects: [phase-21]

# Tech tracking
tech-stack:
  added: []
  patterns: [schema-matches-db, prisma-generate-on-schema-change]

key-files:
  created: []
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Replaced full multi-tenant schema with 3-model single-tenant schema matching post-migration DB state exactly"
  - "Did not touch src/ code — Phase 21 owns all application code cleanup"
  - "DEPLOY FREEZE continues: v5.0 app code still references dropped Prisma types; next Railway build will fail until Phase 21 lands"

patterns-established:
  - "Schema and DB must agree before prisma generate can succeed — schema update always follows migration deployment"

requirements-completed: [DATA-05, DATA-06, DATA-07, DATA-08]

# Metrics
duration: 5min
completed: 2026-04-10
---

# Phase 20 Plan 04: Prisma Schema Sync Summary

**prisma/schema.prisma rewritten to 3-model single-tenant schema (Setting/ProcessedEmail/ActivityLog); Auth.js models and userId fields removed; npx prisma generate succeeds**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T16:32:00Z
- **Completed:** 2026-04-10T16:36:52Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced multi-tenant v5.0 schema (10 models, User/Account/Session/VerificationToken/EmailForwardingAddress/ProcessedWebhook + userId relations) with 3-model single-tenant schema
- Setting model: `key` as `@id`, no `userId` field, no `User` relation
- ProcessedEmail model: `messageId @unique`, no `userId`, no `User` relation
- ActivityLog model: no `userId`, no `User` relation, no composite indexes
- `npx prisma generate` exits 0: "Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 122ms"

## Schema State Post-Update

**Models (3 total):**
- `Setting` — key (PK), value, updatedAt
- `ProcessedEmail` — id (PK), messageId (UNIQUE), sender, processedAt
- `ActivityLog` — id (PK), messageId (UNIQUE), status, sender, subject, receivedAt, rawBody, parseResult, ynabResult, errorType, errorMessage, createdAt

**Removed:**
- `User`, `Account`, `Session`, `VerificationToken`, `EmailForwardingAddress`, `ProcessedWebhook` — all 6 models deleted
- `userId` fields — removed from all 3 remaining models
- `User` relations — removed from Setting, ProcessedEmail, ActivityLog
- Composite indexes referencing `userId` — removed from Setting, ProcessedEmail, ActivityLog

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1+2 | Rewrite schema + verify final state | ed634b6 | prisma/schema.prisma |

Note: Tasks 1 and 2 share a single commit. Task 2 is verification-only (no file changes beyond Task 1).

## Files Created/Modified

- `prisma/schema.prisma` — complete rewrite from 164 lines (multi-tenant) to 48 lines (single-tenant)

## Decisions Made

- Phase 21 owns all src/ code cleanup — this plan deliberately does NOT touch application code
- Schema committed as a single atomic commit covering both tasks

## DEPLOY FREEZE — CRITICAL NOTICE

**DEPLOY FREEZE IN EFFECT.** The v5.0 application code references Prisma types that no longer exist in the generated client. Any new Railway deployment will fail at TypeScript build time until Phase 21 lands.

**Freeze started:** 2026-04-10 16:26:56 UTC (Phase 20-03 migration deployment)
**Freeze ends:** When Phase 21 (iron-session Auth Restoration) completes and deploys

### Files Phase 21 MUST address before the next Railway redeploy

| File | Issue |
|---|---|
| `src/lib/auth.ts` | Imports `next-auth`, references `User` model, `Account`, `Session` types |
| `src/lib/db.ts` | Has `getPrismaForUser` with RLS extension; references `userId` pattern |
| `src/middleware.ts` | References session/user from Auth.js |
| Any `src/app/api/*/route.ts` that calls `getUserId()` | Will fail — `getUserId` depends on Auth.js session |
| Any route that uses `session.user` | Auth.js session types no longer generated |
| `package.json` | `next-auth`, `@auth/prisma-adapter` packages still listed — remove after code cleanup |

Phase 21 must:
1. Remove all application code that imports or uses dropped models
2. Remove Auth.js packages from package.json
3. Install and wire iron-session for single admin password auth
4. Deploy the Phase 21 changes before the next scheduled redeploy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx prisma generate` succeeded on first attempt with the new schema.

## Phase 20 Complete

With Plan 20-04 complete, all 4 Phase 20 plans are done:
- 20-01: Backup captured (pg_dump 765 lines + snapshot with 8 Setting rows)
- 20-02: Migration SQL authored and verified against live DB constraint names
- 20-03: Migration deployed 2026-04-10 16:26:56 UTC, all 7 verification criteria passed
- 20-04: schema.prisma updated, Prisma client regenerated successfully

The production database and Prisma schema are now in sync. Phase 21 must execute next.

## Next Phase Readiness

- Phase 21 (iron-session Admin Auth Restoration) is unblocked — schema is correct
- Phase 21 must complete and deploy before Railway triggers any automatic redeploy of the current v5.0 code
- The Prisma client is now generated without User/Account/Session types — Phase 21 TypeScript changes will compile against this client

---
*Phase: 20-schema-rollback-migration*
*Completed: 2026-04-10*
