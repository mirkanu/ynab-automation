---
phase: quick-7
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/admin-session.ts
  - src/app/setup/1/page.tsx
  - src/middleware.ts
  - railway.json
  - README.md
autonomous: true
requirements: [POLISH-01]

must_haves:
  truths:
    - "Railway template deploys with zero user-filled environment variables"
    - "IRON_SESSION_SECRET is never required in Railway env — generated automatically at first boot"
    - "Wizard step 1 offers a Generate Password button so users never need to invent a password"
    - "If RESET_PASSWORD=true env var is set, next request clears ADMIN_PASSWORD and WIZARD_COMPLETE, re-triggering step 1"
    - "README deploy instructions and troubleshooting reflect these changes"
  artifacts:
    - path: "src/lib/admin-session.ts"
      provides: "getSessionOptions() reads IRON_SESSION_SECRET from DB (auto-generated on first call), falls back to env var"
    - path: "src/app/setup/1/page.tsx"
      provides: "Generate Password button that creates random password and populates both fields"
    - path: "src/middleware.ts"
      provides: "RESET_PASSWORD guard — clears ADMIN_PASSWORD and WIZARD_COMPLETE when env var is set"
    - path: "railway.json"
      provides: "No IRON_SESSION_SECRET generator entry; DATABASE_URL left to Railway Postgres plugin auto-inject"
    - path: "README.md"
      provides: "Deploy instructions showing zero required fields; troubleshooting entry for password recovery"
  key_links:
    - from: "src/lib/admin-session.ts"
      to: "prisma.setting"
      via: "getSetting('IRON_SESSION_SECRET') with crypto.randomBytes(32).toString('hex') on miss"
      pattern: "getSetting.*IRON_SESSION_SECRET"
    - from: "src/middleware.ts"
      to: "src/app/api/setup/step"
      via: "RESET_PASSWORD redirect clears DB and sends to /setup/1"
      pattern: "RESET_PASSWORD"
---

<objective>
Make the Railway one-click deploy require ZERO user-filled environment variables.

Purpose: Non-programmer users currently must generate a random 32-char secret before deploying, which is a barrier. This change eliminates that friction entirely: IRON_SESSION_SECRET is auto-generated and stored in DB, the wizard step 1 gains a password generator, and a RESET_PASSWORD escape hatch is added for locked-out recovery.

Output:
- Auto-generated IRON_SESSION_SECRET stored in DB Setting table
- railway.json with no env var generators (truly zero config)
- Wizard step 1 with "Generate password" button
- RESET_PASSWORD recovery mechanism in middleware
- Updated README deploy + troubleshooting sections
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/admin-session.ts
@src/lib/settings.ts
@src/app/setup/1/page.tsx
@src/middleware.ts
@src/app/api/setup/step/route.ts
@railway.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-generate IRON_SESSION_SECRET in DB + RESET_PASSWORD recovery</name>
  <files>src/lib/admin-session.ts, src/middleware.ts, railway.json</files>
  <action>
**src/lib/admin-session.ts** — Replace the static `sessionOptions` constant with a dynamic function `getSessionOptions()` that:
1. Calls `getSetting('IRON_SESSION_SECRET')` from the DB.
2. If not found: generates a 32-byte hex secret via `crypto.randomBytes(32).toString('hex')` (Node.js built-in, no import needed).
3. Saves the generated secret with `saveSettings({ IRON_SESSION_SECRET: value })`.
4. Returns `{ password: value, cookieName: 'admin_session', cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' } }`.
5. Update `getAdminSession()` to call `getSessionOptions()` instead of using `sessionOptions` directly: `getIronSession<AdminSessionData>(cookieStore, await getSessionOptions())`.
6. Keep exporting `sessionOptions` as a compatibility shim that throws a helpful error if called synchronously (any caller should be updated to use `getSessionOptions()`). Actually: grep for all uses of `sessionOptions` first — if only `getAdminSession()` uses it, just remove the export entirely and update that function.

Note: `getIronSession` accepts `SessionOptions` directly. Since `getSessionOptions()` is async, `getAdminSession()` must await it before passing to `getIronSession`.

Import `getSetting` and `saveSettings` from `@/lib/settings` at the top of the file.

**src/middleware.ts** — Add RESET_PASSWORD guard at the very top of the `middleware` function, before the session cookie check:
```
if (process.env.RESET_PASSWORD === 'true') {
  // Clear password and wizard state so next request re-triggers wizard step 1.
  // Import is not possible in Edge Runtime — call the API route instead.
  // Redirect to /api/setup/reset which handles the DB clear.
  const resetUrl = new URL('/api/setup/reset', request.url)
  return NextResponse.redirect(resetUrl)
}
```

Wait — middleware runs in Edge Runtime, cannot use Prisma. Create a new API route `/api/setup/reset/route.ts` instead and redirect there from middleware only when the env var is set and the pathname is not already `/api/setup/reset` (prevent redirect loop).

The reset route (`src/app/api/setup/reset/route.ts`) must:
- Be a GET handler (redirect-friendly)
- Delete ADMIN_PASSWORD and WIZARD_COMPLETE from the Setting table via prisma (Node.js runtime, ok)
- Respond with redirect to /setup/1
- Only run when `process.env.RESET_PASSWORD === 'true'`; if env var not set, return 403

