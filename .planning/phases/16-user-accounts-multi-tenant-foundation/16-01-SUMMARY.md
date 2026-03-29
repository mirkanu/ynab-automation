---
phase: 16-user-accounts-multi-tenant-foundation
plan: 01
subsystem: auth
tags: [next-auth, auth-js, prisma, resend, email, magic-link, database-sessions, multi-tenant]

# Dependency graph
requires: []
provides:
  - "Auth.js v5 with Resend email provider (magic link) and PrismaAdapter"
  - "Database-backed sessions with session.user.id typed as string"
  - "User, Account, Session, VerificationToken Prisma models"
  - "Nullable userId on Setting, ProcessedEmail, ActivityLog (multi-tenant prep)"
  - "/auth/signin, /auth/error, /auth/verify-request pages with loading skeletons"
  - "Dashboard layout protected by auth() session check"
affects:
  - 16-02
  - 16-03
  - 17-ynab-oauth
  - 18-per-user-email

# Tech tracking
tech-stack:
  added:
    - "next-auth@beta (Auth.js v5)"
    - "@auth/prisma-adapter"
  patterns:
    - "Auth.js database session strategy with PrismaAdapter"
    - "Magic link (email OTP) passwordless authentication via Resend"
    - "Session.user.id augmented via TypeScript module declaration"
    - "Server actions for signOut in dashboard layout"

key-files:
  created:
    - "src/lib/auth.ts — Auth.js config: PrismaAdapter, Resend provider, database sessions, session.user.id callback"
    - "src/types/next-auth.d.ts — TypeScript augmentation making Session.user.id a non-optional string"
    - "src/app/api/auth/[...nextauth]/route.ts — Auth.js catch-all route handler"
    - "src/app/auth/signin/page.tsx — Magic link request form (client component)"
    - "src/app/auth/signin/loading.tsx — Shimmer skeleton for navigation"
    - "src/app/auth/verify-request/page.tsx — Check-your-email confirmation page"
    - "src/app/auth/verify-request/loading.tsx — Skeleton"
    - "src/app/auth/error/page.tsx — Auth error page with human-readable error messages"
    - "src/app/auth/error/loading.tsx — Skeleton"
    - "tests/auth/signup-magic-link.test.ts — AUTH-01/02/03 stubs (3 pass, 3 todo)"
    - "prisma/migrations/20260328100000_add_authjs_models_and_user_id_nullable/migration.sql"
  modified:
    - "prisma/schema.prisma — Added User, Account, Session, VerificationToken; nullable userId on existing models"
    - "src/app/(dashboard)/layout.tsx — Replaced iron-session with auth() from Auth.js, server action signOut"
    - "vitest.config.ts — Added @/ path alias resolving to ./src"
    - ".env.example — Added NEXTAUTH_SECRET, NEXTAUTH_URL, EMAIL_FROM"

key-decisions:
  - "Auth.js auth.ts lives at src/lib/auth.ts (not root lib/) because tsconfig @/ alias maps to ./src"
  - "Magic link signin page uses client component with fetch to /api/auth/signin/resend (not server action) to control redirect behavior"
  - "Migration created as manual SQL file and deployed via Railway SSH since internal DB URL (postgresql.railway.internal) is only accessible within Railway's private network"
  - "Nullable userId added to Setting, ProcessedEmail, ActivityLog in this plan; plan 02 will make them NOT NULL with backfill"

patterns-established:
  - "Auth check pattern: const session = await auth(); if (!session) redirect('/auth/signin');"
  - "SignOut pattern: server action calling signOut({ redirectTo: '/auth/signin' })"
  - "Loading skeleton pattern: pure CSS shimmer with inline styles, no shadcn dependency"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 80min
completed: 2026-03-29
---

# Phase 16 Plan 01: Auth.js v5 Magic Link + PrismaAdapter Foundation Summary

**Auth.js v5 passwordless signup with Resend magic links, PrismaAdapter database sessions, session.user.id typed end-to-end, and multi-tenant schema preparation**

## Performance

