# Multi-Tenant SaaS Conversion Pitfalls

**Domain:** Converting single-user Next.js + PostgreSQL automation into multi-tenant SaaS
**Researched:** 2026-03-28
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Data Leakage via Missing user_id Filters

**What goes wrong:**
A user queries the database without filtering by their user_id, exposing another user's data. This is particularly dangerous in:
- Activity logs showing other users' email processing history
- Settings queries returning another user's YNAB tokens or configuration
- Email routing webhook handlers that don't verify ownership of the inbound address
- Background jobs (deduplication, token refresh) that operate on all records instead of per-user

Example: GET `/api/activity` returns logs for all users because the query forgot the `WHERE user_id = ?` clause. A user can then enumerate all transactions processed by any user in the system.

**Why it happens:**
- Transitioning from single-user to multi-user, the mental model shifts. Code that worked on "the current deployment's data" now must work on "my user's data only"
- Auth context (user_id) is available in Auth.js session, but developers forget to pass it to database queries
- Existing code doesn't need user_id filters (there's only one user), so reviewers miss the addition as a requirement
- TypeScript doesn't catch missing WHERE clauses — the query is syntactically valid
- Tests pass with a single user, so the bug doesn't surface until multiple users exist

**How to avoid:**
1. **Establish a rule: Every query must have a WHERE clause that includes user_id or references the user through a foreign key**
   - Use a custom query builder or ORM wrapper that enforces this (e.g., Prisma with user context middleware)
   - Add a linter rule or code comment pattern to catch queries without tenant filtering
2. **Extract user_id early in every API route and pass it through**
   ```typescript
   const session = await auth();
   if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
   const userId = session.user.id;
   // All queries below use userId in WHERE clause
   ```
3. **Use database Row-Level Security (RLS) policies as a backstop**
   - PostgreSQL 15+ supports RLS policies that enforce tenant isolation at the database level
   - Even if application code forgets the WHERE clause, the database rejects the query
   - Applies to all interfaces (direct queries, webhooks, background jobs)
4. **Test with multiple users**
   - Create test fixtures with user1 and user2
   - Verify user1 cannot access user2's data via any API endpoint
   - Include this in continuous integration
5. **Code review checklist:** Every database query must mention user_id or a related entity scoped to the user

**Warning signs:**
- API endpoint that returns data but doesn't validate `session.user.id`
- SQL query that looks correct but the WHERE clause is missing user_id
- Webhook handler (email routing) that processes events without verifying ownership
- Background job that loops over all records instead of a user's records
- Test data suddenly visible to multiple users in manual testing

**Phase to address:**
Phase 1 (User Accounts & Auth) — Establish the pattern. Every query in the initial auth implementation must demonstrate proper user_id filtering. This becomes the template for all subsequent phases.

---

### Pitfall 2: OAuth Token Security — Storage, Refresh, and Revocation

**What goes wrong:**
The YNAB OAuth token is compromised, leaked, or becomes invalid, but the app continues trying to use it or leaks it to other users. Failure modes:

1. **Token leaked in logs or errors:** A token appears in a console error, server logs, or error notification, where it can be accessed by other people or audited by log retention tools
2. **Token not encrypted at rest:** The database stores the token in plaintext; a database breach exposes all users' YNAB credentials
3. **Refresh token race condition:** Multiple simultaneous requests detect an expired token and attempt to refresh simultaneously, causing one to succeed and others to overwrite it with an already-expired token
4. **Token not revoked on disconnect:** User disconnects YNAB, but the database still contains the token; if the DB is breached, the token remains valid
5. **Wrong token returned to wrong user:** Token lookup doesn't filter by user_id, returning another user's token
6. **Token sent to client without HTTPOnly flag:** Token is included in a response cookie without HTTPOnly, allowing JavaScript access and theft via XSS

