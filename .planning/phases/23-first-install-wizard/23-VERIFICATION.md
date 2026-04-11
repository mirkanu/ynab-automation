---
phase: 23-first-install-wizard
status: verified
verified: 2026-04-11
milestone: v6.0
---

# Phase 23 Verification Report

**Phase:** 23 — First-Install Wizard & Route State Machine
**Deployment:** https://ynab-test-production.up.railway.app
**Verified:** 2026-04-11
**Verified by:** User (human verification checkpoint, bulk approval after full walkthrough + automated route checks)

## Success Criteria

| # | Criterion | Status | How verified |
|---|-----------|--------|--------------|
| 1 | Fresh install → wizard → working app (step 1→2→3→4→5→6→done) | PASS | User walked full wizard against wiped Setting table; all 6 keys + `WIZARD_COMPLETE=true` confirmed in DB |
| 2 | Mid-wizard resume from DB after tab close | PASS | Blanked steps 5+6+COMPLETE → `/` → `/setup/5` redirect; steps 1–4 values intact |
| 3 | Each step shows plain-language instructions + provider link in new tab | PASS | User eyeballed during walkthrough; all links have `target="_blank" rel="noopener"` |
| 4 | `WIZARD_COMPLETE=true` prevents re-entry to `/setup/*` | PASS | `/setup/1` → `/login` (307); `/setup/4` → `/login` (307) |
| 5 | `/` routes correctly based on install + auth state | PASS | `/` no session → `/login`; `/dashboard` no session → `/login?callbackUrl=/dashboard`; logged-in path already verified in Phase 21 |

## Requirements Completed

- **WIZ:** WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05
- **DASH:** DASH-08
- **CLEAN:** CLEAN-03

## Pre-checkpoint Automated Tasks

### Task 1 — Deploy to Railway
`railway up` pushed Wave 1–3 changes. Initial deploy showed that middleware was intercepting `/` before `page.tsx` dispatcher could run. Auto-fixed by excluding `/` from the middleware matcher. Committed `6cfbdbd` and redeployed.

### Task 2 — DB Backup
14 rows exported to `/tmp/setting-backup-20260411-022220.csv` via psql through Railway TCP proxy `mainline.proxy.rlwy.net:44022`.

### Task 3 — Wipe Setting Table
`DELETE FROM "Setting"` → 0 rows. Fresh-install state simulated.

## Human Verification (Task 4)

### Issues Found and Fixed During Verification

**Issue 1 — "could not load budget" at step 3**

*Symptom:* Clicking Next on /setup/2 with a valid YNAB PAT, then landing on /setup/3 showed "could not load budget" error. Even after refreshing with a brand-new YNAB token.

*Root cause:* `/api/ynab/budgets` and `/api/ynab/[id]/accounts` were built in Phase 22 with an `isLoggedIn` guard (correct for the Settings page), but the wizard hits them at step 3 **before any admin login exists**, returning 401.

*Fix:* Both routes now only enforce the login guard when `WIZARD_COMPLETE === 'true'`. During install they're publicly readable; the PAT still has to come from the DB (wizard saves it in step 2), so no data leakage. Post-install, the auth guard re-engages automatically. Committed `c90a684`.

**Issue 2 — Wizard skipped from step 3 to step 6**

*Symptom:* After completing step 3, wizard jumped straight to step 6 instead of step 4.

*Root cause:* `getSetting()` falls back to `process.env`. Railway had `ANTHROPIC_API_KEY` and `RESEND_API_KEY` set as env vars from Phase 21 era. `deriveWizardStep()` correctly treated them as already-satisfied. This is the designed resume-fastpath behavior (advanced self-hosters can pre-set env vars), but it prevented exercising steps 4 and 5 end-to-end on this env.

*Fix:* Deleted the two env vars via `railway variable delete` and forced a redeploy. User then walked steps 4→5→6 with fake keys (`sk-ant-test`, `re_test`, real Pipedream email). Restored both env vars after verification.

**Issue 3 — Resume test DELETE failure (SC2)**

*Symptom:* After successful wizard completion, DELETEing `RESEND_API_KEY`, `PIPEDREAM_WEBHOOK_URL`, `WIZARD_COMPLETE` should have made `/` redirect to `/setup/5`. Instead it went to `/login`.

