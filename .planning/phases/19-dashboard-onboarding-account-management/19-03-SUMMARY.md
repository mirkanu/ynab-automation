---
phase: 19-dashboard-onboarding-account-management
plan: "03"
subsystem: onboarding
tags: [onboarding, email-providers, auth-redirect, tdd]
dependency_graph:
  requires: [19-01]
  provides: [email-providers-lib, onboarding-page, onboarding-api, dashboard-redirect]
  affects: [src/app/(dashboard)/page.tsx, src/lib/email-providers.ts]
tech_stack:
  added: []
  patterns: [server-component-auth-guard, tdd-red-green, prisma-generate]
key_files:
  created:
    - src/lib/email-providers.ts
    - src/app/onboarding/page.tsx
    - src/app/onboarding/OnboardingSteps.tsx
    - src/app/onboarding/loading.tsx
    - src/app/api/onboarding/complete/route.ts
    - tests/onboarding/email-providers.test.ts
    - tests/onboarding/flow.test.ts
  modified:
    - src/app/(dashboard)/page.tsx
decisions:
  - "[Phase 19-03]: Onboarding redirect implemented in dashboard server component (not auth.ts redirect callback) — simpler pattern consistent with server component auth guard"
  - "[Phase 19-03]: prisma generate required after schema additions (onboardingCompleted, testMode) before TypeScript compiles clean — must be run as part of schema migration workflow"
metrics:
  duration: 12
  completed_date: "2026-03-30"
  tasks: 2
  files: 8
---

# Phase 19 Plan 03: Onboarding Flow + Email Provider Detection Summary

**One-liner:** 3-step guided onboarding with Gmail/Outlook/Apple/other provider detection + forwarding instructions, 9 passing tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Email provider detection library + tests | ada756f | src/lib/email-providers.ts, tests/onboarding/email-providers.test.ts |
| 2 | Onboarding route + components + API + dashboard redirect + flow tests | eaa95a6 | 6 files created/modified |

## What Was Built

### Task 1: Email Provider Detection (ONBD-02)

`src/lib/email-providers.ts` exports two pure functions:

- `detectEmailProvider(email)` — detects gmail/outlook/apple/other from email domain
- `getForwardingInstructions(provider, forwardingAddress)` — returns titled, stepped, linked instructions with `{address}` placeholder substituted

6 unit tests covering all provider variants and placeholder substitution.

### Task 2: Onboarding Page + Flow (ONBD-01)

- `/onboarding` server component: auth guard, reads user state, shows `OnboardingSteps` with provider-specific props
- `OnboardingSteps` client component: 3 numbered step cards (connect YNAB, forwarding address with copy button, provider-specific instructions with ordered list + help link)
- `POST /api/onboarding/complete`: sets `onboardingCompleted=true`, returns 401 for unauthenticated requests
- `/onboarding/loading.tsx`: skeleton placeholder for Suspense
- Dashboard redirect: new users (`onboardingCompleted=false`) redirected to `/onboarding` before seeing dashboard content

3 flow tests covering the API route: unauthenticated returns 401, authenticated sets flag, schema default invariant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client not regenerated after schema additions**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `onboardingCompleted` and `testMode` fields existed in schema.prisma but Prisma client types were stale — TypeScript reported "does not exist in type UserSelect"
- **Fix:** Ran `DATABASE_URL="..." npx prisma generate` to regenerate client types
- **Files modified:** node_modules/@prisma/client (generated)
- **Commit:** eaa95a6 (included in task commit)

**2. [Rule 2 - Auto-merge] Dashboard page linter merged 19-02 forwarding email pattern**
- **Found during:** Task 2 staging
- **Issue:** The linter applied the 19-02 forwarding email from DB pattern to the dashboard page (replacing env var `INBOUND_EMAIL` with `userRecord.forwardingEmail`)
- **Fix:** Accepted the improvement — reads `forwardingEmail` from User DB record, which is the correct multi-tenant approach
- **Files modified:** src/app/(dashboard)/page.tsx

## Self-Check

**Files exist:**
- [x] src/lib/email-providers.ts
- [x] src/app/onboarding/page.tsx
- [x] src/app/onboarding/OnboardingSteps.tsx
- [x] src/app/onboarding/loading.tsx
- [x] src/app/api/onboarding/complete/route.ts
- [x] tests/onboarding/email-providers.test.ts
- [x] tests/onboarding/flow.test.ts

**Commits exist:**
- [x] ada756f — Task 1
- [x] eaa95a6 — Task 2

**Tests:** 9/9 passing
**TypeScript:** clean (0 errors)
