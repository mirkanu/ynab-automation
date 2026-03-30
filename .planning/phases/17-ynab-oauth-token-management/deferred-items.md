# Deferred Items - Phase 17

## Pre-existing Test Failures (Out of Scope)

### src/app/api/webhook/route.test.ts — 5 failing tests

**Status:** Pre-existing failures before Plan 17-04 changes
**Root cause:** The test mock for `@/lib/db` only mocks `processedEmail` operations but not `user.findUnique`. The webhook route's `getInitialUserId()` calls `prisma.user.findUnique({ where: { email: INITIAL_USER_EMAIL } })` which returns null in tests, causing the webhook to exit early.
**Impact:** Activity logging tests fail because the code never reaches that point.
**Fix needed:** Update `webhook/route.test.ts` to add `user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-123' }) }` to the `@/lib/db` mock.
**Discovered during:** Plan 17-04, Task 2 verification
