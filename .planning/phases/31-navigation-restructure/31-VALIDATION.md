---
phase: 31
slug: navigation-restructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — navigation changes verified via Next.js build + manual browser checks |
| **Config file** | none |
| **Quick run command** | `npm run build 2>&1 | tail -5` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build 2>&1 | tail -5`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full build must be green + manual nav check
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-nav-component | 01 | 1 | NAV-03, NAV-04 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 31-route-migration | 01 | 1 | NAV-03, NAV-04 | — | N/A | build | `npm run build` | ✅ W1 | ⬜ pending |
| 31-layout-update | 01 | 2 | NAV-03, NAV-04 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — Next.js build system is the primary verification tool; no new test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email Automation section expands/collapses on click | NAV-03 | UI state interaction | Click "Email Automation" in nav; verify Activity Log, Rules, Test & Replay appear; click again to collapse |
| Sub-page navigation works for all 3 Email Automation sub-pages | NAV-03 | Route verification | Click each sub-item link; verify correct page loads |
| Currency section expands/collapses on click | NAV-04 | UI state interaction | Click "Currency" in nav; verify EUR→GBP Transfers, EUR Conversion, EUR Reconciliation appear |
| Sub-page navigation works for all 3 Currency sub-pages | NAV-04 | Route verification | Click each sub-item link; verify correct page loads (EUR Conversion shows placeholder) |
| Old top-level "Logs" and "Rules" items no longer visible | NAV-03 | Visual verification | Check nav bar — no top-level "Logs" or "Rules" items |
| Active page indicator highlights correct sub-item | NAV-03, NAV-04 | Visual state | Navigate to /email-automation/logs; verify Activity Log sub-item shows active state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
