# Architecture: Multi-Tenant SaaS Integration

**Project:** Amazon to YNAB Automation (v5.0 Multi-Tenant)
**Researched:** 2026-03-28
**Confidence:** HIGH (multiple sources, patterns validated with Auth.js v5, Prisma, Next.js official docs)

## Executive Summary

Migrating from single-user automation to multi-tenant SaaS requires integrating Auth.js for user authentication, extending the database schema with `user_id` on all tables, refactoring API routes to enforce tenant isolation, replacing Pipedream webhooks with Postmark/SendGrid inbound email, and storing encrypted YNAB OAuth tokens per user. The existing architecture is well-suited for this transition: the current PostgreSQL schema is simple (no complex foreign keys), API routes can easily extract user context, and the shared database with `user_id` scoping avoids operational complexity of per-tenant databases. Migration is non-breaking — existing admin routes continue to work, new auth layers gate access, and the single current user becomes user#1 during deployment.

## Recommended Architecture

### High-Level Data Flow

```
User Signup/Login (Auth.js)
  ↓
Session Created (user_id stored)
  ↓
API Routes (Extract user_id from session)
  ↓
Database Queries (Filtered by user_id via middleware)
  ↓
Postmark/SendGrid Inbound Email
  ↓
Email Route Handler (/api/email/inbound)
  ↓
Query DB for User by forwarding address
  ↓
Load User's YNAB OAuth Token (Decrypt AES-256)
  ↓
Process Transaction (scoped to that user)
  ↓
Activity Log Entry (user_id attached)
```

### Component Boundaries

| Component | Responsibility | Integration Points |
|-----------|---------------|-------------------|
| **Auth.js** | User signup, login (magic links + Google OAuth), session management | Session stored in DB; `/auth/signin`, `/auth/callback` routes |
| **User & Session Tables** | Store users, email addresses, hashed passwords, OAuth tokens (encrypted); session persistence | Auth.js reads/writes; API middleware reads session_id from cookie |
| **Tenant-Scoped Tables** | ActivityLog, Settings, etc. — all rows include `user_id` | API routes enforce `user_id` filter on every query |
| **YNAB OAuth Token Storage** | Encrypted `oauth_token` and `oauth_refresh_token` fields on User row | Decrypted on-demand for YNAB API calls; never exposed to client |
| **Postmark Inbound** | Routes incoming forwarded emails to webhook; validates signature | `/api/email/inbound` route decodes webhook, queries DB by to_address |
| **Email Parsing & YNAB** | Claude API call to parse email, YNAB API call to create transaction | Existing logic unchanged; scoped to authenticated user's YNAB account |
| **Activity Log** | End-to-end tracing of email → parsing → YNAB; human-readable details | Logged on every transaction attempt; user_id required on insert |
| **Settings/Dashboard** | Per-user configuration, activity view, test mode toggle | Admin routes redesigned as user-scoped; Settings table includes user_id |

### Session & Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Auth.js Configuration (auth.ts)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Session strategy: DATABASE (stateful, allows server-side token management) │
│ • Providers: Resend (magic links) + Google OAuth                             │
│ • Session callback: Extend session with user_id, oauth_token presence check  │
│ • Callbacks: Add user_id to token; load user from DB in session callback     │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
    User Signs In via Magic Link or Google
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ /auth/signin → /auth/callback → Session Created in sessions table            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Session row: { sessionToken, userId, expires, user_id }                      │
│ Cookie: __Secure-authjs.session-token={encrypted}; HttpOnly; Secure; SameSite│
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
    Authenticated User Requests /api/dashboard
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Auth Middleware (auth() from Auth.js)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Decrypts session token from cookie                                          │
│ • Queries sessions table by token                                             │
│ • Hydrates User object (id, email, oauth_token, oauth_refresh_token)         │
│ • Passes { session: { user: { id, email, ... } } } to route handler          │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
    Route Handler Enforces user_id Filter
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ /api/dashboard → Route Handler                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ const session = await auth();                                                 │
│ const userId = session?.user?.id;                                             │
│ if (!userId) return 401;                                                      │
│                                                                                │
│ const activityLog = await db.activityLog.findMany({                           │
│   where: { user_id: userId },  ← CRITICAL: Always include user_id filter    │
│ });                                                                            │
│                                                                                │
│ return NextResponse.json({ activityLog });                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

#### New Tables