**Why it happens:**
- OAuth token handling feels like generic authentication; developers use patterns from password storage without accounting for the specific risks of third-party tokens
- Refresh tokens are "nice to have" until they're critical (2-hour token expiration is inconvenient), but implementing them introduces concurrency complexity
- YNAB's Implicit Grant flow (if used) doesn't support refresh tokens, forcing a re-auth on expiration — developers might not realize Authorization Code Grant exists
- Testing OAuth flows requires a real YNAB account and is rarely included in CI, so bugs surface late
- Encryption adds complexity; plaintext storage seems "fine for now" in MVP

**How to avoid:**
1. **Use YNAB's Authorization Code Grant, not Implicit Grant**
   - Authorization Code supports refresh tokens; Implicit doesn't
   - Refresh tokens allow long-lived sessions without re-auth every 2 hours
   - Exchange the authorization code on the server (not the browser) to keep the token server-side
2. **Encrypt tokens at rest using AES-256**
   - Store the token in the Account table with an encrypted column
   - Use a key management service (KMS) or environment variable for the encryption key
   - Verify decryption works before saving
   - Example: `UPDATE accounts SET ynab_access_token_encrypted = pgp_sym_encrypt(...) WHERE user_id = ?`
3. **Implement refresh token rotation**
   - Detect expired tokens (check `expires_at` timestamp before making YNAB API calls)
   - On first 401 from YNAB API, attempt to refresh using the refresh token
   - Store the new token and update the expiration timestamp
   - Use a mutex or database lock to prevent concurrent refresh attempts (see Pitfall 3)
4. **Never log or expose tokens**
   - Redact tokens in error messages: `error: "YNAB API failed: ${error.message}"`
   - Don't include tokens in query parameters or URL fragments
   - Don't log the response body from OAuth endpoints if it contains tokens
5. **Revoke tokens on disconnect**
   - When a user clicks "Disconnect YNAB", call the YNAB revocation endpoint (if available) and delete the token from the database
   - Add a task to rotate/revoke tokens for account deletion (GDPR compliance)
6. **Use Auth.js Account table for token storage**
   - Auth.js has a built-in Account table with `access_token`, `refresh_token`, `expires_at`, and `refresh_token_expires_at` fields
   - These are designed for OAuth and include encryption options
   - Filtering by user_id is built in
7. **Test token refresh independently**
   - Simulate token expiration by manually updating `expires_at` to the past
   - Verify the next API call triggers a refresh
   - Verify the token is updated in the database
   - Test concurrent requests with an expired token

**Warning signs:**
- Token appears in error messages or logs
- User receives "Unauthorized" from YNAB API after token was valid 5 minutes ago (expired token, no refresh attempt)
- Multiple users report "cannot connect YNAB" after a few hours (token not refreshing)
- Decrypted token length differs from expected (corruption or truncation)
- Test shows one user's token stored unencrypted

**Phase to address:**
Phase 1 (User Accounts & Auth) — YNAB OAuth implementation. Use Auth.js Account table, implement refresh token rotation, and add encryption. This is foundational and affects all user-facing features.

---

### Pitfall 3: Concurrent Refresh Token Exhaustion

**What goes wrong:**
Two API requests arrive simultaneously with an expired YNAB token. Both detect expiration and attempt to refresh:
1. Request A: Detects token is expired, calls YNAB refresh endpoint
2. Request B: Detects token is expired, calls YNAB refresh endpoint (unaware of A)
3. A completes, updates token to `new_token_A` with new expiration
4. B completes, updates token to `new_token_B` with new expiration
5. Next request (C) uses `new_token_B`, but YNAB's refresh endpoint has already marked it as "used" — authentication fails
6. YNAB marks the refresh token as "too many attempts" — account is locked out

**Why it happens:**
- Multi-tenant environments have background jobs and webhooks running concurrently for multiple users
- A user forwards an email while their token refresh job runs — both hit the API simultaneously
- Developers assume refresh is rare and don't implement locking
- Testing with a single user rarely triggers this (the refresh is serialized)

