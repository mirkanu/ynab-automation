# Phase 25: Self-Host Polish — Legal, Screenshots, Published Railway Template — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** Inline user guidance via `/gsd:plan-phase 25` + Phase 24-04 dry-run findings

<domain>
## Phase Boundary

**In scope:**
- Plain-language "No warranty" paragraph at the top of README
- "AI-generated" disclosure at the top of README + short comment block at the top of LICENSE
- Per-dependency license audit (`docs/LICENSE-AUDIT.md`) confirming zero GPL/LGPL/AGPL/MPL in the runtime tree
- **Admin-page screenshots** for the dashboard, settings, and activity log, captured from a DISPOSABLE non-production instance seeded with plausible dummy data
- README "Features" section (top-of-file after the legal paragraphs) showing those 3 screenshots with short blurbs
- Demoting the existing wizard-install screenshots to a collapsible `<details>` block (still visible, just tucked away — they were determined to be self-explanatory and don't sell the app)
- Publishing a **real** Railway template via Railway's UI (user-led checkpoint), updating the Deploy button URL to the resulting `railway.com/template/<hash>`, and verifying single-click deploy on a fresh Railway account
- Resolving Phase 24-04 checkpoint as part of the final verification — the one combined dry-run covers both 24-04 (README walkthrough) and 25-04 (Railway template)

**Out of scope:**
- Formal LICENSE change (staying MIT — see research finding in the "Legal approach" decision below)
- Using the user's personal/live data in any screenshot (explicit user constraint)
- Touching the `ynab-test-production` Railway project during screenshot capture (explicit user constraint — "do not touch my live installation for the dummy data, create a duplicate if needed")
- Adding tests for the legal text or audit file (docs-only deliverables; verification is manual)
- Video walkthroughs, animated gifs, i18n
- Multi-theme or dark-mode screenshot variants — one set of light-theme screenshots is enough
- GitHub Actions workflow for regenerating screenshots on every PR — nice-to-have, deferred

</domain>

<decisions>
## Implementation Decisions

### North Star
Phase 25 makes the README read like a product page for a polished self-host tool. Priorities in order:
1. **Legal is covered in plain language** so a non-programmer who only skims understands that this is as-is software with zero guarantees.
2. **AI-generated disclosure is prominent** — the user wants this clearly stated, not buried.
3. **License audit is committed** so anyone who wants to check can see per-dep licenses at a glance.
4. **Features showcase sells the app** — dashboard / settings / activity log are the things a potential user wants to see, not "here's a text field for your admin password".
5. **One-click Railway deploy actually works** — the current Phase 24 version requires 3 clicks and manual Postgres add, which is a bad first impression. Phase 25 ships the real template.

### Legal Approach
- **License stays MIT.** Research during Phase 24-04 checkpoint confirmed MIT's "AS IS" + liability-cap clause is already battle-tested for exactly this concern. Switching to Apache 2.0 or Unlicense doesn't materially improve the user's legal position.
- **Plain-language "No warranty" paragraph** in README, above the Deploy button if possible. Example phrasing (planner may refine): *"This is a personal side project, provided as-is, with no warranty and no support. If the app misposts a transaction to your YNAB budget, corrupts a setting, loses data, or does anything else unexpected, you are responsible for fixing it. The MIT license at the bottom of this repo spells out the formal terms. Nothing on this page is financial advice."*
- **AI-generated disclosure** in README, above or next to the "No warranty" paragraph. Example phrasing (planner may refine): *"Every line of code, every test, every line of this README — everything in this repository was written by Claude (Anthropic's language model) under human direction. No human wrote any code by hand. This is a deliberate experiment in AI-assisted software delivery. You should evaluate whether that matches your risk tolerance before running it against real money."*
- **LICENSE file** gains a leading comment block repeating the AI-generated + no-warranty framing for redundancy with the README. The MIT license text itself stays byte-identical so automated license scanners still recognize it.

### License Audit
- Tool: `npx license-checker --production --summary` to enumerate **runtime** deps and their licenses. Run `npx license-checker --production --json` for the full per-package list to include in `docs/LICENSE-AUDIT.md`.
- Dev deps (vitest, playwright, typescript, etc.) are noted separately or omitted — only runtime shipping-to-user matters for the copyleft check.
- Manual check: grep the full JSON output for `GPL`, `LGPL`, `AGPL`, `MPL`, `CDDL`, `EPL`, `SSPL`, `CC-BY-SA`. If any hits: investigate (there may be dual-licensed packages that are safe under MIT/BSD too). If unresolvable: stop and escalate.
- Audit file format: introduction paragraph explaining what was checked + how → summary table (package name | version | license | direct vs transitive) → "verified clean" statement → timestamp + commit SHA at time of audit.
- Attribution requirements: if any BSD-3-clause or Apache-2.0 packages require NOTICE files, enumerate them and either (a) add attribution to README bottom, or (b) document that the standard BSD/Apache attribution is considered satisfied by the package's own LICENSE file shipping in node_modules.

### Disposable Instance for Screenshots — Railway Duplicate
**User constraint:** do NOT touch `ynab-test-production`. Create a duplicate.

**Chosen approach: dedicated second Railway project `ynab-screenshots`.**
- Use `railway` CLI (already installed) to create a new project, link the same GitHub repo, deploy, add Postgres plugin.
- Once deployed, psql into the new project's Postgres and seed the Setting table with dummy values so the wizard is bypassed:
  - `ADMIN_PASSWORD = 'ScreenshotDemo123'` (so we can log in for screenshots)
  - `YNAB_ACCESS_TOKEN = 'screenshot-dummy-token'` (invalid but populated)
  - `YNAB_BUDGET_ID = 'screenshot-budget'`
  - `YNAB_ACCOUNT_ID = 'screenshot-account'`
  - `ANTHROPIC_API_KEY = 'sk-ant-screenshot'`
  - `RESEND_API_KEY = 're_screenshot'`
  - `INBOUND_EMAIL = 'screenshot@upload.pipedream.net'`
  - `WIZARD_COMPLETE = 'true'`
- Seed `ActivityLog` with 6–8 plausible rows covering the full range of statuses (success / parse_error / ynab_error / unknown_sender / test / duplicate) — dates should look recent-ish, payees should be recognizable (Amazon, Costco, eBay, Apple). No personal names or real amounts matching your life.
- Seed `Setting` with `SENDER_RULES` and `CURRENCY_RULES` JSON entries showing 2–3 plausible dummy rules each.
- The fake PAT means the live YNAB-fetching UI (budget dropdown, account dropdown) will show an error state — that's actually better for the screenshot because it hides any real account names. The Settings page screenshot can show the "YNAB connection unavailable — check token" state.
- **After screenshots are captured and committed**, the Railway screenshots project is left running for repeatability OR deleted. Plan decides; default: leave running for 24 hours so user can inspect the live version if desired, then plan includes a note instructing the user to delete it manually from Railway's UI. Cost: pennies.

**Alternative approach considered and rejected:** local Postgres via Docker — no Docker in the sandbox. Local Postgres via apt — requires sudo. Using ynab-test-production's Postgres instance with a separate database — user constraint says don't touch the live install, and sharing infrastructure is too close to that line.

### Screenshot Capture Mechanism
- Reuse Playwright setup from Phase 24 (`@playwright/test` already installed as devDep, chromium installed).
- New script: `scripts/capture-feature-screenshots.ts`.
- Script accepts `SCREENSHOT_BASE_URL` env (default: the new ynab-screenshots deployment URL).
- Flow:
  1. Visit `/login`
  2. Fill admin password (`ScreenshotDemo123`) → submit → wait for `/dashboard`
  3. Screenshot `/dashboard` at 1280×800 → `docs/images/feature-dashboard.png`
  4. Navigate to `/settings` → wait for settings UI → screenshot → `docs/images/feature-settings.png`
  5. Navigate to `/logs` → wait for log rows → screenshot → `docs/images/feature-activity-log.png`
  6. Exit
- Save raw PNGs, optimize to ≤200 KB each via `sharp` or `pngquant` if needed.

### README Restructure
New top-of-file structure (replaces current lines 1–30):
```
# YNAB Automation

[pitch one-liner]

[No warranty paragraph]

[AI-generated disclosure]

[![Deploy on Railway](...)](REAL_TEMPLATE_URL_POST_25-04)

---

## Features

### Dashboard
![Dashboard screenshot](docs/images/feature-dashboard.png)
[blurb: at-a-glance view of automation stats — emails processed this week,
success rate, last transaction created]

### Settings
![Settings screenshot](docs/images/feature-settings.png)
[blurb: configure YNAB, Claude, Resend, Pipedream in one place — no code
edits, no Railway env-var juggling. Test mode toggle for safe experimentation.]

### Activity Log
![Activity log screenshot](docs/images/feature-activity-log.png)
[blurb: every email shows up here with its parse result and YNAB response —
green for success, red for parse or API errors, blue for test mode. Replay
any email with one click.]

---

## What This Is
[existing "What This Is" section continues]
```

Wizard install screenshots currently at the top of the Install section → wrap them in `<details><summary>See the install flow</summary>...</details>` so they don't dominate the page.

### Published Railway Template (POLISH-02)
- Railway requires a manual publish flow through the web UI: project → Settings → "Create Template" → configure services, env vars, default values, icon, description → Publish → get a `https://railway.com/template/<hash>` URL.
- This CANNOT be scripted via CLI (as of Railway's current product). Plan 25-04 walks the user through the UI click-by-click.
- The screenshot Railway project from Plan 25-03 is a good candidate for template publication: it's already deployed, has the Postgres plugin, has the right variables defined. The user can use that project's "Create Template" flow.
- Post-publish: update README Deploy button URL + commit + push. Then the user clicks the button in a fresh incognito window on a brand-new Railway account (or a Railway "New Project" flow as a different user) to confirm one-click works.

### Plan Ordering and Parallelism
- **Wave 1:** 25-01 (README legal amendments) + 25-02 (license audit) in parallel — independent file changes (README.md top-of-file vs new docs/LICENSE-AUDIT.md).
- **Wave 2:** 25-03 (screenshots + README Features section) — depends on 25-01 because it also edits README.md and needs the legal section already in place.
- **Wave 3:** 25-04 (human-verify: publish Railway template + update button URL + incognito dry-run + combined 24-04 checkpoint resolution).

### Claude's Discretion
- Exact prose wording of the no-warranty and AI-generated paragraphs (planner drafts, executor refines if needed)
- Icon / color accents in the Features section
- Whether to commit the Playwright feature-capture script or keep it as ephemeral
- Whether to use `sharp` for PNG optimization or leave raw
- Exact dummy data values (as long as they're plausible + not real)
- Whether to teardown the screenshot Railway project automatically or leave a TODO for the user

### Carry-Over from Phase 24
- Phase 24-04 checkpoint is currently paused mid-flight (the user stopped at the Deploy-button-not-working + Mermaid error issues — both fixed in commit `673a4cf`). Phase 25-04 folds 24-04's remaining verification into its own checkpoint so the user does one combined dry-run.

</decisions>

<specifics>
## Specific References

- **Research finding (Railway button history):** commit `57d50c1` (Phase 8, 2026-03-26) added a deploy button pointing at `https://railway.app/new/template/ynab-automation`. This URL is only valid if someone manually published a Railway template with ID `ynab-automation`, which was never done. The button has been aspirational-placeholder since day one. Phase 25-04 finally makes it real.
- **Phase 24 auto-fixes during dry-run:** commit `673a4cf` fixed the Mermaid `\n` syntax error and the Deploy button URL + honest 3-click install flow. Those fixes are already on master and GitHub.
- **Existing Phase 24 screenshots:** `docs/images/wizard-step-{1..6}.png` + `wizard-done.png` — keep them, demote them, don't delete them.
- **Railway CLI capability:** `railway init`, `railway link`, `railway add` (for plugins), `railway up`, `railway variable set` are all available. `railway redeploy -y`, `railway logs`.
- **Railway TCP proxy for psql access:** `mainline.proxy.rlwy.net:44022` is the existing one for ynab-test-production. The new screenshot project will get its own proxy — planner must not hard-code the existing proxy.
- **`@playwright/test` already installed** as devDep by Phase 24. Chromium already installed. `docs:screenshots` npm script exists for the wizard capture; planner may add `docs:feature-screenshots` or fold into one script.
- **Phase 24 closure is still open.** Phase 25 executes alongside Phase 24's paused checkpoint. Phase 24 formally closes only after Phase 25-04's combined dry-run verifies both the README walkthrough AND the published template.

</specifics>

<deferred>
## Deferred Ideas

- Dark-mode or high-contrast screenshot variants (v6.1 polish)
- GitHub Actions CI workflow that regenerates screenshots on README changes
- Animated GIFs / screencasts of the full install flow
- Formal LICENSE change (MIT is sufficient per Phase 24 research)
- Publishing the repo to npm or a package registry (this is an app, not a library)
- Public marketing site / landing page (out of scope for self-host OSS)
- Migration from the dummy screenshot data to a "demo mode" the app supports natively (would be a real feature, not a docs polish item)

</deferred>

---

*Phase: 25-self-host-polish*
*Context gathered: 2026-04-11 via inline `/gsd:plan-phase 25` + Phase 24-04 dry-run carry-over*
