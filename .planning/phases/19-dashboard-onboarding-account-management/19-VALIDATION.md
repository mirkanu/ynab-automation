---
phase: 19
slug: dashboard-onboarding-account-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DASH-01/02 | integration | `npx vitest run tests/dashboard` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | DASH-03/04 | integration | `npx vitest run tests/dashboard` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 2 | ONBD-01/02 | integration | `npx vitest run tests/onboarding` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 2 | ONBD-03 | unit | `npx vitest run tests/account` | ❌ W0 | ⬜ pending |
| 19-05-01 | 05 | 3 | ONBD-04 | manual | N/A (visual) | N/A | ⬜ pending |
| 19-05-02 | 05 | 3 | DASH-05 | integration | `npx vitest run tests/dashboard` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dashboard/activity-log.test.ts` — stubs for DASH-01
- [ ] `tests/dashboard/stats.test.ts` — stubs for DASH-02
- [ ] `tests/dashboard/settings.test.ts` — stubs for DASH-03, DASH-04
- [ ] `tests/dashboard/parse-transparency.test.ts` — stubs for DASH-05
- [ ] `tests/onboarding/flow.test.ts` — stubs for ONBD-01, ONBD-02
- [ ] `tests/account/deletion.test.ts` — stubs for ONBD-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Guided onboarding flow in browser | ONBD-01 | Requires real browser + YNAB OAuth | 1. Sign up as new user 2. Follow guided steps 3. Verify connects YNAB → shows address → shows instructions |
| Homepage visual layout | ONBD-04 | Visual/design verification | 1. Visit homepage as logged-out user 2. Verify product explanation 3. Verify signup CTA works |
| Account deletion cascades all data | ONBD-03 | Requires DB inspection | 1. Create test user 2. Delete account 3. Query all tables for orphaned rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