```sql
-- Users (replaces single-user config)
CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  emailVerified TIMESTAMP WITH TIME ZONE,
  image TEXT,

  -- YNAB OAuth (encrypted at rest)
  oauth_token TEXT,  -- AES-256-GCM encrypted
  oauth_refresh_token TEXT,  -- AES-256-GCM encrypted
  oauth_expires_at BIGINT,  -- Unix timestamp (ms)

  -- Forwarding email
  forwarding_email TEXT UNIQUE,  -- user@ynab-automation.railway.app

  -- Config (migrated from env)
  senders JSONB,  -- {"allowed_senders": [{"email": "...", "name": "..."}]}
  currency_accounts JSONB,  -- {"USD": "account_id", "EUR": "..."}

  -- Billing (ready for future Stripe)
  plan TEXT DEFAULT 'free',

  -- Audit
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (forwarding_email)  -- Enable lookup by to_address
);

-- Auth.js Session Management
CREATE TABLE "Session" (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  sessionToken TEXT UNIQUE NOT NULL,
  userId TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id TEXT NOT NULL,  -- Denormalized for queries

  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE,
  INDEX (sessionToken),
  INDEX (user_id),
  INDEX (expires)
);

-- Auth.js Account Linkage (Google OAuth, etc.)
CREATE TABLE "Account" (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  userId TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'oauth', 'email', etc.
  provider TEXT NOT NULL,  -- 'google', 'resend', etc.
  providerAccountId TEXT NOT NULL,

  UNIQUE (provider, providerAccountId),
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  INDEX (userId)
);

-- Auth.js Verification Tokens (magic links)
CREATE TABLE "VerificationToken" (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,

  UNIQUE (identifier, token),
  INDEX (token),
  INDEX (expires)
);
```

#### Modified Tables (Add user_id)

```sql
-- ActivityLog
ALTER TABLE "ActivityLog"
  ADD COLUMN user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE;

CREATE INDEX idx_activitylog_user_id ON "ActivityLog"(user_id);
CREATE INDEX idx_activitylog_user_created ON "ActivityLog"(user_id, createdAt DESC);

-- Settings
ALTER TABLE "Setting"
  ADD COLUMN user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX idx_setting_user_key ON "Setting"(user_id, key);

-- Add NOT NULL constraint after backfilling
ALTER TABLE "ActivityLog" ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE "Setting" ALTER COLUMN user_id SET NOT NULL;
```

#### Migration Strategy (Non-Breaking)

1. **Phase 1 (Additive):** Add `user_id` column with `NULL` default; add Auth.js tables
2. **Phase 2 (Backfill):** Create initial User row (id='manuel'), backfill existing ActivityLog/Settings rows with user_id='manuel'
3. **Phase 3 (Constraint):** Add NOT NULL constraints; add unique indexes
4. **Phase 4 (Cleanup):** Remove old env var config readers; migrate to User table config

This allows running old and new code simultaneously during deployment.

### API Route Structure (Tenant Isolation)

#### Pattern: Middleware → Extract user_id → Filter Queries

```typescript
// lib/auth-utils.ts - Reusable auth check
export async function requireAuth(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return { user: null, error: new Response('Unauthorized', { status: 401 }) };
  }
  return { user: session.user, error: null };
}

// api/dashboard/route.ts - Dashboard (scoped to current user)
import { requireAuth } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  // Query only this user's activity log
  const logs = await db.activityLog.findMany({
    where: { user_id: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ logs });
}

// api/settings/route.ts - User settings (scoped to current user)
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const settings = await db.setting.findMany({
    where: { user_id: user.id },
  });

  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const { key, value } = await request.json();

  // Upsert with user_id constraint
  const updated = await db.setting.upsert({
    where: { user_id_key: { user_id: user.id, key } },
    update: { value },
    create: { user_id: user.id, key, value },
  });

  return NextResponse.json({ updated });
}

// api/email/inbound/route.ts - Postmark webhook (query user by email address)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Verify Postmark signature (security)
  const isValid = verifyPostmarkSignature(request, body);
  if (!isValid) return new Response('Unauthorized', { status: 401 });

  const { To, From, Subject, TextBody, HtmlBody } = body;

  // Find user by forwarding email (not authenticated user, but verified webhook)
  const user = await db.user.findUnique({
    where: { forwarding_email: To },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Process email scoped to this user
  const transaction = await processEmail({
    user_id: user.id,
    oauth_token: decryptToken(user.oauth_token),
    from: From,
    to: To,
    subject: Subject,
    body: TextBody || HtmlBody,
  });

  return NextResponse.json({ transaction });
}
```

