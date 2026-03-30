---
phase: 17-ynab-oauth-token-management
plan: "01"
subsystem: auth
tags: [aes-256-gcm, encryption, crypto, prisma, postgres, token-security]

# Dependency graph
requires:
  - phase: 16-user-accounts-multi-tenant-foundation
    provides: User model with oauthToken/oauthRefreshToken/oauthExpiresAt fields
provides:
  - AES-256-GCM encryptToken/decryptToken functions in src/lib/crypto.ts
  - User schema extended with lastRefreshAttemptAt, selectedBudgetId, selectedAccountId
  - Migration SQL for token management columns
affects: [17-02, 17-03, 17-04, 17-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token encryption: nonce_hex:ciphertext_hex:authTag_hex format using Node.js crypto (built-in)"
    - "Key derivation: SHA-256 hash of TOKEN_ENCRYPTION_KEY env var → 32-byte AES key"
    - "TDD: RED (failing test commit) → GREEN (implementation commit) per-module"

key-files:
  created:
    - src/lib/crypto.ts
    - tests/ynab/encryption.test.ts
    - prisma/migrations/20260330000000_ynab_token_fields/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Node.js built-in crypto module used for AES-256-GCM (no libsodium native dep)"
  - "Key derived via SHA-256 from TOKEN_ENCRYPTION_KEY — deterministic, no salt needed for already-high-entropy env var"
  - "Error messages never include plaintext or ciphertext — throws generic 'Decryption failed'"
  - "Migration uses IF NOT EXISTS guards for safe re-application"

patterns-established:
  - "Token encryption format: {nonce_hex}:{ciphertext_hex}:{authTag_hex} — parse by splitting on colon"
  - "getDerivedKey() throws if TOKEN_ENCRYPTION_KEY missing or <32 chars — fail-fast at runtime"

requirements-completed: [YNAB-02]

# Metrics
duration: 7min
completed: 2026-03-30
---

# Phase 17 Plan 01: YNAB Token Encryption Foundation Summary

**AES-256-GCM token encryption module with random-nonce ciphertext and User schema extended with lastRefreshAttemptAt/selectedBudgetId/selectedAccountId for OAuth token management**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-30T07:21:02Z
- **Completed:** 2026-03-30T07:28:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Built AES-256-GCM encryption module using Node.js built-in `crypto` — no new dependencies
- Each encrypt call produces a different ciphertext due to random 12-byte nonce (nonce reuse attack prevention)
- GCM auth tag validation — tampered ciphertexts throw cleanly without leaking plaintext
- Extended User schema with three token management fields required by Plans 03–05
- All 4 TDD encryption tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: AES-256-GCM crypto module (RED)** - `0085e65` (test: failing encryption tests)
2. **Task 1: AES-256-GCM crypto module (GREEN)** - `cb74c98` (feat: encryptToken/decryptToken implementation)
3. **Task 2: Prisma schema migration** - `640cc11` (feat: lastRefreshAttemptAt, selectedBudgetId, selectedAccountId)

**Plan metadata:** (docs commit below)

_Note: TDD task has two commits — failing test commit then implementation commit_

## Files Created/Modified

- `src/lib/crypto.ts` — encryptToken/decryptToken using AES-256-GCM, key from TOKEN_ENCRYPTION_KEY
- `tests/ynab/encryption.test.ts` — 4 unit tests (roundtrip, random nonce, tamper detection, exact string)
- `prisma/schema.prisma` — User model extended with lastRefreshAttemptAt, selectedBudgetId, selectedAccountId
- `prisma/migrations/20260330000000_ynab_token_fields/migration.sql` — ALTER TABLE with IF NOT EXISTS guards

## Decisions Made

- **Node.js crypto (built-in) over libsodium:** libsodium requires native compilation; Node's built-in crypto is available everywhere and sufficient for AES-256-GCM
- **SHA-256 key derivation:** TOKEN_ENCRYPTION_KEY is already high-entropy (env secret), so SHA-256 hash gives consistent 32-byte key without PBKDF2 overhead
- **IF NOT EXISTS in migration SQL:** Guards against re-application on already-migrated databases; standard pattern for this project's Railway deployment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx prisma validate` fails without DATABASE_URL — used `DATABASE_URL="postgresql://dummy:..."` for validation only; actual DB migration applied at Railway deploy time via migration SQL file
- Pre-existing test failures (webhook/route.test.ts, activity-log.test.ts, migration.test.ts) confirmed pre-existing before our changes via git stash verification — out of scope per deviation rules

## User Setup Required

**New environment variable required before deploying Plan 03 (token storage):**

Add to Railway environment:
```
TOKEN_ENCRYPTION_KEY=<generate with: openssl rand -base64 32>
```

Must be at least 32 characters. Keep secret — loss means all stored YNAB tokens become unreadable.

## Next Phase Readiness

- `encryptToken`/`decryptToken` ready to use in Plan 03 (token storage) and Plan 04 (token refresh)
- `lastRefreshAttemptAt` field available for concurrent refresh mutex in Plan 04
- `selectedBudgetId`/`selectedAccountId` fields available for YNAB-05 (budget/account selection)
- Migration SQL ready for Railway deployment

---
*Phase: 17-ynab-oauth-token-management*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: src/lib/crypto.ts
- FOUND: tests/ynab/encryption.test.ts
- FOUND: prisma/migrations/20260330000000_ynab_token_fields/migration.sql
- FOUND: commit 0085e65 (test RED)
- FOUND: commit cb74c98 (feat GREEN)
- FOUND: commit 640cc11 (feat schema)