**How to avoid:**
1. **Use a database-level lock on the token update**
   ```typescript
   // Within a transaction:
   const account = await db.account.findUnique({
     where: { userId: session.user.id },
     select: { refresh_token, expires_at }
   });

   if (isExpired(account.expires_at)) {
     // Start a transaction with row-level lock
     const newToken = await refreshToken(account.refresh_token);

     // Update with timestamp to detect concurrent attempts
     await db.account.update({
       where: { userId: session.user.id },
       data: {
         access_token_encrypted: encrypt(newToken.access_token),
         expires_at: newToken.expires_at,
         last_refresh_attempt_at: now() // Detect multiple refreshes
       }
     });
   }
   ```
2. **Implement a refresh mutex/debounce**
   - Add a `last_refresh_attempt_at` timestamp
   - If a refresh was attempted in the last 30 seconds, wait or retry instead of refreshing again
   - This prevents rapid-fire refresh attempts
3. **Handle YNAB "too many refresh attempts" errors gracefully**
   - Catch the specific error from YNAB (refresh_token_exhausted or similar)
   - Redirect user to re-authorize (force a new OAuth flow)
   - Log this as a critical issue (likely a bug in your code)
4. **Test concurrent requests with an expired token**
   - Use a load testing tool or async test to send 5+ simultaneous requests with an expired token
   - Verify all succeed and none fail with "invalid_token" errors

**Warning signs:**
- User reports "YNAB authorization failed" after using the app normally
- Errors from YNAB mention "refresh token reuse" or "too many refresh attempts"
- Multiple refresh attempts in logs within seconds of each other for the same user
- Test shows token updated correctly but next API call fails

**Phase to address:**
Phase 1 (User Accounts & Auth) — OAuth implementation. Refresh token locking must be included in the initial YNAB OAuth setup.

---

### Pitfall 4: Inbound Email Routing to Wrong User

**What goes wrong:**
A user's order confirmation email is routed to the wrong user's YNAB account, or lost entirely. Consequences:
- User A forwards an email to their inbound address, but it's processed as if from User B — User B's YNAB account gets a bogus transaction
- Email arrives but no webhook is received (lost email)
- Multiple emails route to the same inbound address (overlapping addresses)
- Webhook is received multiple times (retries), creating duplicate transactions
- Webhook signature validation passes for the wrong user (shared secret)

**Why it happens:**
- Postmark/SendGrid inbound webhook is configured with a single destination URL, but multiple users each have their own inbound address
- The routing from "inbound address → user → webhook handler" is custom logic, not provided by the email provider
- MailboxHash (a way to tag the email address with metadata) is forgotten or misconfigured
- Webhook secret is shared globally instead of per-user, so any webhook can be replayed to any user
- Deduplication is done on message ID alone (not per-user), so the same email from one sender is only processed once even if multiple users should receive it
- Retry logic in Postmark (10 retries over 10.5 hours) creates duplicate transactions without idempotency

**How to avoid:**
1. **Use MailboxHash to embed user context in the inbound address**
   - Generate a hash for each user: `user_${userId}_${randomHash}`
   - Configure inbound address as: `inbox+{mailboxHash}@yourdomain.com`
   - Extract the hash from the parsed email and look up the user
   - Verify the hash matches the expected format (prevents arbitrary user lookup)
   ```typescript
   const mailboxHash = email.mailboxHash; // "user_123_abc456"
   const [_, userId, hash] = mailboxHash.split('_');
   const user = await db.user.findUnique({ where: { id: userId } });
   // Verify the hash matches what we issued to this user
   if (hash !== user.inbound_address_hash) {
     return Response.json({ error: "Invalid inbound address" }, { status: 400 });
   }
   ```
2. **Implement idempotency on webhook processing**
   - Store the webhook delivery ID (Postmark provides `MessageID`) in a processed_webhooks table
   - Before processing, check if this ID was already handled
   - Return 200 immediately if already processed (tells provider to stop retrying)
   ```typescript
   const webhookId = req.body.MessageID;
   const existing = await db.processed_webhook.findUnique({
     where: { webhook_id: webhookId }
   });
   if (existing) {
     return Response.json({ status: "ok" }); // Already processed
   }
   // ... process ...
   await db.processed_webhook.create({ data: { webhook_id: webhookId, user_id: userId } });
   ```