## Data Flow: Email → YNAB

### Step 1: User Receives Forwarding Address

1. After login and YNAB OAuth, user is assigned unique forwarding email: `{user.id}@ynab-automation.railway.app`
2. Stored in `User.forwarding_email` column
3. User is shown this address and instructed to forward receipts

### Step 2: Email Arrives at Postmark

1. User forwards order confirmation to their address
2. Postmark receives email; finds route rule matching `*@ynab-automation.railway.app`
3. Postmark calls webhook: `POST https://app.railway.app/api/email/inbound` with parsed email data
4. Includes `X-Postmark-Signature` header (webhook verification)

### Step 3: Route Handler Queries User & Decrypts Token

```
/api/email/inbound
  ↓
1. Verify Postmark signature (secure)
2. Extract "To" field (forwarding_email)
3. Query: SELECT * FROM User WHERE forwarding_email = 'xxx@ynab-automation.railway.app'
4. Found: User { id: 'user_123', oauth_token: '<encrypted>', ... }
5. Decrypt oauth_token using AES-256-GCM
6. Extract YNAB access token + refresh token
```

### Step 4: Process Email & Create Transaction

```
processEmail(user_id, oauth_token, email)
  ↓
1. Call Claude API to parse email
   - Detect retailer, amount, currency, category hints
2. Call YNAB API to get user's accounts & categories
3. Route to correct account (based on currency if configured)
4. Create transaction in YNAB
5. Log success/failure in ActivityLog with user_id
6. If error: send email alert via Resend
```

### Step 5: Activity Log Entry (User-Scoped)

```sql
INSERT INTO "ActivityLog" (
  user_id,
  status,
  email_from,
  email_to,
  parsed_retailer,
  parsed_amount,
  parsed_currency,
  ynab_account_name,
  ynab_transaction_id,
  error_message,
  createdAt
) VALUES (
  'user_123',
  'success',
  'amazon@amazon.com',
  'user_123@ynab-automation.railway.app',
  'Amazon',
  '42.50',
  'USD',
  'Chase Amazon Card',
  'txn_abc123',
  NULL,
  NOW()
);
```

## YNAB OAuth Integration

### Token Storage (Encrypted)

```typescript
// lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes for AES-256

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv.authTag.ciphertext
  return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, ciphertext] = encrypted.split('.');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Connect YNAB OAuth (User's Account Page)

```typescript
// app/dashboard/connect-ynab/page.tsx - OAuth flow (client-side token exchange NOT used)

// Option 1: Server-side OAuth (RECOMMENDED)
// After /api/ynab/authorize redirect returns with code:
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const { code } = await request.json();

  // Exchange code for token (server-side)
  const tokenResponse = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.YNAB_CLIENT_ID!,
      client_secret: process.env.YNAB_CLIENT_SECRET!, // Secret stays on server
      code,
      grant_type: 'authorization_code',
    }),
  });

  const { access_token, refresh_token, expires_in } = await tokenResponse.json();

  // Store encrypted in User table
  await db.user.update({
    where: { id: session.user.id },
    data: {
      oauth_token: encryptToken(access_token),
      oauth_refresh_token: encryptToken(refresh_token),
      oauth_expires_at: Date.now() + expires_in * 1000,
    },
  });

  return NextResponse.json({ success: true });
}
```

### Token Refresh (On-Demand)

```typescript
// lib/ynab.ts - YNAB client with auto-refresh

async function getValidToken(user_id: string) {
  const user = await db.user.findUnique({
    where: { id: user_id },
    select: { oauth_token, oauth_refresh_token, oauth_expires_at },
  });

  if (!user || !user.oauth_token) {
    throw new Error('No YNAB token stored');
  }

  // Check if expired
  if (Date.now() > user.oauth_expires_at) {
    // Refresh
    const newToken = await refreshYNABToken(
      decryptToken(user.oauth_refresh_token)
    );

    // Update DB
    await db.user.update({
      where: { id: user_id },
      data: {
        oauth_token: encryptToken(newToken.access_token),
        oauth_refresh_token: encryptToken(newToken.refresh_token),
        oauth_expires_at: Date.now() + newToken.expires_in * 1000,
      },
    });

    return newToken.access_token;
  }

  return decryptToken(user.oauth_token);
}