*Root cause:* `src/lib/settings.ts` `loadDbSettings()` writes all Setting DB values into `process.env` at boot, and `saveSettings()` does the same on every save. DELETEing a row does NOT clear `process.env`, so `getSetting()`'s fallback continues to serve the stale value.

*Workaround used:* UPDATE the rows to empty string instead of DELETE — `deriveWizardStep()` treats `''` as not-set, so resume worked correctly. SC2 passed via this path.

*Follow-up:* This is a real correctness bug affecting any future delete-settings path. Captured as `process-env-stale-state-leak.md` todo for Phase 24. Not a Phase 23 blocker — wizard only writes, never deletes.

### SC1 — Full Wizard Walkthrough
Step 1: admin password saved.
Step 2: YNAB PAT saved, budget dropdown populated after Issue 1 fix.
Step 3: budget + account selected.
Step 4: Claude API key saved (fake `sk-ant-test` after Issue 2 fix).
Step 5: Resend key saved (fake `re_test`).
Step 6: Pipedream email saved, Finish Setup clicked.
`/setup/done` rendered with forwarding email shown.
Setting table shows all 6 keys + `WIZARD_COMPLETE=true` (8 rows including YNAB_BUDGET_ID + YNAB_ACCOUNT_ID from step 3).

### SC2 — Resume Test
Blanked `RESEND_API_KEY`, `PIPEDREAM_WEBHOOK_URL`, `WIZARD_COMPLETE` (via empty-string UPDATE per Issue 3 workaround). Visiting `/` redirected to `/setup/5` with steps 1–4 values still present.

### SC3 — Instructions + Provider Links
Confirmed during walkthrough:
- `/setup/2` — YNAB Developer Settings link → `https://app.ynab.com/settings/developer`
- `/setup/4` — Anthropic Console link → `https://console.anthropic.com/settings/keys`
- `/setup/5` — Resend API Keys link → `https://resend.com/api-keys`
- `/setup/6` — Pipedream link → `https://pipedream.com`
All open in new tab (`target="_blank"` + `rel="noopener"`). Each step has numbered plain-language instructions per CONTEXT.md spec.

### SC4 — Re-run Prevention
```
curl /setup/1 → 307 /login
curl /setup/4 → 307 /login
```
With `WIZARD_COMPLETE=true` restored, the wizard layout's `WIZARD_COMPLETE` gate redirects any direct /setup/* visit. The `/setup/done` x-pathname exemption (Wave 2 auto-fix) stays in place so post-completion landing still renders.

### SC5 — `/` State Machine
```
curl / (no session)          → 307 /login
curl /dashboard (no session) → 307 /login?callbackUrl=/dashboard
```
Logged-in path (/ → /dashboard after iron-session validated) already verified by Phase 21 VERIFICATION.md and not re-tested here.

### CLEAN-03 Dead Code
Already confirmed deleted during Phase 23 Plan 01:
- `src/app/onboarding/` — gone
- `src/app/(dashboard)/settings/DangerZone.tsx` — gone
- `src/app/api/account/delete/` — gone
- `src/app/setup/SetupWizard.tsx` — gone (Phase 23 stub replaced by real wizard)
- `src/app/api/setup/apply/route.ts` — gone (replaced by `/api/setup/step`)

## Post-Checkpoint Task 5 — Restore

- Setting table wiped, then 14 rows restored from `/tmp/setting-backup-20260411-022220.csv`
- Added `WIZARD_COMPLETE=true` as the 15th row (production is effectively "wizard already done" pre-Phase-23)
- `ANTHROPIC_API_KEY` and `RESEND_API_KEY` env vars restored via `railway variable set`
- Railway auto-redeployed to swap in a clean `process.env`

## Outcome

**Phase 23 complete.** All 7 requirements delivered, all 5 success criteria verified, 2 auto-fixes landed on master, 1 non-blocking bug captured as todo for Phase 24. Ready to proceed to Phase 24 (Test Suite Cleanup & Self-Host Docs).

## Notes for Phase 24

- `src/lib/settings.ts` process.env stale-state leak (see `.planning/todos/pending/process-env-stale-state-leak.md`)
- 10 failing v5.0-era tests bundled into Phase 24 (existing concern)
- Self-host docs should now describe the wizard as the canonical install path, not env-var-only bootstrap
- Railway env vars `ANTHROPIC_API_KEY` and `RESEND_API_KEY` can optionally be removed in Phase 24 docs work since the wizard now provides the canonical path — decide during docs drafting