3. **Verify webhook signature using per-user secret (or global secret + user verification)**
   - Postmark supports custom webhook signatures (HMAC-SHA256)
   - Store a webhook secret per user (or use a global secret, but always verify user_id matches)
   - Verify the signature before trusting the webhook payload
   - Reject if verification fails
4. **Scope deduplication by user**
   - Store message IDs per user: `UNIQUE(user_id, message_id)` instead of just `message_id`
   - This allows the same email to be processed by multiple users (if they both forward it)
5. **Test email routing with multiple users**
   - Configure inbound addresses for user1 and user2
   - Send an email to user1's address
   - Verify it appears in user1's activity log, not user2's
   - Send to user2's address and verify isolation
   - Send the same email to both addresses and verify both receive it
6. **Configure webhook retries and timeouts carefully**
   - Set a short timeout (5-10s) so Postmark considers your webhook fast
   - Return 200 only after the transaction is confirmed created
   - Use a background job for email parsing (if it's slow) and return 200 immediately

**Warning signs:**
- User A's activity log shows a transaction from an email they didn't send
- Two users report the same order confirmation was processed (duplicate in system)
- Emails to one user's address are missing from activity log
- Same email appears multiple times for one user (retries not deduplicated)
- Webhook delivery errors in Postmark dashboard, but no error notification to user

**Phase to address:**
Phase 2 (Per-User Inbound Email) — Inbound email routing implementation. MailboxHash configuration, idempotency, and user isolation are all required before processing the first email in multi-tenant mode.

---

### Pitfall 5: Session Context Lost in Background Jobs and Webhooks

**What goes wrong:**
Background jobs or webhook handlers don't have access to `Auth.js` session context (user_id), so they either:
- Default to processing data for all users or the first user (leaking data)
- Fail because they can't determine who to process for
- Use a hardcoded user_id (works for single-user, breaks for multi-tenant)

Example: A background job that refreshes expired YNAB tokens runs nightly and doesn't know which user's token to refresh. It either:
1. Refreshes the token for user_id = 1 (hardcoded — breaks for other users)
2. Loops over all users (correct, but easy to miss)
3. Has no access to user context and is skipped

**Why it happens:**
- Auth.js middleware is designed for HTTP request/response cycles (where user is authenticated)
- Background jobs run outside HTTP context and have no session
- Webhook handlers receive JSON data but may not include user_id if not explicitly added
- Existing single-user code doesn't pass user_id through, since there was only one user

**How to avoid:**
1. **Always include user_id in webhook payloads and job parameters**
   - Postmark webhook: Extract user_id from MailboxHash and include in handler
   - Background job: Pass user_id as a parameter, not as global context
   ```typescript
   // Webhook handler
   const mailboxHash = req.body.mailboxHash; // user_123_abc456
   const userId = extractUserIdFromHash(mailboxHash);

   // Background job
   const expiredAccounts = await db.account.findMany({
     where: { expires_at: { lt: new Date() } }
   });
   for (const account of expiredAccounts) {
     await refreshToken(account.userId, account.refresh_token);
   }
   ```
2. **Use a job queue (like Bull or Inngest) with user_id as a parameter**
   - Don't rely on global state or magic context variables
   - Pass user_id explicitly to every job
   ```typescript
   await queue.enqueue('refresh-token', { userId: account.userId });

   // In the job handler:
   const { userId } = job.data;
   const account = await db.account.findUnique({ where: { userId } });
   ```
3. **Test background jobs with multiple users**
   - Create test data for user1 and user2
   - Run the job and verify it only processes the correct user's data
   - Check logs to confirm user_id is passed through

**Warning signs:**
- Webhook handler processes an email but updates the wrong user's activity log
- Background job logs show it's always processing the same user or all users
- Job fails with "user not found" because user_id isn't passed
- Test passes with one user but fails with multiple users

**Phase to address:**
Phase 2 (Per-User Inbound Email) and Phase 3 (Per-User OAuth) — Any job or webhook that handles user data must include user_id context from the start. This is not a "add later" feature.

---

### Pitfall 6: Migration Data Integrity — Adding user_id to Existing Tables

**What goes wrong:**
When converting from single-user to multi-user, existing data must be migrated to have a user_id. This goes wrong as:
1. **Data orphaned:** Old records have NULL user_id and become inaccessible
2. **Data migrated to wrong user:** All historical data assigned to user_id = 1 (correct), but if user_id = 1 is deleted later, all history is deleted
3. **Foreign key constraints break:** Activity log references a user that doesn't exist
4. **Down migration impossible:** No way to revert to single-user schema
5. **Migration runs twice:** Idempotency not enforced, user_id set to NULL, then to user ID, then to NULL again

**Why it happens:**
- Adding a `NOT NULL` constraint to an existing table with data is a blocker; migrations must use nullable columns
- The "backfill" step (UPDATE ... SET user_id = ... WHERE ...) is easy to forget or get wrong
- Testing migrations is skipped in favor of "just run it in prod"
- Rollback procedures aren't documented, so a failed migration leaves the database in an inconsistent state

**How to avoid:**
1. **Plan the migration in phases**
   - Phase 1: Create the user_id column as nullable
   - Phase 2: Backfill existing data (old data → user_id = 1, new data → current user)
   - Phase 3: Add NOT NULL constraint
   - Phase 4: Verify all records have user_id and run a full audit
2. **Write an idempotent migration script**
   ```sql
   -- Migration 1: Add nullable column
   ALTER TABLE activity_log ADD COLUMN user_id UUID;

   -- Migration 2: Backfill existing data (idempotent)
   UPDATE activity_log SET user_id = (SELECT id FROM "user" LIMIT 1)
   WHERE user_id IS NULL;

   -- Migration 3: Verify and make NOT NULL
   SELECT COUNT(*) FROM activity_log WHERE user_id IS NULL;
   -- If count is 0, then:
   ALTER TABLE activity_log ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE activity_log ADD CONSTRAINT fk_activity_log_user FOREIGN KEY (user_id) REFERENCES "user"(id);
   ```
3. **Test migrations with production-like data**
   - Dump a copy of the current database
   - Run the migration against the copy
   - Verify data integrity:
     - All activity logs have a user_id
     - All user_id values exist in the user table
     - Row counts before/after are the same
   - Create a rollback plan (document how to revert if something goes wrong)
4. **Assign a migration owner who understands the data**
   - Not just a schema change, but a data transformation
   - The owner runs the migration in staging first, verifies the result, and then runs it in production
   - Communicate with the user (Manuel) about the migration and potential data loss/changes

**Warning signs:**
- Migration script has no backfill step (user_id is NULL for old records)
- Migration not idempotent (running twice causes issues)
- No rollback procedure documented
- Test database shows different record counts before/after migration
- Old records suddenly missing after migration (most likely deleted or orphaned)

**Phase to address:**
Phase 1 (User Accounts & Auth) — Database schema migration. This must be carefully planned and tested before any user-facing features depend on user_id. It's a prerequisite for all subsequent phases.

---

### Pitfall 7: Auth.js Session User ID Not Wired Through API Routes

**What goes wrong:**
Auth.js is configured to authenticate users, but the session doesn't include the user's database ID. Developers try to use `session.user.id` in API routes, but it's undefined. They then:
- Hardcode a user_id (works for testing, breaks for other users)
- Use session.user.email as the lookup key (slower, error-prone)
- Skip the check entirely (security issue)

**Why it happens:**
- Auth.js by default only includes name, email, and image in the session
- The user's database ID must be explicitly added in the session callback
- The NextAuth/Auth.js documentation shows the pattern, but many tutorials skip this step
- TypeScript doesn't warn that `session.user.id` is undefined (it's just a missing property)

