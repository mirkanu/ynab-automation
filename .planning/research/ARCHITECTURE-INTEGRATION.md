# Architecture Integration Research: Multi-Tenant SaaS

**Project:** Amazon to YNAB Automation (v5.0)
**Researched:** 2026-03-28
**Confidence:** HIGH (Auth.js v5 official docs, Prisma, Next.js guides, PostgreSQL standards)

## Executive Summary

The path from single-user automation to multi-tenant SaaS requires integrating four components: (1) Auth.js for user authentication and session management, (2) per-user YNAB OAuth token storage (encrypted AES-256), (3) Postmark inbound email routing, and (4) extending the database with `user_id` scoping. The existing architecture is exceptionally well-suited for this transition—the PostgreSQL schema is simple, API routes can easily extract user context, and the shared database pattern avoids the operational burden of per-tenant databases.

**Critical finding:** This is not a rewrite. The email processing logic, YNAB API calls, activity logging, and admin UI all continue to work; they're only wrapped with tenant context (`user_id` extraction from session, token decryption, query filtering). The existing single user becomes user #1 during backfill, and the system runs both old and new auth pathways simultaneously during deployment—enabling zero-downtime cutover.

**Why this matters for roadmap:** Build order is strict. Auth must be first (everything downstream depends on `user_id`), YNAB OAuth second (email processing needs the token), Postmark third (inbound routing depends on forwarding_email), and dashboards last. Skipping or reordering causes rework.

## How Auth.js, YNAB OAuth, Postmark, and Multi-Tenant DB Integrate

### 1. User Signup → Session Created (Auth.js)

```
User clicks "Sign Up" → Auth.js route /auth/signin
  ↓
User enters email → Resend sends magic link
  ↓
User clicks link → /auth/callback
  ↓
Auth.js creates Session in DB (session row includes user_id)
  ↓
Session cookie set: __Secure-authjs.session-token={encrypted}; HttpOnly; Secure
  ↓
User authenticated; session.user.id available in all route handlers
```

**Database tables involved:**
- `User` (new) — stores email, name, forwarding_email, oauth_token, oauth_refresh_token
- `Session` (Auth.js) — stores sessionToken, userId, expires, user_id
- `VerificationToken` (Auth.js) — temporary tokens for magic link verification

### 2. Authenticated User Connects YNAB → Token Encrypted & Stored

```
User visits /dashboard/connect-ynab → Click "Connect YNAB"
  ↓
Browser redirects to YNAB OAuth endpoint (/api/ynab/authorize)
  ↓
/api/ynab/authorize extracts session.user.id, redirects to YNAB login
  ↓
User logs in at YNAB → YNAB redirects back to /api/ynab/callback?code=...
  ↓
/api/ynab/callback receives code
  ↓
Server exchanges code for access_token + refresh_token (never touches browser)
  ↓
Tokens encrypted using AES-256-GCM (key from env ENCRYPTION_KEY)
  ↓
UPDATE User SET oauth_token = encrypted(...), oauth_refresh_token = encrypted(...) WHERE id = session.user.id
  ↓
/dashboard updates UI: "YNAB connected ✓"
  ↓
Forwarding email assigned: "user@ynab-automation.railway.app"
```

**Why encrypted storage matters:** If database is breached, attacker doesn't get raw YNAB tokens; they get ciphertext that's useless without the encryption key (stored separately in env vars, rotated quarterly).

**Why server-side code exchange matters:** Client never sees YNAB client secret; token never exposed to browser (XSS-proof).

### 3. Forwarding Email Arrives → Routed to User's Webhook → Token Decrypted

