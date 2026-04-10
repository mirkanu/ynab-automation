---
status: complete
phase: 19-dashboard-onboarding-account-management
source: [19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md, 19-05-SUMMARY.md]
started: 2026-04-10T08:00:59Z
updated: 2026-04-10T10:30:00Z
---

## Current Test

[testing complete]

note: |
  Scope trimmed 2026-04-10 — next milestone reverts to single-tenant. Multi-tenant-only tests (signup flow, onboarding, per-user forwarding address, account deletion, tenant isolation) marked skipped.

## Tests

### 1. Cold Start Smoke Test
expected: Railway deployment responds healthy, homepage returns 200, migrations are applied.
result: pass
note: "Automated check by Claude — Railway production URL ynab-test-production.up.railway.app, GET / → HTTP 200, GET /dashboard (unauth) → HTTP 307 (redirect), protected API routes (DELETE /api/account/delete, POST /api/settings/test-mode, POST /api/onboarding/complete) → HTTP 401. Server is up and auth guards are functioning."

### 2. Public Homepage
expected: Visit `/` while logged out. See a public homepage with product explanation and a "Sign up free" call-to-action.
result: pass
note: "Automated check — HTTP 200, 12KB response, contains 'Sign up' and 'forward' text. Route group correctly excludes / from middleware auth protection."

### 3. Authenticated Redirect from Homepage
expected: When already logged in, visiting `/` redirects you to `/dashboard`.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 3b. Middleware signin callbackUrl (auto-discovered)
expected: Unauthenticated /dashboard redirects to /auth/signin with a valid relative callbackUrl (not a localhost:8080 URL).
result: pass
note: "Blocker discovered during automated testing was fixed in commit 80ee088 (fix(middleware): use relative path for signin callbackUrl). Re-verified live: callbackUrl is now %2Fdashboard, %2Fdashboard%2Fsettings, %2Fonboarding — relative path, proxy-agnostic. Middleware uses request.nextUrl.pathname + search instead of request.url."

### 4. New User Signup → Onboarding
expected: Sign up a brand new user via magic link. After clicking the email link, you land on `/onboarding` (not directly on the dashboard), because `onboardingCompleted` is false.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 5. Onboarding Step 1: Connect YNAB
expected: On `/onboarding`, Step 1 shows a "Connect YNAB" action. Clicking it runs the YNAB OAuth flow and on return the step is marked done.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 6. Onboarding Step 2: Forwarding Address
expected: Step 2 shows the user's unique forwarding email address from the DB with a copy-to-clipboard button.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 7. Onboarding Step 3: Provider-Specific Instructions
expected: Step 3 shows forwarding instructions tailored to your email provider (Gmail / Outlook / Apple / other).
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 8. Complete Onboarding
expected: Finishing onboarding POSTs to `/api/onboarding/complete`, sets `onboardingCompleted=true`, lands you on `/dashboard`.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 9. Dashboard Stats
expected: `/dashboard` shows stats: total processed, success rate, last transaction.
result: pass

### 10. Dashboard Activity Log + Parse Transparency
expected: Activity log with expandable Claude's Reasoning (no raw debug fields).
result: pass

### 11. Dashboard Shows DB Forwarding Address
expected: Dashboard displays forwarding email from the DB, varies per user.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 12. Settings: Per-User Controls Only
expected: Settings page shows only per-user controls; no admin-era fields (API keys, Railway sync).
result: pass
note: "Sender rules and currency-based account routing are present — deliberately restored by Quick-4, Quick-5, Quick-6 as per-user routing configuration. API keys and Railway sync UI correctly absent."

### 13. Test Mode Toggle
expected: Test mode toggle shows banner, persists across reload.
result: pass

### 14. Test Mode Parses Without Writing to YNAB
expected: With test mode ON, forwarded email parses but no YNAB transaction created.
result: pass
note: "PASSED after 2 fix commits. Originally: transaction written to YNAB despite test mode ON. After first fix (926e9fe): still failing because /api/webhook was the active path, not /api/email/inbound. After second fix (f92e34c): pass — webhook now reads user.testMode from DB."
severity: blocker
root_cause: |
  Two layers of bugs:
  1. /api/email/inbound/route.ts (Phase 18 handler) never checked user.testMode at all.
  2. MORE IMPORTANTLY: emails still flow through the OLD /api/webhook route (Pipedream
     integration, v4.0 era) — which checked `process.env.TEST_MODE === 'true'`, an env
     var that was never set. The Settings toggle updated user.testMode in the DB but
     the actual active handler ignored it.
  Phase 19-02's SUMMARY claimed test mode was 'migrated to per-user DB' but only wired
  the dashboard banner and the settings API route. Both email-processing pipelines
  were missed.
fix_commits:
  - "926e9fe: fix(inbound-email): honour user.testMode (Phase 18 handler)"
  - "f92e34c: fix(webhook): read test mode from user.testMode DB column (Pipedream handler — the active path)"
fix: |
  webhook/route.ts: getInitialUser() now selects testMode along with id; Step 8 reads
  initialUser.testMode instead of process.env.TEST_MODE. The Settings toggle now
  actually controls the pipeline.
status_after_fix: awaiting_user_reverify

### 15. Danger Zone: Account Deletion Confirmation
expected: Delete Account button requires explicit confirmation step.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 16. Account Deletion Actually Deletes
expected: Confirming deletion cascades, signs out, lands on public homepage.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

### 17. Tenant Isolation on Dashboard
expected: User A and User B see only their own data.
result: skipped
reason: "Not relevant for next milestone (single-tenant rollback)"

## Summary

total: 18
passed: 8
issues: 0
pending: 0
skipped: 10
resolved_blockers: 2
scope_note: "Multi-tenant-only tests skipped — next milestone reverts to single-tenant"

## Gaps

- truth: "Signin callbackUrl points to the correct production URL so users can complete auth flow"
  status: resolved
  reason: "Blocker found during automated testing, fixed in commit 80ee088 and verified live. Middleware now uses request.nextUrl.pathname + search (relative path) instead of request.url (which resolved to localhost:8080 behind Railway's proxy)."
  severity: blocker
  test: 3b
  root_cause: "src/middleware.ts:18 used `request.url` which, under Next.js Edge runtime behind Railway's proxy, resolves to the internal bind URL (localhost:8080) rather than the forwarded public URL."
  fix_commit: "80ee088"
  fix_files:
    - "src/middleware.ts"
