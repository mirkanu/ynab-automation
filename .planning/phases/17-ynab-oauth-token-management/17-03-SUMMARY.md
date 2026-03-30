---
phase: 17-ynab-oauth-token-management
plan: "03"
subsystem: auth
tags: [oauth, ynab, token-storage, encryption, next-auth, api-routes]

# Dependency graph
requires:
  - phase: 17-01
    provides: encryptToken/decryptToken in src/lib/crypto.ts
  - phase: 16
    provides: auth() session with user.id, prisma with User.oauthToken fields
provides:
  - OAuth authorize entry point — GET /api/ynab/authorize redirects to YNAB consent
  - OAuth callback — GET /api/ynab/callback exchanges code, stores encrypted tokens
  - Connection status check — GET /api/ynab/status returns { connected: boolean }
affects: [17-04, 17-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OAuth Authorization Code Grant: server-side code exchange, YNAB_CLIENT_SECRET never in client response"
    - "Token storage: encryptToken(access_token/refresh_token) + BigInt oauthExpiresAt = Date.now() + expires_in * 1000"
    - "TDD pattern: RED (failing test commit) -> GREEN (implementation commit) per task"
    - "Vitest mock: auth cast as unknown as { mockResolvedValueOnce } to avoid next-auth overload inference"

key-files:
  created:
    - src/app/api/ynab/authorize/route.ts
    - src/app/api/ynab/callback/route.ts
    - src/app/api/ynab/status/route.ts
  modified:
    - tests/ynab/oauth.test.ts

key-decisions:
  - "PKCE omitted for confidential server-side client (YNAB does not enforce it for server apps)"
  - "state param omitted from MVP — noted as future hardening for CSRF protection"
  - "YNAB_CLIENT_SECRET used via URLSearchParams in POST body only — never in redirect URL or response"
  - "URL-encoded redirect_uri in Location header requires decodeURIComponent in test assertions"
  - "console.error logs token exchange failure status only — response body never logged to avoid code/token leakage"

# Metrics
duration: 7min
completed: 2026-03-30
---

# Phase 17 Plan 03: YNAB OAuth Authorization Code Grant Flow Summary

**Three OAuth API routes implementing YNAB Authorization Code Grant: authorize redirect, encrypted token callback, and connection status check**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-30T07:33:36Z
- **Completed:** 2026-03-30T07:40:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GET /api/ynab/authorize redirects authenticated users to YNAB consent URL with `client_id`, `redirect_uri`, `response_type=code`
- GET /api/ynab/callback exchanges authorization code with YNAB token endpoint (server-side), stores AES-256-GCM encrypted access and refresh tokens with BigInt expiry timestamp
- GET /api/ynab/status returns `{ connected: boolean }` based on User.oauthToken presence
- All routes enforce authentication via auth() — unauthenticated requests return 401
- YNAB_CLIENT_SECRET never exposed in any client-facing response or redirect URL
- 10 TDD tests all pass; TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1+2 RED: Failing tests** - `6ee103a` (test: OAuth authorize, status, callback failing tests)
2. **Task 1 GREEN: Authorize + status routes** - `f06c609` (feat: OAuth authorize and status routes)
3. **Task 2 GREEN: Callback route** - `cce2a24` (feat: OAuth callback — code exchange and encrypted token storage)

_Note: TDD approach used single RED commit covering both tasks' tests, then two GREEN commits (one per task)_

## Files Created/Modified

- `src/app/api/ynab/authorize/route.ts` — GET: 401 if unauthenticated, redirect to YNAB consent URL
- `src/app/api/ynab/callback/route.ts` — GET: 401/400 guards, code exchange with YNAB, encrypted token storage, redirect to settings
- `src/app/api/ynab/status/route.ts` — GET: 401 if unauthenticated, returns { connected: !!user.oauthToken }
- `tests/ynab/oauth.test.ts` — Replaced it.todo stubs with 10 actual tests covering all routes and edge cases

## Decisions Made

- **PKCE omitted:** YNAB does not enforce PKCE for server-side confidential clients; noted for future CSRF hardening pass
- **state param omitted:** Scope kept small for v5.0 beta; future hardening can add CSRF state
- **client_secret in POST body:** Sent via URLSearchParams in POST body to YNAB token endpoint — never in redirect URL or JSON response
- **URL-encoded assertion pattern:** NextResponse.redirect URL-encodes the redirect_uri query param; tests use `decodeURIComponent(location)` before asserting path

## Deviations from Plan

**1. [Rule 1 - Bug] Test assertion adjusted for URL-encoded Location header**
- **Found during:** Task 2 GREEN verification
- **Issue:** Test asserted `/api/ynab/callback` in the Location header, but NextResponse.redirect encodes the redirect_uri to `%2Fapi%2Fynab%2Fcallback` in the YNAB authorize URL
- **Fix:** Added `decodeURIComponent(location)` before path assertion in test
- **Files modified:** tests/ynab/oauth.test.ts
- **Commit:** cce2a24

## Self-Check: PASSED

- FOUND: src/app/api/ynab/authorize/route.ts
- FOUND: src/app/api/ynab/callback/route.ts
- FOUND: src/app/api/ynab/status/route.ts
- FOUND: tests/ynab/oauth.test.ts (10 tests, all passing)
- FOUND: commit 6ee103a (test RED)
- FOUND: commit f06c609 (feat authorize/status GREEN)
- FOUND: commit cce2a24 (feat callback GREEN)