export async function createYNABTransaction(user_id: string, data: TransactionData) {
  const token = await getValidToken(user_id);

  return fetch('https://api.ynab.com/v1/budgets/...',  {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  }).then(r => r.json());
}
```

## Postmark Inbound Email Setup

### DNS Configuration

```
MX Record:
  ynab-automation.railway.app  MX  10  inbound.postmarkapp.com

SPF Record:
  v=spf1 include:postmarkapp.com ~all

DKIM Record:
  (Generated by Postmark; add TXT record)
```

### Postmark Inbound Route Rule

```
Route: *@ynab-automation.railway.app
Webhook URL: https://app.railway.app/api/email/inbound
HTTP Headers: X-Postmark-Signature (verify with POSTMARK_WEBHOOK_TOKEN)
```

### Webhook Verification (Security Critical)

```typescript
// lib/postmark.ts

export function verifyPostmarkSignature(
  request: NextRequest,
  body: Buffer | string
): boolean {
  const signature = request.headers.get('X-Postmark-Signature');
  if (!signature) return false;

  const crypto = require('crypto');
  const webhookToken = process.env.POSTMARK_WEBHOOK_TOKEN!;

  const hash = crypto
    .createHmac('sha256', webhookToken)
    .update(body)
    .digest('base64');

  return crypto.timingSafeEqual(hash, signature);
}
```

## Patterns to Follow

### Pattern 1: Always Extract user_id from Session

**What:** Every API route handler retrieves the authenticated user's ID from the session before querying the database.

**When:** Every route that accesses user-scoped data (dashboard, settings, activity log, etc.)

**Example:**
```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  const user_id = session?.user?.id;

  if (!user_id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Now safe to query with where: { user_id }
  const data = await db.myTable.findMany({ where: { user_id } });
  return NextResponse.json(data);
}
```

### Pattern 2: Always Include user_id in WHERE Clauses

**What:** Every database query that touches user-scoped tables includes `user_id` in the WHERE clause.

**Why:** Single missing WHERE clause can leak another user's data.

**Good:**
```typescript
const logs = await db.activityLog.findMany({
  where: { user_id }, // Required
});
```

**Bad (DON'T DO):**
```typescript
const logs = await db.activityLog.findMany({}); // Exposes all users' logs
```

### Pattern 3: Decrypt YNAB Token On-Demand

**What:** YNAB OAuth tokens are stored encrypted in the User table and decrypted only when needed.

**When:** Before calling YNAB API.

**Why:** Tokens are never exposed to the client; encryption at rest protects against database breaches.

**Example:**
```typescript
const token = decryptToken(user.oauth_token);
const response = await fetch('https://api.ynab.com/...', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Pattern 4: Webhook Verification Before Processing

**What:** Postmark webhook signature is verified before processing any email.

**Why:** Prevents forged emails from being processed.

**Example:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.text();

  if (!verifyPostmarkSignature(request, body)) {
    return new Response('Forbidden', { status: 403 });
  }

  const email = JSON.parse(body);
  // Safe to process
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Assuming Authenticated User from Middleware Alone

**What:** Relying only on middleware auth checks; not re-validating in route handlers.

**Why Bad:** Middleware can be misconfigured; next requests are processed before middleware finishes; an unauthenticated request might still reach the handler.

**Instead:** Always call `const session = await auth()` at the start of each route handler and check `session?.user?.id`.

```typescript
// BAD: Middleware alone
// middleware.ts
export function middleware(request) {
  if (!request.headers.get('auth-token')) return redirect('/login');
}

// routes/api/dashboard/route.ts
export async function GET(request) {
  // DANGER: Middleware didn't run; could be unauthenticated
  const userId = extractUserIdFromRequest(request); // WRONG
}

// GOOD: Explicit auth in handler
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  // Now safe
}
```

### Anti-Pattern 2: Storing Plain-Text OAuth Tokens

**What:** Storing YNAB tokens without encryption.

**Why Bad:** Database breach exposes all users' YNAB accounts.

**Instead:** Encrypt tokens using AES-256-GCM with a secure, rotated key stored in environment variables.

### Anti-Pattern 3: Omitting user_id from Composite Indexes

**What:** Creating an index on a column without including user_id for scoped queries.

**Why Bad:** Queries can't efficiently filter by both user_id and the other column.

**Instead:**
```sql
-- BAD
CREATE INDEX idx_activitylog_status ON ActivityLog(status);

-- GOOD
CREATE INDEX idx_activitylog_user_status ON ActivityLog(user_id, status);
```

### Anti-Pattern 4: Trusting Frontend user_id

**What:** Accepting user_id from the client request (URL param, body, etc.).

**Why Bad:** Client can trivially modify it to access another user's data.

**Instead:**
```typescript
// BAD
const userId = request.nextUrl.searchParams.get('user_id'); // Attacker sets ?user_id=other

// GOOD
const session = await auth();
const userId = session.user.id; // Comes from verified session cookie
```

### Anti-Pattern 5: Per-Tenant Databases Without Proven Need

**What:** Creating a separate database for each user (or small cohort).

**Why Bad:** Massively complicates migrations, monitoring, backups, and disaster recovery; doesn't scale below 10K+ users.

**Instead:** Use shared database with `user_id` scoping; add Row-Level Security (RLS) for defense in depth.

## Scalability Considerations

| Concern | At 100 Users | At 10K Users | At 100K+ Users |
|---------|--------------|--------------|----------------|
| **Database Size** | ~1 GB (activity logs) | ~100 GB | Sharding or partitioning by user_id |
| **Query Performance** | Simple; user_id + createdAt indexes sufficient | Ensure indexes on user_id, maintain query plans | Add partial indexes (e.g., last 30 days only) |
| **OAuth Token Refresh** | Batch refresh monthly | Refresh on-demand (cache locally in memory) | Background job to refresh before expiry |
| **Email Processing** | Synchronous in route handler | Add background job queue (Bull, Inngest) | Distributed workers with retry logic |
| **Postmark Webhook** | Single Railway instance | Single instance with auto-scaling | Multiple instances behind load balancer |
| **YNAB API Rate Limits** | 200 requests/hour per token; safe | Implement token bucket or sliding window rate limiter | Multiple user pools or request prioritization |
| **Session Management** | Database session store; Railway DB fine | Database still fine; watch connection pool | Switch to Redis cache for session store |
| **Audit/Activity Log** | Full table scans acceptable | Query only recent 90 days; archive old entries | Separate activity log table sharded by user_id |

**Recommendation for v5.0:** Stay with shared database + PostgreSQL. Horizontal scaling (sharding by user_id) becomes relevant only at 10K+ concurrent users; not a v5.0 concern.

## New Components & Modified Routes

### New Components

| Component | Purpose | Tech Stack |
|-----------|---------|-----------|
| `/app/auth/signin` | Login page (magic link + Google OAuth) | Auth.js UI (no custom form; uses providers) |
| `/app/dashboard` | User dashboard (activity, settings, YNAB status) | Next.js App Router; Suspense + skeleton |
| `/app/dashboard/connect-ynab` | OAuth redirect page; exchange code for token | Server action or route handler |
| `/app/settings` | User preferences (SENDERS, CURRENCY_ACCOUNTS per-user) | Settings editor form; upsert to DB |
| `/api/auth/[...nextauth]` | Auth.js route handlers | Auth.js library |
| `/api/email/inbound` | Postmark webhook receiver | New route handler |
| `/api/dashboard` | Activity log API | JSON response scoped to user |
| `/api/settings` | Get/save user settings | GET/POST scoped to user |
| `/api/ynab/authorize` | Start OAuth flow | Redirect to YNAB login |
| `/api/ynab/callback` | OAuth callback (code exchange) | Exchange code; store encrypted token |
| `lib/encryption.ts` | AES-256-GCM encryption/decryption | Node.js crypto module |
| `lib/ynab.ts` | YNAB API client with token refresh | Fetch + automatic refresh |
| `lib/auth-utils.ts` | Reusable auth checks | Helper function |
| `lib/postmark.ts` | Postmark webhook verification | HMAC-SHA256 |
| `db/schema.prisma` | Database schema (if using Prisma) | Prisma ORM |

### Modified Routes

| Route | Changes |
|-------|---------|
| `/api/email/inbound` | **New:** Postmark webhook; query user by forwarding email; scoped processing |
| `/api/admin/dashboard` | **Removed:** Replace with `/api/dashboard` (user-scoped) |
| `/api/admin/settings` | **Removed:** Replace with `/api/settings` (user-scoped) |
| `/api/admin/activity` | **Removed:** Replace with activity log query in `/api/dashboard` |

### Removed Components

- `/api/admin/*` — Admin-only routes (replace with user-scoped endpoints)
- `iron-session` auth — Replace with Auth.js
- `SENDERS` and `CURRENCY_ACCOUNTS` env vars — Replace with User.senders, User.currency_accounts (DB-backed)

## Build Order (Dependency Graph)

```
Phase 1: Foundation (Database + Auth)
  ↓
  1a. Create User table (with oauth_token, forwarding_email fields)
  1b. Create Session, Account, VerificationToken tables (Auth.js)
  1c. Add user_id to ActivityLog, Setting tables
  1d. Write encryption/decryption utilities
  ↓
Phase 2: Authentication
  ↓
  2a. Install + configure Auth.js (Resend + Google OAuth)
  2b. Create /app/auth/signin page
  2c. Create /app/dashboard (basic layout; protected route)
  2d. Migrate existing admin session to Auth.js
  ↓
Phase 3: YNAB Integration
  ↓
  3a. YNAB OAuth flow: /api/ynab/authorize + /api/ynab/callback
  3b. Create User.forwarding_email on signup
  3c. Write lib/ynab.ts client with token refresh
  3d. Decrypt YNAB token in email processor
  ↓
Phase 4: Postmark Inbound
  ↓
  4a. Set up Postmark account; configure MX + route
  4b. Create /api/email/inbound webhook handler
  4c. Verify Postmark signature
  4d. Route to correct user by forwarding_email
  4e. Test with sample emails
  ↓
Phase 5: User Dashboards & Settings
  ↓
  5a. /api/dashboard — Activity log API (user-scoped)
  5b. /api/settings — Get/save settings per user
  5c. Dashboard UI (activity log, test mode toggle, YNAB status)
  5d. Settings editor UI (SENDERS, CURRENCY_ACCOUNTS)
  ↓
Phase 6: Data Migration
  ↓
  6a. Create User row for existing user (manuel)
  6b. Backfill user_id on ActivityLog, Setting rows
  6c. Test both old and new code paths simultaneously
  6d. Deploy with backward compatibility; cut over
```

## Integration with Existing Code

### Existing: Email Processing (Claude API)

**Current:** `/api/webhook` (Pipedream) → Claude API → YNAB API

**Change:** Minimal. The Claude API call and YNAB API call logic remains the same; only wrapped with:
- Extract user_id from session (or from User query by forwarding_email for webhooks)
- Decrypt YNAB token before calling YNAB API
- Log with user_id attached

```typescript
// BEFORE: lib/processor.ts
export async function processEmail(email: Email) {
  const parsed = await callClaude(email.body);
  const txn = await callYNAB(parsed, process.env.YNAB_TOKEN); // Hardcoded
  await logActivity({ status: 'success', ... });
}

// AFTER: lib/processor.ts
export async function processEmail(user_id: string, email: Email, ynab_token: string) {
  const parsed = await callClaude(email.body);
  const txn = await callYNAB(parsed, ynab_token); // Per-user token
  await logActivity({ user_id, status: 'success', ... }); // user_id attached
}
```

### Existing: Activity Log

**Current:** `ActivityLog` table; admin-only view at `/api/admin/dashboard`

**Change:** Add `user_id` column; expose scoped query at `/api/dashboard` for authenticated user.

```typescript
// BEFORE: /api/admin/dashboard
const logs = await db.activityLog.findMany({ take: 100 }); // All logs

// AFTER: /api/dashboard (user-scoped)
const logs = await db.activityLog.findMany({
  where: { user_id: session.user.id },
  take: 100,
});
```

### Existing: Settings Editor

**Current:** `Setting` table; admin-only at `/api/admin/settings`

**Change:** Add `user_id` column; scope to authenticated user.

```typescript
// BEFORE: /api/admin/settings
const setting = await db.setting.findUnique({ where: { key: 'SENDERS' } });

// AFTER: /api/settings (user-scoped)
const setting = await db.setting.findUnique({
  where: { user_id_key: { user_id: session.user.id, key: 'SENDERS' } },
});
```

### Existing: Admin UI

**Current:** iron-session auth; `/admin` routes

**Transition:**
1. Deploy new Auth.js routes alongside old admin routes
2. Users can log in via Auth.js
3. Old admin routes check for existing session; if found, redirect to `/dashboard`
4. After cut-over, remove `/admin` routes

### Existing: Config (SENDERS, CURRENCY_ACCOUNTS)

**Current:** Environment variables (global config)

**Future (v5.0):** User table columns `senders` (JSONB), `currency_accounts` (JSONB)

**Transition:**
1. Keep env vars for backward compatibility
2. User edit form allows setting per-account config
3. Route handlers check: `User.senders` first; fall back to env var
4. After migration complete, remove env var checks

## Migration Path: Single-User → Multi-Tenant

### Timeline

**Week 1: Database + Auth**
- Create User, Session, Account, VerificationToken tables
- Add user_id to ActivityLog, Setting
- Set up Auth.js; test signup/login

**Week 2: YNAB OAuth**
- Build YNAB OAuth flow
- Encrypt token storage; test refresh
- Assign forwarding_email on signup

**Week 3: Postmark Setup**
- Configure Postmark account + MX records
- Build `/api/email/inbound` webhook
- Test email routing

**Week 4: Dashboard & Settings**
- Build `/app/dashboard` (activity log)
- Build `/app/settings` (user config editor)
- User testing

**Week 5: Data Migration & Cut-Over**
- Create User row for existing user
- Backfill user_id on existing rows
- Deploy with both old + new code
- Test both paths
- Cut over (remove old admin auth)
- Announce v5.0 public beta

### Zero-Downtime Deployment Strategy

1. **Before:** Single-user admin; no Auth.js; no User table
2. **Deploy v1:** Add User, Session tables; add user_id (nullable) to ActivityLog, Setting; add Auth.js routes alongside admin
3. **Old code continues:** Admin session still works; email processing unchanged
4. **New code works:** Users can sign up via Auth.js; new users' activity is logged with user_id
5. **Data migration:** Create User#1 for existing data; backfill user_id
6. **Deploy v2:** Make user_id NOT NULL on ActivityLog, Setting; remove admin auth routes
7. **Cut-over complete:** All users now use Auth.js; old admin auth disabled

### Existing User (Manuel) Migration

1. Create User row: `{ id: 'manuel', email: 'manuel@...', oauth_token: encrypted(CURRENT_YNAB_TOKEN) }`
2. Backfill: `UPDATE ActivityLog SET user_id = 'manuel'`
3. Backfill: `UPDATE Setting SET user_id = 'manuel'`
4. Assign forwarding address: `UPDATE User SET forwarding_email = 'manuel@ynab-automation.railway.app'` where email matches
5. Test: Existing email processing continues to work (now scoped to user_id='manuel')

## Security Considerations

### Token Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 32 bytes; stored in `ENCRYPTION_KEY` env var; rotated every 90 days
- **IV:** Random 16 bytes per encryption; prepended to ciphertext
- **Auth Tag:** Ensures integrity; prevents tampering

### Session Security

- **Cookie:** HttpOnly, Secure, SameSite=Strict
- **Expiration:** 30 days; can be shortened to 1-7 days
- **Refresh:** Use refresh tokens (YNAB OAuth) on-demand

### Webhook Security

- **Signature Verification:** HMAC-SHA256 with Postmark webhook token
- **Rate Limiting:** Consider adding rate limit on `/api/email/inbound` to prevent abuse

### Data Retention

- **Raw Emails:** Don't store; process and discard
- **Activity Log:** Keep for 90 days; archive older entries
- **Account Deletion:** Hard delete User + associated ActivityLog, Settings (CASCADE)

## Sources

- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant)
- [Auth.js Session Strategies](https://authjs.dev/concepts/session-strategies)
- [Auth.js Resend Configuration](https://authjs.dev/guides/configuring-resend)
- [PostgreSQL Row Level Security (RLS)](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy)
- [Multi-Tenant Database Patterns](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)
- [Prisma Multi-Tenant Design](https://zenstack.dev/blog/multi-tenant)
- [Node.js OAuth Token Storage Best Practices](https://www.authgear.com/post/nodejs-security-best-practices)
- [Postmark Inbound Email Documentation](https://postmarkapp.com/support)
- [Next.js Route Handlers & Webhooks](https://makerkit.dev/blog/tutorials/nextjs-api-best-practices)
- [PostgreSQL Migrations for Multi-Tenancy](https://oneuptime.com/blog/post/2026-02-02-postgresql-database-migrations/)
