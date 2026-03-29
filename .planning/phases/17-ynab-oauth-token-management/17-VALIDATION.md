---
phase: 17
slug: ynab-oauth-token-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | YNAB-02 | unit | `npx vitest run tests/ynab/encryption` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | YNAB-01 | integration | `npx vitest run tests/ynab/oauth` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 2 | YNAB-03 | unit | `npx vitest run tests/ynab/refresh` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 2 | YNAB-04 | integration | `npx vitest run tests/ynab/disconnect` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 3 | YNAB-05 | integration | `npx vitest run tests/ynab/budget-selection` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ynab/encryption.test.ts` — stubs for YNAB-02 (token encrypt/decrypt)
- [ ] `tests/ynab/oauth.test.ts` — stubs for YNAB-01 (OAuth flow)
- [ ] `tests/ynab/refresh.test.ts` — stubs for YNAB-03 (token refresh + locking)
- [ ] `tests/ynab/disconnect.test.ts` — stubs for YNAB-04 (disconnect + revoke)
- [ ] `tests/ynab/budget-selection.test.ts` — stubs for YNAB-05 (budget/account selection)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| YNAB OAuth consent screen completes | YNAB-01 | Requires real YNAB account + browser interaction | 1. Click "Connect YNAB" 2. Complete OAuth consent 3. Verify redirect back with connection status |
| Token refresh after 2hr expiry | YNAB-03 | Requires waiting for real token expiry | 1. Connect YNAB 2. Wait 2+ hours 3. Trigger API call 4. Verify succeeds without re-auth |
| Tokens not visible in DB | YNAB-02 | Requires database inspection | 1. Connect YNAB 2. Query User table 3. Verify token columns are ciphertext |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
