# Phase 24: Test Suite Cleanup & Self-Host Docs — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** Inline user answers via `/gsd:plan-phase 24` + Phase 23 carry-over concerns

<domain>
## Phase Boundary

**In scope:**
- Delete the `tests/` directory (all 20 v5.0-era test files — they target modules deleted in Phases 20-22)
- Fix `src/lib/settings.ts` `process.env` stale-state leak (captured as Phase 23 todo)
- Self-host README rewrite: end-to-end deploy → wizard → first email walkthrough
- Railway "Deploy Button" template validation
- "Costs" section naming Claude, Resend, Railway hobby tier with pricing links
- Headless screenshot capture of wizard pages via Playwright
- Close out pending todos that are Phase 24-adjacent: `.planning/todos/pending/process-env-stale-state-leak.md` (will be resolved), `.planning/todos/pending/2026-04-11-decide-fate-of-cosmetic-pipedream-webhook-url-field.md` (decide during docs pass)

**Out of scope:**
- Rewriting any of the 20 v5.0 tests against single-tenant schema — **all are deleted**; real coverage lives in `src/**/*.test.ts` (8 files, 122 tests passing)
- Screenshots of provider console pages (Anthropic, Resend, YNAB Developer, Pipedream) — cannot headlessly reach those without credentials; README uses prose + direct links for provider steps
- Video walkthroughs, animated gifs, i18n, accessibility audits
- Any new product features — this phase is cleanup + docs only

</domain>

<decisions>
## Implementation Decisions

### North Star
Phase 24 closes v6.0 by making the repo **ready for a non-programmer to clone, one-click deploy, and run through the wizard without consulting anything outside the README**. Secondary goal: green `npm test` in CI so future contributors (or future-us) trust the test signal again.

### Test Cleanup (CLEAN-04) — Delete Aggressively
User decision: delete all v5.0-era failing tests. Reasoning: every file in `tests/` references modules that were deleted in Phases 20-22 (`@/lib/auth`, `@/lib/email-routing`, `@/lib/crypto`, multi-tenant schema fields, Auth.js, YNAB OAuth flow). Rewriting against single-tenant schema is more work than rewriting from scratch when we need new coverage.

**Files to delete (entire `tests/` directory, 20 files):**

| File | Why deleted |
|------|-------------|
| tests/account/deletion.test.ts | Multi-tenant account deletion (CLEAN-03 removed the feature) |
| tests/auth/signup-magic-link.test.ts | Auth.js magic link flow (Phase 21 removed Auth.js) |
| tests/dashboard/activity-log.test.ts | Per-user activity log filtering (multi-tenant; no userId column now) |
| tests/dashboard/parse-transparency.test.ts | Reference only — still v5.0 era, delete for consistency |
| tests/dashboard/stats.test.ts | Per-user dashboard stats (multi-tenant) |
| tests/dashboard/test-mode.test.ts | References DangerZone API (CLEAN-03 removed) |
| tests/data/migration.test.ts | Backfill migration (already applied; not re-runnable) |
| tests/data/multi-tenant-isolation.test.ts | Phase 20 removed multi-tenancy |
| tests/email/forwarding-address.test.ts | Per-user email forwarding (Phase 22 removed) |
| tests/email/idempotency.test.ts | Multi-tenant idempotency — webhook handles single-tenant idempotency in src/ tests |
| tests/email/routing.test.ts | `@/lib/email-routing` deleted in Phase 22 |
| tests/email/security.test.ts | Multi-tenant security checks |
| tests/email/transaction-creation.test.ts | Multi-tenant transaction creation (src/lib/ynab.test.ts covers single-tenant) |
| tests/onboarding/email-providers.test.ts | Onboarding removed in Phase 21 |
| tests/onboarding/flow.test.ts | Onboarding removed in Phase 21 |
| tests/ynab/budget-selection.test.ts | Multi-tenant budget selection (src/lib/ynab.test.ts covers the single-tenant flow) |
| tests/ynab/disconnect.test.ts | OAuth disconnect (OAuth removed) |
| tests/ynab/encryption.test.ts | Encrypted token storage (removed) |
| tests/ynab/oauth.test.ts | OAuth flow (removed) |
| tests/ynab/refresh.test.ts | OAuth refresh (removed) |