- **Duration:** 80 min
- **Started:** 2026-03-28T22:52:00Z
- **Completed:** 2026-03-29T00:12:13Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Installed next-auth@beta + @auth/prisma-adapter; configured Auth.js with Resend email provider and database sessions
- Added User, Account, Session, VerificationToken to Prisma schema; added nullable userId to Setting, ProcessedEmail, ActivityLog; migration applied to Railway PostgreSQL
- Created /auth/signin (magic link form), /auth/verify-request, and /auth/error pages each with loading.tsx skeletons; updated dashboard layout to use auth() session guard with server action signOut

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Auth.js and configure lib/auth.ts** - `cb6fd08` (feat)
2. **Task 2: Add Auth.js Prisma models and run migration** - `dc2d69a` (feat)
3. **Task 3: Create auth UI, update dashboard, write test stubs** - `79d10c9` (feat)

## Files Created/Modified
- `src/lib/auth.ts` — Auth.js v5 config: PrismaAdapter(prisma), Resend provider, database strategy, session.user.id callback
- `src/types/next-auth.d.ts` — Module augmentation making Session.user.id a non-optional string
- `src/app/api/auth/[...nextauth]/route.ts` — Catch-all handler re-exporting GET/POST from handlers
- `prisma/schema.prisma` — User, Account, Session, VerificationToken models added; nullable userId on existing models
- `prisma/migrations/20260328100000_.../migration.sql` — DB migration (applied via Railway deploy)
- `src/app/auth/signin/page.tsx` — Magic link request form (client component)
- `src/app/auth/signin/loading.tsx` — Navigation skeleton
- `src/app/auth/verify-request/page.tsx` — "Check your email" confirmation
- `src/app/auth/verify-request/loading.tsx` — Skeleton
- `src/app/auth/error/page.tsx` — Auth error display with error code mapping
- `src/app/auth/error/loading.tsx` — Skeleton
- `src/app/(dashboard)/layout.tsx` — Replaced iron-session with auth() guard + server action signOut
- `tests/auth/signup-magic-link.test.ts` — AUTH-01/02/03 test stubs (3 pass, 3 todo)
- `vitest.config.ts` — Added @/ path alias

## Decisions Made
- Auth.js config at `src/lib/auth.ts` (not root `lib/`) because tsconfig `@/*` alias maps to `./src/*`
- Magic link signin page is a client component using fetch rather than a server action to control redirect behavior explicitly
- Migration applied via Railway SSH (`railway ssh -- npx prisma migrate deploy`) because postgresql.railway.internal is only accessible inside Railway's private network
- Nullable userId added to existing models now; plan 02 will add NOT NULL constraint with data backfill

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @/ path alias to vitest.config.ts**
- **Found during:** Task 3 (test file creation)
- **Issue:** Tests importing `@/lib/auth` failed with ERR_MODULE_NOT_FOUND — vitest did not have the @/ alias configured despite tsconfig having it
- **Fix:** Added `resolve.alias` in vitest.config.ts pointing `@` to `./src`
- **Files modified:** vitest.config.ts
- **Verification:** Tests pass after fix
- **Committed in:** 79d10c9 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for test resolution; zero scope creep.

## Issues Encountered
- Railway PostgreSQL only reachable via private network (postgresql.railway.internal) — `railway run` and `railway ssh` both require being routed through Railway's network. Solution: created migration SQL manually, committed it, deployed via `railway up`, then verified via `railway ssh -- npx prisma migrate status`. All 4 migrations now applied.

## User Setup Required
The following environment variables must be added to the Railway service (or .env.local for local dev):

```
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-railway-domain.up.railway.app
EMAIL_FROM=noreply@yourdomain.com
```

`RESEND_API_KEY` already exists in Railway variables.

`NEXTAUTH_SECRET` is required for Auth.js to sign cookies — the app will not work without it.

## Next Phase Readiness
- Auth.js foundation complete: handlers, auth(), signIn, signOut all exported and typed
- session.user.id is a non-null string in authenticated contexts
- Database has User, Account, Session, VerificationToken tables
- Setting, ProcessedEmail, ActivityLog have nullable userId column ready for plan 02 backfill
- Dashboard layout protects all routes — unauthenticated users redirected to /auth/signin
- Plan 02 (data isolation): wire userId filters into all queries, make userId NOT NULL

---
*Phase: 16-user-accounts-multi-tenant-foundation*
*Completed: 2026-03-29*