```
User forwards Amazon receipt to: user_123@ynab-automation.railway.app
  ↓
Email arrives at Postmark → Matches route rule "*@ynab-automation.railway.app"
  ↓
Postmark POSTs to /api/email/inbound with parsed email + signature
  ↓
Handler verifies signature using POSTMARK_WEBHOOK_TOKEN (HMAC-SHA256)
  ↓
Handler extracts "To" field: user_123@ynab-automation.railway.app
  ↓
Database query: SELECT * FROM User WHERE forwarding_email = 'user_123@ynab-automation.railway.app'
  ↓
Found: User { id: 'user_123', oauth_token: '<encrypted>', oauth_refresh_token: '<encrypted>', ... }
  ↓
Decrypt oauth_token using ENCRYPTION_KEY + IV extracted from ciphertext
  ↓
Call Claude API: Parse email → detect retailer, amount, category
  ↓
Call YNAB API with decrypted token: Create transaction
  ↓
INSERT INTO ActivityLog (user_id, status, parsed_retailer, ...) VALUES ('user_123', 'success', 'Amazon', ...)
  ↓
Email processing complete; user sees activity log updated within seconds
```

**Critical security check:** User_id extracted from database query (trusted source), not from email or request. No attacker can forge an email with another user's token.

### 4. API Routes Extract user_id → Filter Queries

```
User requests /api/dashboard (authenticated)
  ↓
Route handler: const session = await auth()
  ↓
Verify session.user.id exists; return 401 if not
  ↓
Database query:
   SELECT * FROM ActivityLog WHERE user_id = session.user.id ORDER BY createdAt DESC
  ↓
Return activity log for that user only
```

**Pattern applied to all routes:**
- `/api/dashboard` — user's activity log (user_id filter)
- `/api/settings` — user's settings (user_id filter)
- `/api/settings/{key}` — user's single setting (user_id + key filter)
- `/api/email/inbound` — webhook queries user by forwarding_email (no session; webhook auth only)

**Design principle:** Every WHERE clause must include user_id. Missing a WHERE clause = data leak.

## Database Schema Changes (Migration Strategy)

### New Tables

```sql
CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  email TEXT UNIQUE NOT NULL,
  emailVerified TIMESTAMP WITH TIME ZONE,
  name TEXT,
  image TEXT,

  -- YNAB OAuth (encrypted at rest)
  oauth_token TEXT,  -- Encrypted: iv.authTag.ciphertext
  oauth_refresh_token TEXT,  -- Encrypted: iv.authTag.ciphertext
  oauth_expires_at BIGINT,  -- Unix ms; tells us when to refresh

  -- Forwarding email (unique; enables lookup in webhook handler)
  forwarding_email TEXT UNIQUE NOT NULL,

  -- Per-user config (migrated from env vars)
  senders JSONB DEFAULT NULL,  -- Allowed senders per user
  currency_accounts JSONB DEFAULT NULL,  -- Account routing per currency

  -- Billing (ready for future Stripe)
  plan TEXT DEFAULT 'free',

  -- Timestamps
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  UNIQUE (email),
  UNIQUE (forwarding_email),
  INDEX (createdAt)
);

-- Auth.js: Session persistence (database-backed sessions)
CREATE TABLE "Session" (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  sessionToken TEXT UNIQUE NOT NULL,
  userId TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id TEXT NOT NULL,  -- Denormalized for WHERE user_id = ... queries

  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE,
  INDEX (sessionToken),
  INDEX (user_id),
  INDEX (expires)
);

-- Auth.js: OAuth account linkage (Google, etc.)
CREATE TABLE "Account" (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  userId TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'oauth'
  provider TEXT NOT NULL,  -- 'google', 'resend'
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,

  UNIQUE (provider, providerAccountId),
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  INDEX (userId)
);

-- Auth.js: Magic link verification tokens
CREATE TABLE "VerificationToken" (
  identifier TEXT NOT NULL,  -- Email address
  token TEXT NOT NULL,  -- Token to verify
  expires TIMESTAMP WITH TIME ZONE NOT NULL,

  UNIQUE (identifier, token),
  INDEX (token),
  INDEX (expires)
);
```

### Modified Tables

**ActivityLog** — Add user_id (NOT NULL after backfill):
```sql
ALTER TABLE "ActivityLog" ADD COLUMN user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE;

-- Create indexes for efficient user-scoped queries
CREATE INDEX idx_activitylog_user_id ON "ActivityLog"(user_id);
CREATE INDEX idx_activitylog_user_created ON "ActivityLog"(user_id, createdAt DESC);

-- After backfill (Phase 5):
ALTER TABLE "ActivityLog" ALTER COLUMN user_id SET NOT NULL;
```