**How to avoid:**
1. **Explicitly add user.id to the JWT token and session callback**
   ```typescript
   // pages/api/auth/[...nextauth].ts
   export const authOptions = {
     callbacks: {
       jwt({ token, user }) {
         if (user) {
           token.id = user.id; // Store database ID in token
         }
         return token;
       },
       session({ session, token }) {
         session.user.id = token.id; // Include ID in session
         return session;
       }
     }
   };
   ```
2. **Augment the TypeScript Session type**
   ```typescript
   // types/next-auth.d.ts
   declare module "next-auth" {
     interface Session {
       user: {
         id: string;
         name?: string;
         email?: string;
         image?: string;
       };
     }
   }
   ```
3. **Test that session includes user.id in every API route**
   - Add a test that hits an API route and logs `session.user.id`
   - Verify it's not undefined
   - Don't skip this verification in production builds

**Warning signs:**
- API route uses `session.user.id` but it's always undefined
- Test shows "id is not defined" error in API route
- Manual testing of API works (hardcoded user_id), but multiple users conflict
- TypeScript build passes but runtime error occurs

**Phase to address:**
Phase 1 (User Accounts & Auth) — Auth.js setup. This must be correct from the start; it's the foundation for all multi-tenant queries.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store YNAB token unencrypted | Faster implementation, works in MVP | Database breach exposes all YNAB credentials; regulatory risk (GDPR) | Never — encryption is a first-class requirement |
| Hardcode user_id = 1 in background jobs | Works for single user, no context passing | Breaks immediately with second user; difficult to debug | Never — pass user_id as a job parameter |
| Skip webhook idempotency | Simpler webhook handler, no extra DB table | Postmark retries cause duplicate transactions; user confusion | Never — idempotency is required for correctness |
| Shared webhook secret for all users | One secret to configure | Any user can replay webhook for any other user; security issue | Never — use per-user secrets or embed user in payload |
| Nullable user_id in schema | Easier migration, allows NULL values | Orphaned records, hard to enforce invariants later | Only during Phase 1 migration; must make NOT NULL in Phase 2 |
| Test with single user only | Fast iteration, fewer test fixtures | Multi-tenant bugs only surface after deploy | Never — multi-user tests required from MVP |
| No row-level security (RLS) in database | Faster schema design, no SQL complexity | Mitigation of data leakage bugs is application-only; misses cases | Consider for MVP, but recommend for Phase 1 |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **YNAB OAuth** | Use Implicit Grant (no refresh tokens) → user must re-auth every 2 hours | Use Authorization Code Grant → supports refresh tokens → seamless user experience |
| **YNAB OAuth** | Store access token in browser / client-side | Refresh and store on server; never expose token to client |
| **YNAB API calls** | Check expiration in API error handler only → multiple requests fail with 401 | Pre-check expiration before making request → one refresh, all requests succeed |
| **Postmark inbound** | Single webhook URL for all users → must manually route by parsing email | Use MailboxHash to embed user context → webhook payload includes user ID |
| **Postmark inbound** | Trust webhook content without signature validation | Validate HMAC-SHA256 signature before processing |
| **Postmark inbound** | Process webhook, then return 200 → retries happen while processing | Return 200 immediately after signature validation → retries only if 5xx or timeout |
| **Auth.js** | Assume session.user includes all fields from database | Explicitly wire user.id through JWT and session callbacks |
| **Auth.js with DB** | Use JWT strategy for stateless sessions → can't revoke tokens | Use database strategy with Account table → can refresh and revoke |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **No index on user_id in main tables** | Queries slow down as data grows; activity log scan takes 10s | Add composite indexes: `CREATE INDEX idx_activity_user_created ON activity_log(user_id, created_at)` | 10K+ records per user |
| **Full-table scan for deduplication** | SELECT COUNT(*) FROM processed_webhooks WHERE message_id = ... gets slower over time | Use a hash/bloom filter for recent IDs; archive old IDs after 7 days | 100K+ webhooks total |
| **Refresh token refresh on every request** | High latency on API requests; YNAB rate limits | Check token expiration in client → refresh only if < 5 min remaining | 1K+ requests/day |
| **No pagination on activity log** | UI loads all 10K records at once → browser freezes | Paginate: fetch 50 at a time, lazy-load on scroll | 1K+ records per user |
| **Webhook handler parses full email body every time** | Email processing takes 10s; concurrent webhooks queue up | Parse once, store raw email, async process with Claude | 10+ emails/second |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Token in URL parameters or query strings** | Token appears in logs, browser history, referer headers | Always use POST body or Authorization header; never include tokens in URL |
| **Webhook secret in environment variable, shared globally** | Compromise of one user's webhook = compromise of all webhooks | Use per-user secrets; bind secret to user_id and MailboxHash |
| **No rate limiting on OAuth connect flow** | Attacker creates 1000 users, each connecting YNAB → quota exhausted | Rate limit by IP or authenticated user; YNAB OAuth request throttling |
| **Session cookie without HttpOnly flag** | XSS attack can steal token from JavaScript | `sameSite: "lax"`, `httpOnly: true`, `secure: true` in Auth.js cookie options |
| **User_id derived from email or name instead of database lookup** | User can spoof another user's identity by using their email | Always look up user by session.user.id from database |
| **No validation that inbound email address belongs to user** | User A forwards email to User B's address → processes under wrong account | Validate MailboxHash or webhook user_id against request context |
| **Token refresh succeeds but old token still used** | YNAB marks account as "refresh token abuse" → account locked | Verify token was updated in DB before using new token |
| **Audit logs don't include user_id** | Cannot trace which user caused an issue; regulatory compliance gap | Log user_id with every action (email processed, YNAB call, token refresh) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **User Accounts:** Auth.js is integrated, but `session.user.id` is undefined. Check that JWT and session callbacks include the user ID.
- [ ] **User Accounts:** Signup works, but user doesn't exist in the database. Check that a User record is created on first login (not just Auth.js credentials).
- [ ] **YNAB OAuth:** Token is stored, but encryption key is missing or wrong. Verify decryption of stored tokens works end-to-end.
- [ ] **YNAB OAuth:** Authorization Code flow works, but refresh tokens aren't being used. Check that expiration is checked and token is refreshed proactively.
- [ ] **YNAB OAuth:** Tokens stored, but no way to disconnect or revoke. Check that a "Disconnect YNAB" button exists and calls revocation endpoint + deletes token.
- [ ] **Inbound Email:** MailboxHash is added to email address, but webhook doesn't extract it. Check that webhook handler parses user ID from address or metadata.
- [ ] **Inbound Email:** Webhook is idempotent in code, but processed_webhook table doesn't exist. Check migration created the table with unique constraint on webhook_id.
- [ ] **Inbound Email:** Multiple users created, but activity logs show data from all users. Check that activity log queries include `WHERE user_id = ?`.
- [ ] **Database Migration:** user_id column added to tables, but existing data is NULL. Check that migration includes backfill step (`UPDATE ... SET user_id = ...`).
- [ ] **Background Jobs:** Token refresh job runs nightly, but doesn't handle multiple users. Check that job loops over all users or accepts user_id as parameter.
- [ ] **Webhook Security:** Webhook payload is processed, but signature isn't validated. Check that HMAC verification is done before trusting payload.
- [ ] **Testing:** Single-user tests pass, but multi-user tests fail. Check that test fixtures create two users and verify isolation.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Data leaked to wrong user (e.g., user A sees user B's activity)** | HIGH | 1) Stop the app immediately. 2) Identify scope (which queries/endpoints affected). 3) Notify affected users. 4) Audit logs to determine exposure. 5) Fix query with user_id filter. 6) Re-deploy. 7) Add RLS policies to prevent recurrence. |
| **Tokens exposed in logs** | MEDIUM | 1) Rotate all affected YNAB tokens (disconnect/reconnect YNAB). 2) Purge logs that contain tokens. 3) Review log retention policies. 4) Add token redaction to logging. 5) Brief users on any unauthorized YNAB activity. |
| **Token refresh race condition locks account** | MEDIUM | 1) Manual YNAB disconnect/reconnect via admin UI (force re-auth). 2) Implement refresh mutex. 3) Add monitoring to detect "too many refresh" errors. 4) Test concurrent refresh in CI. |
| **Webhook routed to wrong user** | HIGH | 1) Identify affected emails (via webhook ID). 2) Find which users received wrong transactions. 3) Revert transactions in YNAB (or mark as test). 4) Resend email to correct user. 5) Implement MailboxHash validation. 6) Add test with multiple users. |
| **Database migration failed, user_id is NULL** | MEDIUM | 1) Roll back migration. 2) Verify data integrity. 3) Re-write migration with explicit backfill + NOT NULL constraint. 4) Test against production backup. 5) Re-deploy. |
| **Background job processed all users instead of one** | LOW | 1) Identify which user_ids were incorrectly processed. 2) Revert side effects (duplicate deduplication entries, token refreshes). 3) Fix job to accept user_id parameter. 4) Re-run for correct user. |
| **Hardcoded user_id in code discovered** | LOW | 1) Search codebase for hardcoded user_id values. 2) Replace with session.user.id or parameter. 3) Add linter rule to catch string literals that look like IDs. 4) Deploy and test with multiple users. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Data leakage (missing user_id filters) | Phase 1 (User Accounts & Auth) | Multi-user test: user1 cannot see user2's activity via API |
| OAuth token security (encryption, refresh) | Phase 1 (User Accounts & Auth) + Phase 3 (Per-User OAuth) | Token is encrypted at rest; refresh works; token is revoked on disconnect |
| Concurrent refresh token exhaustion | Phase 1 (User Accounts & Auth) | Load test with 5+ concurrent requests with expired token; all succeed |
| Inbound email routing (MailboxHash, idempotency) | Phase 2 (Per-User Inbound Email) | Email routed to correct user; webhook retries don't create duplicates |
| Session context lost in jobs/webhooks | Phase 2 (Per-User Inbound Email) + Phase 3 (Per-User OAuth) | Background job logs show user_id; webhook handler includes user_id |
| Database migration data integrity | Phase 1 (User Accounts & Auth) | Migration backfills user_id; no NULL values after migration; rollback plan documented |
| Auth.js session user ID wiring | Phase 1 (User Accounts & Auth) | session.user.id is defined in API routes; TypeScript doesn't report as missing |