In middleware, only redirect to `/api/setup/reset` when ALL conditions are true:
- `process.env.RESET_PASSWORD === 'true'`
- `request.nextUrl.pathname !== '/api/setup/reset'` (prevent loop)

**railway.json** — Remove the entire `environments` block. The file becomes:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run db:migrate && npm start",
    "healthcheckPath": "/api/webhook",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

DATABASE_URL is auto-injected by Railway when a Postgres plugin is linked — no explicit config needed.
  </action>
  <verify>
    <automated>cd /data/home/ynab && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- `getAdminSession()` calls `await getSessionOptions()` which reads or generates IRON_SESSION_SECRET from DB
- `/api/setup/reset` route exists, deletes ADMIN_PASSWORD + WIZARD_COMPLETE, redirects to /setup/1
- Middleware redirects to `/api/setup/reset` when `RESET_PASSWORD=true` env var is set
- `railway.json` has no `environments` block
- TypeScript compiles with no errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Password auto-generate in wizard step 1 + README updates</name>
  <files>src/app/setup/1/page.tsx, README.md</files>
  <action>
**src/app/setup/1/page.tsx** — Add a "Generate password" button that:
1. On click, calls a `generatePassword()` helper that produces a 16-character random string using `window.crypto.getRandomValues()` with alphanumeric + symbol charset (safe for copy-paste). Example charset: `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%` (excludes ambiguous chars 0/O/1/l/I).
2. Sets both `password` and `confirm` state to the generated value.
3. Shows the password in plaintext (briefly, or permanently with a show/hide toggle) so the user can copy it. Change the password input `type` to `text` when a generated password is active, so the user can see and copy it.
4. Add a small copy-to-clipboard button next to the password field when a password has been generated (use `navigator.clipboard.writeText()`). Show "Copied!" feedback for 2 seconds.

Add a `generated` boolean state: set `true` when generate is clicked, `false` when the user manually edits the field.

Layout: Place the "Generate password" link/button as a small secondary action below the password label, styled as a text link (`color: '#2563eb', cursor: 'pointer', fontSize: '0.8125rem', background: 'none', border: 'none', padding: 0`).

When `generated === true`, switch the password input to `type="text"` and show the copy button inline on the right side of the input (use relative positioning with an absolutely-positioned copy icon button inside a wrapper div).

Keep all existing validation logic and the confirm field unchanged.

**README.md** — Make the following targeted updates:

1. Find the deploy section that mentions needing to fill in `IRON_SESSION_SECRET` (around lines 52-55, 117, 137-139). Update to say the template requires **no** environment variables — all secrets are auto-generated or set through the wizard. Remove instructions for generating `openssl rand -base64 32`.

2. Find the Troubleshooting section (around line 333) for the `IRON_SESSION_SECRET` / session expiry issue (around line 399-401). Replace the `IRON_SESSION_SECRET` advice with a section about the new RESET_PASSWORD recovery flow:

**Add a new troubleshooting entry** titled "I forgot my admin password" (or similar):
```
**I forgot my admin password and cannot log in**

Set the `RESET_PASSWORD` environment variable to `true` in your Railway service's
Variables tab, then redeploy (or trigger a restart). On the next request the app
will clear your admin password and reset the setup wizard so you can choose a new
password. Remove `RESET_PASSWORD` (or set it to `false`) immediately after you have
set your new password, then redeploy again.
```

3. Remove or update any paragraph that still describes `IRON_SESSION_SECRET` as a required deploy-time value. It is now fully optional (auto-generated). If a user sets it manually it will be used; otherwise the app generates one.
  </action>
  <verify>
    <automated>cd /data/home/ynab && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- Wizard step 1 has a "Generate password" button that populates both fields with a readable random password
- Generated password shown in plaintext with a copy button
- README deploy section no longer mentions IRON_SESSION_SECRET as required
- README troubleshooting has "I forgot my admin password" entry describing RESET_PASSWORD flow
- TypeScript compiles with no errors
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. TypeScript compiles: `npx tsc --noEmit` — zero errors
2. `railway.json` has no `environments` block — `grep -c "IRON_SESSION_SECRET" railway.json` returns 0
3. `admin-session.ts` exports `getSessionOptions` not `sessionOptions` — `grep "getSessionOptions" src/lib/admin-session.ts` returns matches
4. `/api/setup/reset/route.ts` exists: `ls src/app/api/setup/reset/route.ts`
5. Middleware has RESET_PASSWORD guard: `grep -c "RESET_PASSWORD" src/middleware.ts` returns ≥ 1
6. README no longer requires IRON_SESSION_SECRET at deploy: `grep -c "openssl rand" README.md` returns 0
</verification>

<success_criteria>
- Zero required env vars on Railway template deploy — user clicks "Deploy Now" and it works
- IRON_SESSION_SECRET auto-generated from DB on first boot, no manual step
- Wizard step 1 lets users generate a secure password without thinking
- Locked-out users can recover by setting RESET_PASSWORD=true in Railway variables
- README is accurate and no longer misleads users into generating a secret manually
</success_criteria>

<output>
After completion, create `.planning/quick/7-zero-config-railway-deploy/7-SUMMARY.md` using the standard summary template.
</output>