**Setting** — Add user_id + create composite unique index:
```sql
ALTER TABLE "Setting" ADD COLUMN user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE;

-- Ensure (user_id, key) is unique per user
CREATE UNIQUE INDEX idx_setting_user_key ON "Setting"(user_id, key);

-- After backfill:
ALTER TABLE "Setting" ALTER COLUMN user_id SET NOT NULL;
```

### Migration Safety (No Downtime)

**Phase 1:** Add columns with NULL default; add new tables; deploy both old + new code
- Old code: Ignores user_id (null); works for admin user
- New code: Uses user_id; works for new users
- Both coexist during Phase 2–4

**Phase 5:** Backfill + make NOT NULL
- Create User row for existing user: `INSERT INTO User (id, email, ...) VALUES ('manuel', 'manuel@example.com', ...)`
- Backfill user_id: `UPDATE ActivityLog SET user_id = 'manuel' WHERE user_id IS NULL`
- Add NOT NULL constraint: `ALTER TABLE ActivityLog ALTER COLUMN user_id SET NOT NULL`
- Old code continues to work (routes to 'manuel')
- Cut over: Remove old admin auth; all routes now require Auth.js

## Build Order & Dependencies

```
Week 1: Phase 1 (Database + Auth Foundation)
├─ Create User, Session, Account, VerificationToken tables
├─ Add user_id (nullable) to ActivityLog, Setting
├─ Write encryption/decryption utilities (AES-256-GCM)
├─ Configure Auth.js (Resend provider, session strategy)
└─ Deliverable: New users can sign up via magic link/Google

Week 2: Phase 2 (User Authentication)
├─ Build /app/auth/signin page
├─ Build /app/dashboard (protected route)
├─ Migrate existing admin session to use Auth.js
├─ Test: Old admin still works + new auth works simultaneously
└─ Deliverable: Dual auth paths working; zero-downtime ready

Week 3: Phase 3a (YNAB OAuth)
├─ Build /api/ynab/authorize (redirects to YNAB)
├─ Build /api/ynab/callback (code exchange)
├─ Encrypt + store tokens in User table
├─ Assign forwarding_email on signup
├─ Test: Connect YNAB, verify token stored encrypted
└─ Deliverable: Users can connect YNAB; forwarding_email assigned

Week 4: Phase 3b (Postmark Inbound Setup)
├─ Configure Postmark account; MX + route rules
├─ Build /api/email/inbound webhook handler
├─ Verify Postmark signature (HMAC-SHA256)
├─ Query User by forwarding_email; decrypt token
├─ Modify processEmail to use per-user token
├─ Test: Forward sample email; verify YNAB transaction created
└─ Deliverable: Core feature works; scoped to user

Week 5: Phase 4 (Dashboards & Settings)
├─ Build /api/dashboard (activity log API, scoped to user)
├─ Build /api/settings (get/save settings per user)
├─ Build dashboard UI (activity, test mode, YNAB status)
├─ Build settings editor UI (SENDERS, CURRENCY_ACCOUNTS per user)
└─ Deliverable: Users can view activity, manage settings

Week 6–7: Phase 5 (Data Migration & Cut-Over)
├─ Create User#1 row for existing user
├─ Backfill user_id on ActivityLog, Setting
├─ Add NOT NULL constraints
├─ Test both old + new code paths simultaneously
├─ Deploy; monitor for errors
├─ Remove old admin auth; confirm all users on Auth.js
└─ Deliverable: Public beta launch; zero-downtime cutover complete

Total: 7 weeks
```

