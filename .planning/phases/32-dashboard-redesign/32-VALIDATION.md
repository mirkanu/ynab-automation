---
phase: 32
slug: dashboard-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | none — inferred from `package.json` `"test": "vitest run"` |
| **Quick run command** | `npx vitest run src/lib` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | DASH-03, DASH-04 | — | N/A | unit (tdd) | `npx vitest run src/lib/tool-run-queries.test.ts src/lib/activity-log-queries.test.ts` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | DASH-04 | T-auth | `GET /api/dashboard/currency-status` returns 401 when not logged in | unit + grep | `grep -r "isLoggedIn" src/app/api/dashboard && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 2 | DASH-04 | — | N/A | grep + tsc | `grep -r "setInterval" src/app && npx tsc --noEmit` | N/A | ⬜ pending |
| 32-02-02 | 02 | 2 | DASH-03 | — | N/A | grep + tsc + manual | `grep -r "EmailAutomation\|lastEmailReceivedAt" src/app && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/tool-run-queries.test.ts` — covers DASH-04: `getLastToolRuns()` returns null when no Setting keys; parses JSON correctly for each tool
- [ ] `src/lib/activity-log-queries.test.ts` — extend existing: `getDashboardStats()` returns `lastEmailReceivedAt` from most-recent ActivityLog row (any status)
- [ ] `src/app/api/tools/fix-eur-transfers/route.test.ts` — covers DASH-04: POST writes `LAST_RUN_TRANSFER_FIX` to Setting table
- [ ] `src/app/api/tools/reconcile-eur-wise/route.test.ts` — covers DASH-04: POST writes `LAST_RUN_RECONCILIATION` to Setting table

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email Automation panel renders correct fallback when no emails exist | DASH-03 | No headless browser test infra | Load `/dashboard` with empty ActivityLog; verify "No emails yet" copy shows |
| Currency panel updates within 5s after tool run | DASH-04 | Requires live browser + tool execution | Run fix-eur-transfers from tools page; switch to dashboard; verify Currency panel updates within 5 seconds |
| Forwarding Address card still visible below new panels | Phase 28 preservation | Visual layout check | Load `/dashboard`; verify forwarding address card appears below Email Automation and Currency panels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
