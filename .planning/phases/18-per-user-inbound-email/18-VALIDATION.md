---
phase: 18
slug: per-user-inbound-email
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 18 — Validation Strategy

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
| 18-01-01 | 01 | 1 | EMAIL-01 | unit | `npx vitest run tests/email/forwarding-address` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | EMAIL-01 | unit | `npx vitest run tests/email/forwarding-address` | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 2 | EMAIL-02/03 | unit | `npx vitest run tests/email/routing tests/email/security` | ❌ W0 | ⬜ pending |
| 18-04-02 | 04 | 2 | EMAIL-04 | unit | `npx vitest run tests/email/idempotency` | ❌ W0 | ⬜ pending |
| 18-04-02 | 04 | 2 | EMAIL-05 | integration | `npx vitest run tests/email/transaction-creation` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/email/forwarding-address.test.ts` — stubs for EMAIL-01
- [ ] `tests/email/security.test.ts` — stubs for EMAIL-03
- [ ] `tests/email/routing.test.ts` — stubs for EMAIL-02
- [ ] `tests/email/idempotency.test.ts` — stubs for EMAIL-04
- [ ] `tests/email/transaction-creation.test.ts` — stubs for EMAIL-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real email forwarded creates YNAB transaction | EMAIL-05 | Requires real email + Postmark + YNAB | 1. Forward receipt email to user's address 2. Check YNAB for transaction 3. Verify amount, payee, account |
| Postmark webhook signature rejected for forged request | EMAIL-03 | Requires Postmark's actual IP range | 1. Send POST to webhook from non-Postmark IP 2. Verify 403 response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
