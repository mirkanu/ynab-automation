---
phase: quick-7
plan: 7
subsystem: auth, setup-wizard, deploy-config
tags: [railway, iron-session, wizard, self-host, zero-config]
dependency_graph:
  requires: [src/lib/settings.ts, src/lib/db.ts]
  provides: [getSessionOptions, /api/setup/reset, RESET_PASSWORD recovery]
  affects: [src/lib/admin-session.ts, src/middleware.ts, src/app/setup/1/page.tsx, railway.json, README.md]
tech_stack:
  added: []
  patterns: [DB-backed secret with module-level cache, RESET_PASSWORD env var escape hatch]
key_files:
  created:
    - src/app/api/setup/reset/route.ts
  modified:
    - src/lib/admin-session.ts
    - src/lib/admin-session.test.ts
    - src/middleware.ts
    - railway.json
    - src/app/setup/1/page.tsx
    - README.md
decisions:
  - "IRON_SESSION_SECRET auto-generated via randomBytes(32) and stored in DB Setting table; module-level cache avoids per-request DB query"
  - "Env var IRON_SESSION_SECRET still accepted as override so existing deploys are not broken"
  - "RESET_PASSWORD guard lives in middleware but redirects to Node.js API route — Edge Runtime cannot use Prisma"
  - "Generated password charset excludes ambiguous chars (0/O/1/l/I) for easy copy-paste"
  - "railway.json environments block removed entirely; DATABASE_URL auto-injected by Railway Postgres plugin"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
---

# Quick Task 7: Zero-Config Railway Deploy Summary

**One-liner:** Auto-generate IRON_SESSION_SECRET from DB on first boot, add wizard password generator, and add RESET_PASSWORD recovery — Railway template now deploys with zero required environment variables.

## What Was Built

### Task 1 — Auto-generate IRON_SESSION_SECRET in DB + RESET_PASSWORD recovery

**Commits:** a0a2184

**src/lib/admin-session.ts** — Replaced the static `sessionOptions` constant with an async `getSessionOptions()` function. On first call it reads `IRON_SESSION_SECRET` from the DB; if absent it falls back to the env var; if still absent it generates a 32-byte hex secret via `randomBytes(32)`, persists it via `saveSettings()`, and caches it in a module-level variable so subsequent requests skip the DB round-trip. `getAdminSession()` now awaits `getSessionOptions()`.

**src/app/api/setup/reset/route.ts** (new) — GET handler that deletes `ADMIN_PASSWORD` and `WIZARD_COMPLETE` from the Setting table, then redirects to `/setup/1`. Returns 403 when `RESET_PASSWORD !== 'true'`. Runs in Node.js runtime (full Prisma access).

**src/middleware.ts** — Added RESET_PASSWORD guard at the top of the middleware function. When `RESET_PASSWORD === 'true'` and the request is not already to an `/api/` path, redirects to `/api/setup/reset`. The middleware matcher already excludes `/api/*` so there is no loop risk.

**railway.json** — Removed the `environments` block that contained the `IRON_SESSION_SECRET` generator. The file now has only `build` and `deploy` sections.

### Task 2 — Password auto-generate in wizard step 1 + README updates

**Commits:** 78dd2f9

**src/app/setup/1/page.tsx** — Added a `generatePassword()` helper using `window.crypto.getRandomValues()` with a 60-character safe charset (excludes 0/O/1/l/I). A "Generate password" text link above the password field calls it, sets both `password` and `confirm` states, and sets `generated = true`. When `generated` is true the input shows as `type="text"` with a copy-to-clipboard icon button that shows "Copied!" for 2 seconds. Manual edits reset `generated` to false and switch back to `type="password"`.

**README.md** — Updated four locations:
- Deploy button blurb: "true one-click, zero required env vars" replacing the `openssl rand` instruction
- Prerequisites section: removed IRON_SESSION_SECRET as a required manual value
- Step 1 deploy instructions: removed the IRON_SESSION_SECRET prompt step
- Self-Hosting Note: updated to say DATABASE_URL is the only required env var
- Troubleshooting: replaced IRON_SESSION_SECRET session loop advice; added "I forgot my admin password" entry describing the RESET_PASSWORD flow

## Verification Results

1. `npx tsc --noEmit` — zero errors (verified twice, after each task)
2. `grep -c "IRON_SESSION_SECRET" railway.json` → 0
3. `grep "getSessionOptions" src/lib/admin-session.ts` → export and usage present
4. `ls src/app/api/setup/reset/route.ts` → exists
5. `grep -c "RESET_PASSWORD" src/middleware.ts` → 2
6. `grep -c "openssl rand" README.md` → 0

All success criteria met.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing test coverage] Updated admin-session.test.ts for new API**
- **Found during:** Task 1
- **Issue:** Test file imported `sessionOptions` which was removed; tests would fail at runtime
- **Fix:** Rewrote tests to use `getSessionOptions()` with vi.mock for `@/lib/settings`
- **Files modified:** src/lib/admin-session.test.ts
- **Commit:** a0a2184

**2. [Rule 2 - Missing env var fallback] Retain IRON_SESSION_SECRET env var as override**
- **Found during:** Task 1 review
- **Issue:** Plan did not explicitly specify fallback to env var, but existing Railway deploys may have IRON_SESSION_SECRET set; dropping it would invalidate all existing sessions
- **Fix:** Added env var fallback between DB read and auto-generation (DB → env var → generate)
- **Files modified:** src/lib/admin-session.ts
- **Commit:** a0a2184

## Self-Check: PASSED

- src/app/api/setup/reset/route.ts: FOUND
- src/lib/admin-session.ts: FOUND (getSessionOptions exported)
- railway.json: FOUND (no environments block)
- Commits a0a2184 and 78dd2f9: FOUND in git log
