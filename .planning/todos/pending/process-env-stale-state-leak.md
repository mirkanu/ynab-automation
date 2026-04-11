---
captured: 2026-04-11
priority: medium
source: Phase 23 verification (SC2 resume test)
---

# settings.ts leaks stale state via process.env

## Problem

`src/lib/settings.ts` has three functions that mutate `process.env`:

1. `loadDbSettings()` — reads all Setting DB rows at startup and writes them into `process.env`
2. `saveSettings()` — on every upsert, also writes the new value to `process.env`
3. `getSetting()` — falls back to `process.env` when the DB row is missing

**The bug:** deleting a Setting row does NOT clear `process.env`. `getSetting()` then hits its fallback and returns the stale value from the previous load/save. The DB looks empty, but the app behaves as if the row is still populated — until the container restarts.

## How it surfaced

During Phase 23 Plan 04 SC2 (resume test), I DELETEd `RESEND_API_KEY`, `PIPEDREAM_WEBHOOK_URL`, and `WIZARD_COMPLETE` from the Setting table to verify the wizard resumes at step 5. Instead, `/` still redirected to `/login` because the running container's `process.env.WIZARD_COMPLETE` was still `'true'` from a prior `saveSettings()` call. Workaround: UPDATE the rows to empty string instead of DELETE — `deriveWizardStep()` treats `''` as not-set, so the resume worked. But the root cause remains.

## Why it matters beyond verification

- **Settings editor (Phase 22)**: if an admin deletes a value in the UI and the code ever calls `prisma.setting.delete`, the old value persists until next deploy
- **Phase 24 cleanup**: if DOCS-01 says "revert to env-var-only mode", deleting DB rows won't actually fall back to the true env var — it'll serve the most-recently-saved DB value instead, silently
- **Wizard re-run after manual DB wipe**: someone troubleshooting can't clear wizard state by dropping the Setting row; they'd have to restart the container too

## Suggested fix

Two reasonable options:

1. **Remove the `process.env` mutation entirely.** `getSetting()` reads from DB only (no env fallback). Env vars can be seeded into the DB on first boot via a one-shot script (or the wizard covers that path). Simplest and most correct. Breaks only advanced self-hosters who set env vars directly and never run the wizard — but Phase 23 means the wizard is the canonical path now.

2. **Keep the env fallback but make it env-var-only, not process.env.** On boot, capture `INITIAL_ENV = { ...process.env }` once, and have `getSetting()` fall back to `INITIAL_ENV[key]`, NOT mutated `process.env[key]`. Deleting a DB row then reveals the true env var underneath, or returns undefined. Preserves backwards compat with direct env var setting.

Bias: option 1 unless there's a self-hoster use case we care about.

## Scope

Single file: `src/lib/settings.ts`. Touches `loadDbSettings`, `saveSettings`, `getSetting`. Unit tests for each of the three functions would be worth adding.

## Where to land this

Probably Phase 24 (test cleanup + docs) — it's a correctness bug but not a v6.0 blocker since Phase 23 UX never triggers it (wizard only writes, never deletes).
