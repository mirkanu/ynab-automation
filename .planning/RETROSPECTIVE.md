# Retrospective

Living document. Each milestone appends a new section; cross-milestone trends update at the bottom.

---

## Milestone: v5.0 — Multi-Tenant SaaS

**Shipped:** 2026-04-10 (core work 2026-03-30, UAT + fixes 2026-04-10)
**Phases:** 4 | **Plans:** 20

### What Was Built

- **Phase 16** — Auth.js v5 passwordless signup, PostgreSQL FORCE RLS with Prisma `$extends` middleware, three-phase safe migration making userId NOT NULL, existing single-user data backfilled to user #1
- **Phase 17** — AES-256-GCM token encryption, YNAB Authorization Code Grant flow, per-user token retrieval with proactive 5-min refresh and 30s concurrency mutex
- **Phase 18** — EmailForwardingAddress + ProcessedWebhook tables with RLS, SHA256 mailbox hash library wired into Auth.js createUser event, POST /api/email/inbound webhook handler
- **Phase 19** — Per-user test mode (intended), parse transparency in LogRow, 3-step guided onboarding with provider detection, GDPR account deletion cascade, public marketing homepage, dashboard moved to /dashboard

### What Worked

- **Wave 0 test stub pattern** — importless `it.todo()` stubs in Phases 17, 18, 19 kept the test suite green while source was still being written. Once each plan's source landed, the todos converted to real tests without churning imports.
- **Phase 16 three-phase migration** — nullable userId → backfill → NOT NULL constraint. Idempotent backfill (safe to re-run), and the NOT NULL step only fired after verification that no rows remained null.
- **Encrypted token handling in Phase 17** — AES-256-GCM with random-nonce ciphertext, separate unit-tested crypto module, clean separation from the OAuth flow. The proactive-refresh + mutex pattern prevented the classic thundering-herd problem on concurrent requests.
- **Per-phase VERIFICATION agents** — gsd-verifier caught several issues in-flight that would have become UAT gaps.

### What Was Inefficient

- **Phase 19-02 claimed "test mode fully wired" but only touched the UI** — both email pipelines (the active /api/webhook Pipedream handler and the built-but-unused /api/email/inbound) kept reading `process.env.TEST_MODE === 'true'`. This was a silent production bug for 10 days until `/gsd:verify-work 19` on 2026-04-10 caught it. SUMMARY overclaiming is the highest-impact failure mode this milestone.
- **Middleware `request.url` callbackUrl bug** — Edge runtime behind Railway's proxy resolves to `localhost:8080`. This would have broken every magic-link signin in production. Discovered via automated curl check during UAT (`/gsd:verify-work 19`), fixed in commit 80ee088. Could have been caught by an in-phase smoke test.
- **Built for scale that didn't materialize** — v5.0 assumed "dozens of users initially, thousands eventually". Actual usage: one household. RLS, per-user tokens, mailbox hashing, cascade deletes, and onboarding flows are all being rolled back in the next milestone. The implementation was sound; the requirement was wrong.
- **Legacy /api/webhook never deprecated** — The Phase 18 /api/email/inbound was built and tested, but emails still flow through the v4.0 Pipedream path. Neither the execution plan nor the verification caught that the new handler was dead code in production.
- **10 test failures landed and were ignored** — webhook route tests, multi-tenant isolation tests, migration tests all failing as of 2026-04-10. None of them gated phase completion because they were in separate files from the wave-0 stubs. Lesson: `npm test` in CI should block, not just produce noise.

### Patterns Established

- **Importless Wave 0 test stubs** — `it.todo()` with no source imports, so the suite stays green while the implementation is still being written
- **Live-endpoint smoke checks during UAT** — curl the production URL before asking the user anything (found 2 blockers before Test 4)
- **Severity inferred from user language, not asked** — UAT flow worked well; no friction

### Key Lessons

1. **SUMMARY overclaiming is the highest-impact failure mode.** A phase that claims "fully wired" when it's only UI-wired will ship, pass verification, and silently break in production. Remediation: UAT on live production should be mandatory before milestone completion, not optional.
2. **Edge middleware is proxy-hostile.** `request.url` behind a reverse proxy is unreliable. Always use `request.nextUrl` for path operations, or read `x-forwarded-host` explicitly.
3. **Legacy handler paths don't self-deprecate.** When building a replacement for an active production path, explicitly cut over traffic or delete the legacy handler — otherwise it becomes invisible and the new code is dead.
4. **"Future-proofing" has real implementation cost.** Multi-tenant architecture consumed 3+ days of work for zero actual multi-tenant usage. Estimate the probability of the scale assumption before committing to architectural complexity.
5. **Don't trust the test suite unless it's green and gating.** 10 failing tests were present throughout v5.0 and didn't block anything because no one was watching them.

### Cost Observations

- Model mix: ~50% sonnet, ~50% haiku (planner model: sonnet, verifier model: haiku, executor: sonnet)
- Sessions: ~8 across the milestone (core work was 3 days of intense execution, then quick tasks, then UAT + fixes 10 days later)
- Notable: Wave-based parallel execution via gsd-executor agents kept orchestrator context under 15% throughout. Biggest context spend was in UAT when the two blockers triggered deep code reads across middleware, webhook, and inbound handlers.

---

## Cross-Milestone Trends

| Metric | v4.0 | v5.0 |
|--------|------|------|
| Phases | 6 | 4 |
| Plans | 7 | 20 |
| Duration | ~3 days | ~3 days (core) + 10 days (UAT gap) |
| Post-ship bugs found | 0 (no UAT) | 2 blockers (test mode, middleware) |

### Recurring Patterns

- **Quick tasks reverse earlier deletions** — Phase 19-04 simplified settings to "per-user controls only" by deleting sender/currency routing UI; Quick-4/5/6 then restored them. Lesson: resist "clean up by deletion" urges when the feature has real users.
- **SUMMARY.md accuracy degrades under time pressure** — v4.0's SUMMARYs were accurate; v5.0's Phase 19-02 was not. Something about the multi-tenant complexity or the 3-day sprint cadence encouraged overclaiming.