---

## Sources

- [2026 Tenant Isolation Guide: Risks, Solutions & Tips for SaaS](https://qrvey.com/blog/tenant-isolation/)
- [Multi‑tenant SaaS data isolation — Scaling Strategies — Practical Guide (Mar 23, 2026)](https://www.sachith.co.uk/multi%E2%80%91tenant-saas-data-isolation-scaling-strategies-practical-guide-mar-23-2026/)
- [Data Isolation in Multi-Tenant Software as a Service (SaaS): Architecture & Security Guide](https://redis.io/blog/data-isolation-multi-tenant-saas/)
- [Multi Tenant Security - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [Is it safe to store access token in next-auth session? · Issue #7976 · nextauthjs/next-auth](https://github.com/nextauthjs/next-auth/issues/7976)
- [Session Callback Not Populating User ID from JWT Token · nextauthjs/next-auth · Discussion #8456](https://github.com/nextauthjs/next-auth/discussions/8456)
- [Auth.js | Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation)
- [Postmark Inbound Email Processing](https://postmarkapp.com/inbound-email)
- [Webhook Security Best Practices: Signatures, Replay Protection, and Secret Rotation](https://hooque.io/guides/webhook-security/)
- [Webhooks at Scale: Designing an Idempotent, Replay-Safe, and Observable Webhook System](https://dev.to/art_light/webhooks-at-scale-designing-an-idempotent-replay-safe-and-observable-webhook-system-7lk)
- [Multi-Tenant Database Architecture Patterns Explained](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)
- [How to Implement Multi-Tenancy in Next.js: A Complete Guide](https://update.dev/blog/how-to-implement-multi-tenancy-in-next-js-a-complete-guide/)
- [Postmark vs. SendGrid: a Detailed Comparison for 2026](https://postmarkapp.com/compare/sendgrid-alternative)
- [Hardening OAuth Tokens in API Security](https://www.clutchevents.co/resources/hardening-oauth-tokens-in-api-security-token-expiry-rotation-and-revocation-best-practices)

---

*Pitfalls research for: Multi-tenant SaaS conversion (single-user → multi-user Next.js + PostgreSQL automation)*
*Researched: 2026-03-28*
