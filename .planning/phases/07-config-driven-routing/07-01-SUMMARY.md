---
phase: 07-config-driven-routing
plan: 01
subsystem: config
tags: [config, routing, hygiene, publishing-readiness]
dependency_graph:
  requires: []
  provides: [config.ts with AppConfig, getSenderByEmail, getAccountForCurrency, notificationSuffix]
  affects: [route.ts, notify.ts, email.ts, all test files, .env.example]
tech_stack:
  added: []
  patterns: [config-driven routing, env-var validation, generic test fixtures]
key_files:
  created:
    - src/lib/config.ts
    - src/lib/config.test.ts
  modified:
    - src/app/api/webhook/route.ts
    - src/lib/notify.ts
    - src/lib/email.ts
    - src/lib/email.test.ts
    - src/lib/claude.test.ts
    - src/lib/claude.ts
    - src/lib/ynab.test.ts
    - src/lib/ynab.ts
    - .env.example
decisions:
  - "loadConfig() called at POST handler entry so config errors surface on every request"
  - "getSenderByEmail uses case-insensitive match to tolerate email case variation"
  - "getAccountForCurrency replaces the EUR-specific hardcoded check with a generic currency map"
  - "notificationSuffix replaces the senderLabel() function that hardcoded the manuelkuhs@gmail.com identity check"
  - "CURRENCY_ACCOUNTS defaults to {} (not an error) when absent — single-currency deployments need no change"
metrics:
  duration_minutes: 12
  completed_date: "2026-03-26"
  tasks_completed: 6
  tasks_total: 6
  files_modified: 9
  files_created: 2
requirements_satisfied: [CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, HYG-01, HYG-02, HYG-03, HYG-04]
---

# Phase 07 Plan 01: Config-Driven Routing Summary

**One-liner:** Replaced all hardcoded personal references with a SENDERS/ADMIN_EMAIL/CURRENCY_ACCOUNTS config system, making the codebase safe to publish.

## What Was Built

### src/lib/config.ts (new)

Single source of truth for sender routing and admin email. Exports:

- `loadConfig()` — reads `SENDERS` (JSON array, required), `ADMIN_EMAIL` (required), `CURRENCY_ACCOUNTS` (JSON object, optional, defaults to `{}`). Throws clear errors on missing or invalid env vars.
- `getSenderByEmail(config, email)` — case-insensitive lookup returning `SenderConfig | null`
- `getAccountForCurrency(config, senderAccountId, currency)` — returns currency override account ID or falls back to sender's default account
- `notificationSuffix(sender)` — returns ` (label)` if `notificationLabel` is set, `""` otherwise
- `SenderConfig` and `AppConfig` interfaces

### src/lib/config.test.ts (new)

20 tests covering all exported functions: loadConfig validation paths, getSenderByEmail case-insensitivity, getAccountForCurrency fallback, notificationSuffix both branches. TDD: tests written first (RED), then implementation (GREEN).

### src/app/api/webhook/route.ts (updated)

- Removed `SENDER_MAP` (hardcoded `manuelkuhs@gmail.com`, `Emily-Kate`, personal account IDs)
- Removed `senderLabel()` function (hardcoded identity check)
- Removed `MANUEL_EMAIL` import
- Removed personal env vars: `YNAB_MANUEL_ACCOUNT_ID`, `YNAB_EMILY_ACCOUNT_ID`, `YNAB_EURO_ACCOUNT_ID`, `EMILY_KATE_EMAIL`
- Added `loadConfig()` call at handler entry
- Uses `getSenderByEmail`, `getAccountForCurrency`, `notificationSuffix`, `config.adminEmail`

### src/lib/notify.ts (updated)

- Removed `const MANUEL_EMAIL = process.env.MANUEL_EMAIL ?? 'manuelkuhs@gmail.com'`
- Removed `export { MANUEL_EMAIL }`
- Now exports only `sendErrorNotification` and `NotificationOptions`

### Other files updated

- `src/lib/email.ts` — JSDoc comment updated: "Manuel or Emily-Kate" → generic description
- `src/lib/email.test.ts` — `manuelkuhs@gmail.com` → `alice@example.com`; signature test names updated
- `src/lib/claude.test.ts` — all `parseOrderEmail(..., 'Manuel')` → `'Alice'`
- `src/lib/claude.ts` — JSDoc example updated
- `src/lib/ynab.test.ts` — `senderName: 'Manuel'` → `'Alice'`; memo assertion updated
- `src/lib/ynab.ts` — interface comment example updated
- `.env.example` — replaced personal-specific vars with `SENDERS`, `CURRENCY_ACCOUNTS`, `ADMIN_EMAIL`

## Decisions Made

1. `loadConfig()` is called at POST handler entry (not module level) so config errors surface on every request with a clear message rather than silently failing at startup.
2. `getSenderByEmail` uses case-insensitive matching to tolerate email address case variation from inbound payloads.
3. `getAccountForCurrency` replaces the `parsed.currency === 'EUR'` hardcoded check with a generic currency-to-account map, supporting any future currency.
4. `CURRENCY_ACCOUNTS` defaults to `{}` (not an error) so single-currency deployments need no additional configuration.
5. `notificationSuffix` replaces `senderLabel()` which hardcoded the `manuelkuhs@gmail.com` email for identity checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated JSDoc examples in claude.ts and ynab.ts**
- **Found during:** Task 5 final grep check
- **Issue:** `grep -rn "Manuel\|Emily"` found two doc comment examples not listed in the plan's personal_references_to_remove section
- **Fix:** Updated example values in JSDoc `@param` comment (claude.ts) and interface inline comment (ynab.ts)
- **Files modified:** `src/lib/claude.ts`, `src/lib/ynab.ts`
- **Commits:** 0b28dc9

## Test Results

All 87 tests pass across 4 test files. TypeScript compiles clean with `npx tsc --noEmit`. Zero personal references found by grep in `src/` or `.env.example`.

## Commits

| Hash    | Message |
| ------- | ------- |
| 40d45f4 | feat(07-01): add config.ts with AppConfig loader and tests |
| 6894942 | feat(07-01): update route.ts to use config-driven sender routing |
| c834392 | feat(07-01): remove MANUEL_EMAIL export and hardcoded fallback from notify.ts |
| 00ade88 | chore(07-01): remove personal names from email.ts JSDoc comment |
| 0b28dc9 | chore(07-01): replace personal names with generic placeholders in tests and docs |
| 82e40cd | chore(07-01): update .env.example with new config-driven env var names |

## Self-Check: PASSED

All created/modified files exist and commits are present in git log.
