# Phase 23: First-Install Wizard & Route State Machine — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** Inline user guidance via `/gsd:plan-phase 23`

<domain>
## Phase Boundary

**In scope:**
- `/setup/*` multi-step wizard routes and page shells
- Root `/` route state machine dispatching to `/setup` | `/login` | `/dashboard`
- Middleware (or server component) gate that forces incomplete installs to `/setup`
- DB-backed wizard progress: `WIZARD_COMPLETE` Setting flag (+ implicit per-step completeness via existing Setting keys)
- Per-step instructional content with direct links to provider API key pages
- Dead-code removal: `src/app/onboarding/`, `src/app/(dashboard)/settings/DangerZone.tsx`, `src/app/api/account/delete/`
- Unifying test-mode toggle into the main `/api/settings` handler

**Out of scope:**
- Multi-tenant / per-user wizard state (single-tenant only)
- Embedded provider screenshots that require binary assets in the repo (links + text only for v6.0)
- Wizard telemetry / analytics
- Internationalization — English only
- Changing the existing Settings page layout (wizard reuses the same form primitives where possible, but `/settings` remains the post-install edit surface)

</domain>

<decisions>
## Implementation Decisions

### North Star
- **One-click install for non-programmers.** A Railway one-click deploy → open app → wizard walks the user through everything with zero prior knowledge of Claude Code, YNAB's API, or what an "API key" even is. Anywhere a key has to be obtained from an external service, the wizard must briefly but clearly tell the user **how** to get it, with a direct link to the provider's page. This is the load-bearing UX goal for the whole phase.

### Wizard Flow (6 steps + done)
1. **Welcome / Admin Password** — set the single admin password (iron-session). One-liner explaining "this is how you log in to the dashboard later."
2. **YNAB Personal Access Token** — paste PAT. Instructions: "Go to ynab.com/settings/developer → 'New Token' → copy it back here." Link: https://app.ynab.com/settings/developer
3. **YNAB Budget + Account** — dropdowns populated by the Phase 22 `/api/ynab/budgets` + `/api/ynab/[id]/accounts` endpoints as soon as the PAT from step 2 is saved. Instructions: "Pick which budget and account Amazon purchases should land in."
4. **Anthropic Claude API Key** — paste key. Instructions: "Create an account at console.anthropic.com → API keys → 'Create Key'. You'll need a few dollars of credit." Link: https://console.anthropic.com/settings/keys
5. **Resend API Key** — paste key. Instructions: "Sign up at resend.com (free tier is fine) → API Keys → 'Create API Key'. This is used only for error notification emails." Link: https://resend.com/api-keys
6. **Pipedream Webhook URL** — paste URL. Instructions: "Create a free Pipedream account → create a new workflow with an Email trigger and an HTTP POST action pointing at `<this-app>/api/webhook`. Paste the email address Pipedream gives you into your email client's auto-forward rule." Link: https://pipedream.com — plus an inline note that the forwarding email address is the Pipedream-generated one, not a URL they host.
7. **Done** — "You're all set. Forward an Amazon order confirmation to `<pipedream email>` and it will appear in YNAB within 60 seconds."

### Route State Machine (DASH-08)
- `/` decides between `/setup`, `/login`, `/dashboard`:
  - `WIZARD_COMPLETE != 'true'` → `/setup/<next-incomplete-step>`
  - `WIZARD_COMPLETE == 'true'` + no session → `/login`
  - `WIZARD_COMPLETE == 'true'` + valid session → `/dashboard`
- `/setup/*` routes when `WIZARD_COMPLETE == 'true'` → redirect to `/dashboard` or `/login` (wizard cannot be re-run accidentally)
- Any authenticated route when `WIZARD_COMPLETE != 'true'` → redirect to `/setup` (install has to finish before dashboard is usable)