**After deletion:** `rmdir tests/` and verify vitest still picks up `src/**/*.test.ts`. Expected state: 10 passing test files, 122 passing tests, 11 skipped tests all resolved or justified, zero failing, zero unexpected skipped.

**Skipped test audit:** 11 currently-skipped tests exist (exact file/test list to be enumerated in the plan). Planner should grep for `.skip` / `it.skip` / `describe.skip` and either: un-skip if safe, delete if the assertion is obsolete, or document justification. Success criterion 1 requires zero unexplained skips.

### settings.ts process.env Stale-State Fix
From `.planning/todos/pending/process-env-stale-state-leak.md`.

**Chosen approach: option 1 — remove process.env mutation entirely.**
- `getSetting()` reads from DB only. No env fallback.
- `loadDbSettings()` deleted (no callers need it after this change).
- `saveSettings()` stops writing to process.env; only writes to DB.
- Callers that currently rely on env var bootstrap: grep for `getSetting` and verify none depend on env fallback. If any do (e.g., DATABASE_URL, IRON_SESSION_SECRET, YNAB_CLIENT_ID), those are framework-level secrets read via `process.env.X` directly, not via `getSetting` — check and confirm.
- Add unit tests in `src/lib/settings.test.ts` covering: DB hit, DB miss returns undefined, delete then getSetting returns undefined (the behavior SC2 of Phase 23 couldn't verify).

Resolves the todo. Move the todo file to `.planning/todos/done/` as part of the plan.

### README (DOCS-01/02/03)
**Structure** (target: ~400-600 lines of markdown, no fluff):

1. **Top banner**: one-sentence pitch + "Deploy on Railway" button
2. **What this is**: 2-3 paragraphs, non-programmer friendly. "Forward an order email → shows up in YNAB as a transaction, automatically."
3. **How it works**: one diagram (ASCII or Mermaid) showing email → Pipedream → /api/webhook → Claude → YNAB
4. **Prerequisites**: accounts needed (YNAB, Anthropic, Resend, Pipedream, Railway), with pricing expectation per each
5. **Install (numbered)**:
   1. Click Deploy button → Railway provisions
   2. Wait for first deploy → open app URL
   3. Wizard step 1–6 (one numbered sub-step per wizard step, each with ONE screenshot of the wizard page and a prose description of what to paste)
   4. Click Finish → see /setup/done
   5. Forward first email → confirm in YNAB
6. **Costs**: per-provider pricing link + "a few cents per month at household volume" language (no hard dollar amounts)
7. **Troubleshooting**: 5-8 likely failure modes (wrong YNAB PAT, wrong budget, Pipedream not forwarding, Claude quota, etc.) with diagnostic steps
8. **Self-host vs managed**: brief note — this is self-host only; managed service is "maybe one day"
9. **Contributing / license**: minimal footer

**Tone:** calm, confident, no jargon without gloss, no exclamation marks, no marketing voice. Assume reader knows how email works but doesn't know what an API key is until the wizard tells them.

### Railway Deploy Button (DOCS-02)
Success criterion 2: clicking "Deploy on Railway" must produce a template that provisions PostgreSQL, sets `DATABASE_URL`, and auto-generates `IRON_SESSION_SECRET`.

Railway deploy buttons are URLs of the form `https://railway.com/template/<template-id>` or `https://railway.com/new/template?template=<github-url>&plugins=...`. The template spec is a JSON file or URL query params describing services, env vars, and their defaults.

Planner task: create the template, verify it preview-renders with Postgres + auto-generated secret, capture the deploy-button URL, embed in README. If manual template creation via Railway UI is needed, plan includes a checkpoint task where the user clicks through the Railway template creation wizard and pastes the resulting URL back.

### Screenshots (DOCS-03)
**User decision: I (Claude) capture wizard screenshots headlessly.**

Approach:
- Use Playwright (likely already in devDeps? if not, add as devDep)
- Write a one-shot script `scripts/capture-wizard-screenshots.ts` that:
  1. Spins up a local Next.js dev server (or points at the live Railway deployment)
  2. Wipes the Setting table (or uses a separate test DB) so wizard renders each step
  3. Navigates to /setup/1..6 and /setup/done
  4. Captures PNG per page at a sensible viewport (e.g., 1280x800)
  5. Saves to `docs/images/wizard-step-N.png`
- Commit images + script
- Provider pages (YNAB Developer, Anthropic Console, Resend, Pipedream) are NOT screenshotted — README uses prose + direct link buttons for those, consistent with Phase 23 CONTEXT.md guidance

### Railway Env Var Cleanup
During Phase 23 verification I noticed Railway still has env vars from Phase 21 era that are now redundant (wizard is canonical): `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, etc. Also artifact env vars from deleted features: `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTH_URL`, `TOKEN_ENCRYPTION_KEY`, `YNAB_CLIENT_ID`, `YNAB_CLIENT_SECRET`, `YNAB_PERSONAL_ACCESS_TOKEN` (the last one is a duplicate of the wizard-saved `YNAB_ACCESS_TOKEN`).

**Decision:** Leave env vars alone in this phase. A fresh one-click deploy won't have any of them; the existing test deployment's env vars are harmless once `getSetting` stops reading env fallback. Documenting this in the README (section "Advanced: pre-seeding via env vars") is nice-to-have but not required — CONTEXT.md guidance says skip.

### Pipedream Cosmetic Field Todo
From `.planning/todos/pending/2026-04-11-decide-fate-of-cosmetic-pipedream-webhook-url-field.md`. Not blocking Phase 24, but the README's Pipedream wizard step forces us to commit: is the step asking for a forwarding EMAIL (matches `INBOUND_EMAIL` pattern) or a webhook URL (matches legacy `PIPEDREAM_WEBHOOK_URL` key name)? Resolve during README drafting — rename the Setting key + wizard UI copy if needed to be consistent. Move the todo to done after.

### Claude's Discretion
- Exact wording of README prose — planner should draft, execute-phase agent writes
- Mermaid vs ASCII vs SVG for the how-it-works diagram
- Whether to add a CHANGELOG.md (nice-to-have, not required by the roadmap)
- Whether the Playwright screenshot script runs as part of CI or one-shot manually before release
- Whether to add `npm run docs:screenshots` as a package.json script for future re-capture

</decisions>

<specifics>
## Specific References

- **Pending todos to resolve in this phase:**
  - `.planning/todos/pending/process-env-stale-state-leak.md` — fixed by settings.ts rewrite task
  - `.planning/todos/pending/2026-04-11-decide-fate-of-cosmetic-pipedream-webhook-url-field.md` — decided during README wizard step 6 description
- **Phase 23 concerns inherited:**
  - `src/lib/settings.ts` stale-state leak (load/save/get all mutate process.env)
  - 10 originally-scoped failing tests (actual count: 18 test files, 22 failing tests, 11 skipped)
  - Self-host docs must describe wizard as canonical install path
- **Current test state snapshot (2026-04-11):**
  - 28 test files: 18 failed, 10 passed
  - 155 tests: 22 failed, 122 passed, 11 skipped
  - Fix: delete `tests/` (all 20 files); keep `src/**/*.test.ts` (8 files, 122 passing)
- **Railway deployment:** https://ynab-test-production.up.railway.app (production test env, continues to live-verify the wizard)

</specifics>

<deferred>
## Deferred Ideas

- Video walkthrough / animated demo gif (v6.1 polish)
- Anthropic/Resend/YNAB/Pipedream console screenshots (requires credentialed access we can't automate)
- Accessibility audit, i18n, dark mode polish
- CHANGELOG.md (if useful, add during execution; not blocking)
- Managed hosted SaaS variant (parked indefinitely — roadmap already calls it "maybe one day")
- Playwright E2E test that walks the wizard against a disposable Postgres (test coverage for the wizard flow itself — would belong in a later phase with infrastructure for throwaway DBs)
- Unit tests for the Pipedream webhook parsing edge cases (separate concern from this phase)

</deferred>

---

*Phase: 24-test-suite-cleanup-and-self-host-docs*
*Context gathered: 2026-04-11 via inline `/gsd:plan-phase 24` + AskUserQuestion answers*
