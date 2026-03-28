---
phase: 16
slug: user-accounts-multi-tenant-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (or create in Wave 0) |
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
| 16-01-01 | 01 | 1 | AUTH-01 | integration | `npx vitest run tests/auth` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | AUTH-02 | integration | `npx vitest run tests/auth` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | AUTH-03 | integration | `npx vitest run tests/auth` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | DATA-01 | unit | `npx vitest run tests/data` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | DATA-02 | integration | `npx vitest run tests/data` | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 1 | DATA-03 | integration | `npx vitest run tests/data` | ❌ W0 | ⬜ pending |
| 16-02-04 | 02 | 1 | DATA-04 | integration | `npx vitest run tests/data` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth/signup-magic-link.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03
- [ ] `tests/data/multi-tenant-isolation.test.ts` — stubs for DATA-01, DATA-03, DATA-04
- [ ] `tests/data/migration.test.ts` — stubs for DATA-02
- [ ] `vitest.config.ts` — if not already present

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magic link email received in inbox | AUTH-01 | Requires real email delivery | 1. Sign up with real email 2. Check inbox 3. Click link 4. Verify redirect to dashboard |
| Session persists after browser close/reopen | AUTH-02 | Requires real browser | 1. Log in 2. Close browser 3. Reopen 4. Navigate to dashboard 5. Verify still logged in |
| RLS prevents cross-tenant data in psql | DATA-03 | Requires DB-level verification | 1. Connect to DB 2. SET app.current_user_id 3. Query tables 4. Verify only own data returned |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