### Wizard Persistence Strategy
- **Each step writes its value to the Setting table on "Next" click** — no multi-step form state in memory. If the user closes the tab after step 3, the next visit reads Setting keys and resumes at step 4.
- Wizard does not need its own "current step" column. It derives resume position from which Setting keys are already populated:
  - ADMIN_PASSWORD set? → step 1 done
  - YNAB_ACCESS_TOKEN set? → step 2 done
  - YNAB_BUDGET_ID + YNAB_ACCOUNT_ID set? → step 3 done
  - ANTHROPIC_API_KEY set? → step 4 done
  - RESEND_API_KEY set? → step 5 done
  - PIPEDREAM_WEBHOOK_URL set? → step 6 done
  - All of the above? → set WIZARD_COMPLETE=true, redirect to /dashboard
- `WIZARD_COMPLETE` is the single authoritative "install finished" flag. It is only written once, at the end of step 6's "Finish" action.

### Middleware / Server Gate
- Prefer a **root layout server component check** over Next.js middleware because the Edge Runtime cannot read from Prisma directly. The existing app already uses iron-session server-side and a middleware cookie-existence check — we mirror that pattern:
  - Existing middleware stays minimal (cookie presence only)
  - `app/(dashboard)/layout.tsx` or an equivalent server component checks `getSetting('WIZARD_COMPLETE')` and redirects to `/setup` if not true
  - `app/setup/layout.tsx` checks the inverse and redirects away if already complete
- `/` is a small server component that reads wizard state + session state and `redirect()`s — no UI.

### Writing Instructions for Non-Programmers
- Each step's instruction block follows the same shape: 1 sentence of "why you need this", then a numbered "how to get it" list (2–4 steps max), then an outbound link rendered as a clearly-styled button or badge. No jargon without a parenthetical gloss.
- All outbound links open in a new tab (`target="_blank" rel="noopener"`).
- No fear-inducing copy around API keys. Reassure the user the key is stored only in their own Railway DB and nowhere else.

### Dead Code Removal (CLEAN-03)
- Delete `src/app/onboarding/` entirely (stub remains from Phase 21 Auth.js removal).
- Delete `src/app/(dashboard)/settings/DangerZone.tsx` and its route import.
- Delete `src/app/api/account/delete/` (multi-tenant artifact).
- Move any test-mode toggle behavior that still lives in a DangerZone-specific handler into the existing `/api/settings` PUT flow so there is one Settings write path.

### Claude's Discretion
- Visual hierarchy and exact component breakdown (step headers, progress bar, button layouts) — the planner should choose shadcn primitives that match the rest of the dashboard.
- Whether `/setup` uses nested route segments (`/setup/1`, `/setup/2`, …) or a single `/setup` page with step state — planner should pick whichever makes the server-side resume logic cleaner. Bias: nested routes, because they make resume-by-URL trivial.
- Where exactly to put the `WIZARD_COMPLETE` check — `app/(dashboard)/layout.tsx` vs a shared helper. Planner picks.
- Test coverage shape — likely a Playwright E2E that walks all 6 steps on a cleared DB, plus unit tests for the step-derivation helper.

</decisions>

<specifics>
## Specific References

- **YNAB PAT page:** https://app.ynab.com/settings/developer
- **Anthropic Console keys:** https://console.anthropic.com/settings/keys
- **Resend API keys:** https://resend.com/api-keys
- **Pipedream:** https://pipedream.com — wizard should link to the home page; the actual workflow setup is per-account and Pipedream's own UI walks them through it
- **Phase 22 provides:** `/api/ynab/budgets`, `/api/ynab/budgets/[id]/accounts`, `getSetting()`, `PUT /api/settings`
- **Phase 21 provides:** iron-session loginAction, getSetting-backed ADMIN_PASSWORD, admin_session cookie

</specifics>

<deferred>
## Deferred Ideas

- Provider screenshots embedded in the wizard (v7.0 polish — links are sufficient for v6.0)
- Wizard progress telemetry / analytics
- A "test connection" button on each step (nice-to-have; the dropdown populating live on step 3 already acts as a live PAT validation, and failures on later steps will surface naturally via the Activity Log after first email)
- Multi-language instructions
- A "skip this step" affordance for advanced users who set env vars directly — out of scope because v6.0 is explicitly DB-backed settings

</deferred>

---

*Phase: 23-first-install-wizard*
*Context gathered: 2026-04-11 via inline `/gsd:plan-phase` guidance*