**Critical dependencies (can't skip):**
1. Database must be created before anything touches tables
2. Auth.js must work before YNAB OAuth (need session.user.id)
3. User table must exist before forwarding_email assignment (Phase 3)
4. Forwarding_email must exist before Postmark routing (Phase 4)
5. Email processing must work before dashboards (no data to display if email processing broken)
6. All code must be deployed before backfill (can't backfill without new code paths working)

## New Components & Modified Routes

### New Components (Add These)

| Route/Component | Purpose | Auth/Scope |
|-----------------|---------|-----------|
| `/api/auth/[...nextauth]` | Auth.js handlers (signin, callback, signout) | Public |
| `/app/auth/signin` | Login page (magic link + Google) | Public |
| `/app/dashboard` | User dashboard (activity, settings, YNAB status) | Authenticated (user_id from session) |
| `/api/ynab/authorize` | Start YNAB OAuth flow | Authenticated |
| `/api/ynab/callback` | Exchange code for token; store encrypted | Public (YNAB redirect) |
| `/api/email/inbound` | Postmark webhook handler | Public (signature-verified) |
| `/api/dashboard` | Activity log API | Authenticated (user_id from session) |
| `/api/settings` | Get/save user settings | Authenticated (user_id from session) |
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt | Utility |
| `lib/ynab.ts` | YNAB client with auto-refresh | Utility |
| `lib/auth-utils.ts` | Reusable session extraction + validation | Utility |
| `lib/postmark.ts` | Signature verification | Utility |

### Modified Routes (Change These)

| Route | From | To |
|-------|------|-----|
| `/api/email/inbound` | Pipedream webhook (global config, hardcoded YNAB token) | Postmark webhook (scoped to user by forwarding_email) |
| Admin auth | iron-session (cookie-based, single user) | Auth.js (database sessions, multi-user) |
| `/api/admin/dashboard` | Returns all activity | **Removed:** Replaced with `/api/dashboard` (scoped to user) |
| `/api/admin/settings` | Returns all settings | **Removed:** Replaced with `/api/settings` (scoped to user) |

### Removed Components (Delete These)

- `/api/admin/*` endpoints (replaced with user-scoped equivalents)
- `iron-session` configuration (replaced with Auth.js)
- `SENDERS` and `CURRENCY_ACCOUNTS` env var parsing (replaced with `User.senders`, `User.currency_accounts` DB columns)

## API Route Pattern (Copy & Paste)

### Safe Tenant Isolation (Use This Pattern)

```typescript
// lib/auth-utils.ts
export async function requireAuth(request: NextRequest) {
  const session = await auth();
  const user_id = session?.user?.id;

  if (!user_id) {
    return {
      user: null,
      error: new Response('Unauthorized', { status: 401 }),
    };
  }

  return { user: session.user, error: null };
}

// api/dashboard/route.ts
import { requireAuth } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  // Query with REQUIRED user_id filter
  const logs = await db.activityLog.findMany({
    where: { user_id: user.id }, // ← CRITICAL: Always include
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ logs });
}

// api/email/inbound/route.ts (No session; webhook auth instead)
export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify Postmark signature (NOT user session)
  if (!verifyPostmarkSignature(request, body)) {
    return new Response('Forbidden', { status: 403 });
  }

  const email = JSON.parse(body);
  const { To } = email;

  // Find user by forwarding email (not from request; from DB)
  const user = await db.user.findUnique({
    where: { forwarding_email: To },
    select: { id, oauth_token, oauth_refresh_token, ... },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'Forwarding email not found' },
      { status: 404 }
    );
  }

  // Process email scoped to this user
  const token = decryptToken(user.oauth_token);
  const result = await processEmail({
    user_id: user.id,
    oauth_token: token,
    email_from: email.From,
    email_body: email.TextBody || email.HtmlBody,
  });

  return NextResponse.json(result);
}
```

## Security Considerations

| Concern | Solution | Validation |
|---------|----------|-----------|
| **OAuth tokens in database** | AES-256-GCM encryption; key in env vars | Verify ciphertext != plaintext in DB |
| **User accessing another's data** | Always extract user_id from verified session; never trust client | Verify all WHERE clauses include user_id |
| **Webhook forging** | HMAC-SHA256 signature verification | Verify signature before processing any email |
| **Token leakage in logs** | Never log plaintext tokens; only log "token_present" or hash | Review logs for plaintext oauth_token |
| **Session hijacking** | HttpOnly, Secure, SameSite cookies; short expiration | Test with browser dev tools; verify flags set |
| **YNAB secret exposed** | Never send YNAB client_secret to browser; code exchange server-side | Verify /api/ynab/callback performs exchange, not client |

## Backward Compatibility During Migration

**Timeline:**
1. **Week 1–4:** Existing admin auth works; new Auth.js routes added alongside
2. **Week 5:** Both auth systems active; users can access via either path
3. **Week 5 end:** Data backfilled; add NOT NULL constraints
4. **Week 6:** Remove old admin auth; all routes now require Auth.js
5. **Cut-over:** Single user (Manuel) seamlessly migrated to user_id='manuel'

**Risk mitigation:**
- Run both code paths simultaneously (don't fork main branch)
- Backfill in safe window (low traffic)
- Have rollback plan (restore from backup if needed)
- Monitor 24 hours post-cutover for errors

## Confidence & Gaps

| Area | Confidence | Notes |
|------|------------|-------|
| **Auth.js integration** | HIGH | Official Next.js docs; v5 stable; patterns proven |
| **Token encryption** | HIGH | AES-256-GCM is NIST standard; Node.js crypto well-documented |
| **Postmark routing** | MEDIUM-HIGH | Works at scale; untested with volume; Phase 4 should load test |
| **YNAB refresh tokens** | MEDIUM | OAuth spec standard; YNAB's specific behavior needs validation in Phase 3 |
| **Multi-user at scale** | MEDIUM | Works fine at 100–1K users; PostgreSQL connection pooling needed at 10K+ |

### Gaps Requiring Phase-Specific Research

1. **YNAB rate limits (Phase 3):** Confirm how rate limiting works across multiple users; does YNAB limit per token or per IP?
2. **Postmark throughput (Phase 4):** Load test webhook handler with 100s of concurrent emails
3. **PostgreSQL connection pool (Phase 5):** Monitor connection usage; may need PgBouncer if pool exhausted
4. **Email processing concurrency (Phase 4):** Current sync handler may be bottleneck; Phase 4 should profile and potentially add job queue (Bull, Inngest)

---

## Roadmap Implications

### Phase Sequencing (Strict Order Required)

```
Phase 1 (Database + Auth)
  ↓ Produces: session.user.id
Phase 2 (User Auth UI)
  ↓ Produces: Users can log in
Phase 3 (YNAB OAuth)
  ↓ Produces: Encrypted tokens, forwarding_email assignment
Phase 4 (Postmark Inbound)
  ↓ Produces: Email → YNAB transaction (scoped)
Phase 5 (Dashboards + Migration)
  ↓ Produces: Public beta launch
```

Cannot be reordered without rework. Cannot skip phases.

### Effort Estimates

| Phase | Weeks | Effort | Risk |
|-------|-------|--------|------|
| 1 (Database + Auth) | 1.5 | MEDIUM (migrations, Auth.js config) | LOW (proven patterns) |
| 2 (User Auth UI) | 1 | LOW (standard Next.js pages) | LOW |
| 3 (YNAB OAuth) | 1 | MEDIUM (encryption, token refresh) | MEDIUM (new integration) |
| 4 (Postmark) | 1.5 | MEDIUM (webhook, routing, testing) | MEDIUM (new email provider) |
| 5 (Dashboards + Migration) | 2 | MEDIUM (data backfill, testing) | MEDIUM (cutover risk) |
| **Total** | **7 weeks** | | |

### Team Allocation

- **Database**: 1 person, Weeks 1–2, 5 (migrations, backfill planning)
- **Backend**: 1–2 people, Weeks 1–5 (API routes, Auth.js, YNAB/Postmark integration)
- **Frontend**: 1 person, Weeks 2, 5 (Auth UI, Dashboard, Settings)
- **Testing**: 1 person, Weeks 3–5 (Postmark load testing, migration validation, security review)

---

## Sources

- [Auth.js Documentation](https://authjs.dev/)
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant)
- [PostgreSQL Multi-Tenancy Patterns](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy)
- [Node.js OAuth Token Storage Best Practices](https://www.authgear.com/post/nodejs-security-best-practices)
- [Postmark Inbound Email](https://postmarkapp.com/)
- [Next.js Webhooks Best Practices](https://makerkit.dev/blog/tutorials/nextjs-api-best-practices)
