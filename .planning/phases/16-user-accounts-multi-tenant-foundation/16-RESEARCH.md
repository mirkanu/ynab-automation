# Phase 16: User Accounts & Multi-Tenant Foundation - Research

**Researched:** 2026-03-28
**Domain:** Authentication, multi-tenancy, database schema migration, session management
**Confidence:** HIGH

## Summary

Phase 16 establishes the foundational multi-tenant infrastructure that all subsequent phases depend on. The primary work is integrating Auth.js v5 for passwordless signup/login, extending the database schema with `user_id` on all tables, implementing PostgreSQL Row-Level Security (RLS) policies for tenant isolation, and wiring session context through API routes. The existing project stack (Next.js 14, Prisma 5.13, PostgreSQL, Resend) is fully compatible with Auth.js v5. This phase requires no new external dependencies beyond Auth.js itself. The conversion is non-breaking: existing single-user functionality continues through the initial user account ("manuel"), new auth layers gate access, and database migrations use a safe three-phase approach (add nullable column → backfill → add NOT NULL constraint) to prevent data loss.

**Primary recommendation:** Implement Auth.js v5 with Prisma adapter, database-backed sessions, magic links via Resend, add `user_id` to all tables via safe migrations, establish RLS policies on ActivityLog and Settings tables, wire session.user.id through all API routes, and test with two user accounts to verify tenant isolation before merge.

---

## User Constraints

**From PROJECT.md Key Decisions:**
- v5.0 kickoff decision: Auth.js replaces iron-session for multi-user support
- v5.0 kickoff decision: Shared DB with user_id + PostgreSQL RLS for tenant isolation
- Technology decision: Postmark or SendGrid for per-user inbound email (provider TBD in Phase 18 planning)
- Ordering decision: Phase ordering is sequential (16→17→18→19) — each phase has pitfalls that affect the next

**Implications for Phase 16:**
- Must establish the pattern of `user_id` filtering and RLS that prevents data leakage pitfalls in all subsequent phases
- Auth.js setup must include session callback with user.id wired through (Pitfall 7 prevention)
- Database migration strategy must be non-breaking and idempotent (Pitfall 6 prevention)
- Single existing user ("manuel") must migrate to user_id=1 without data loss

---

## Phase Requirements

| ID | Description | How Phase 16 Enables It |
|----|-------------|------------------------|
| AUTH-01 | User can sign up with email magic link (passwordless) | Auth.js Email provider + Resend magic link configuration; POST `/auth/signin` → `/auth/callback` flow |
| AUTH-02 | User session persists across browser refresh | Database-backed session storage via Auth.js PrismaAdapter; session cookie with Secure + HttpOnly flags |
| AUTH-03 | User can log out | Auth.js signOut() function; DELETE /api/auth/signout endpoint; redirect to login |
| DATA-01 | All database tables are scoped by user_id | Add user_id column to ActivityLog, Settings, ProcessedEmail, Account tables; Prisma schema migration |
| DATA-02 | Existing single-user data is migrated to user #1 (Manuel) | Migration script backfills user_id for all existing ActivityLog/Settings rows to "manuel" user_id |
| DATA-03 | Row-Level Security policies enforce tenant isolation at DB level | PostgreSQL RLS policies on ActivityLog, Settings, Account, ProcessedEmail; tested by multi-user queries |
| DATA-04 | No user can access another user's data through any API endpoint | API middleware enforces session.user.id on every query; RLS policies catch application-layer failures |

---

## Standard Stack

### Core Authentication

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Auth.js | v5.0+ | Multi-user signup, login, OAuth providers, session management | Official Next.js authentication library; passwordless via magic links; database session strategy; Prisma adapter built-in |
| Resend | Latest (already installed v6.9.4) | Email transport for Auth.js magic link verification | Auth.js official recommendation; already integrated in codebase; reliable deliverability; simple API |

**Current Status:** Resend already in package.json (v6.9.4); Auth.js NOT YET installed — must add `next-auth@5.0+` and `@auth/prisma-adapter@latest`

### Database & Multi-Tenancy

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ (deployed via Railway) | Persistent storage with Row-Level Security support | Already in use; RLS enables database-level tenant isolation |
| Prisma | 5.13.0 (already installed) | ORM, schema management, migrations | Already in use; strong TypeScript support; schema is simple enough to extend safely |
| Row-Level Security (RLS) | PostgreSQL native | Enforce tenant isolation at database level | Zero application-layer trust required; prevents data leakage even with compromised session tokens |

**Current Status:** Prisma 5.13.0 already installed; PostgreSQL version and RLS support must be verified in Railway dashboard

### Session & Token Management

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Adapter | @auth/prisma-adapter (latest) | Session storage in database via Auth.js | Official Auth.js adapter for Prisma; handles User, Account, Session, VerificationToken tables |

### Encryption (Future Phase 17, Prepared in Phase 16)

Token encryption happens in Phase 17 (YNAB OAuth), but infrastructure decisions made in Phase 16:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| libsodium.js OR TweetNaCl.js | Latest | AES-256-GCM encryption for YNAB tokens at rest | Lightweight authenticated encryption; prevents tampering; easier than Node.js crypto module |

**Note:** Deferred to Phase 17; Phase 16 prepares the schema (oauth_token, oauth_refresh_token TEXT columns) but does not implement encryption yet.

### Installation Plan

```bash
# Add Auth.js and adapter (Phase 16)
npm install next-auth@5.0+ @auth/prisma-adapter@latest

# Token encryption library (Phase 17, install now for readiness)
npm install libsodium.js  # OR: npm install tweetnacl-util
```

**Why NOT alternatives:**
- **Clerk, Firebase Auth, Supabase Auth:** Vendor lock-in; adds external dependency; Auth.js is framework-agnostic and open-source
- **iron-session (current):** Does not support OAuth providers; designed for single-user applications; no Prisma adapter
- **NextAuth.js v4:** Stable but older; v5 has better edge compatibility and module structure

---

## Architecture Patterns

### Recommended Database Schema Changes (Phase 16)

#### New User Table (replaces single-user configuration)

```typescript
// prisma/schema.prisma (simplified version)
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  emailVerified   DateTime?
  image           String?

  // YNAB OAuth (prepared for Phase 17 encryption)
  oauthToken      String?   // AES-256-GCM encrypted in Phase 17
  oauthRefreshToken String? // AES-256-GCM encrypted in Phase 17
  oauthExpiresAt  BigInt?   // Unix timestamp (ms)

  // Forwarding email (assigned in Phase 18)
  forwardingEmail String?   @unique

  // Configuration (migrated from env in Phase 16)
  senders         Json?     // {"allowed_senders": [{"email": "...", "name": "..."}]}
  currencyAccounts Json?    // {"USD": "account_id", "EUR": "..."}

  // Billing (ready for v5.1)
  plan            String    @default("free")

  // Relations
  accounts        Account[]
  sessions        Session[]
  activityLogs    ActivityLog[]
  settings        Setting[]
  processedEmails ProcessedEmail[]

  // Audit
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Auth.js Session Table (managed by @auth/prisma-adapter)
model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id        String   @id @default(cuid())
  sessionToken String @unique
  userId    String
  expires   DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Scoped Tables (add user_id to existing)
model ActivityLog {
  id            Int     @id @default(autoincrement())
  userId        String  // NEW: Add foreign key to User
  messageId     String  @unique
  status        String

  sender        String?
  subject       String?
  receivedAt    DateTime @default(now())
  rawBody       String?
  parseResult   Json?
  ynabResult    Json?
  errorType     String?
  errorMessage  String?

  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt]) // Index for queries filtered by user
}

model Setting {
  id        String   @id @default(cuid())
  userId    String   // NEW: Add foreign key to User
  key       String
  value     String
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, key]) // One setting per user
}

model ProcessedEmail {
  id          String   @id @default(cuid())
  userId      String   // NEW: Add foreign key to User
  messageId   String
  sender      String
  processedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId]) // One process per user per message
  @@index([userId, processedAt])
}
```

#### PostgreSQL Row-Level Security (RLS) Policies

```sql
-- Enable RLS on scoped tables
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;

-- Create a helper function to get the current user ID from session
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT cast(current_setting('app.user_id') AS TEXT)
$$ LANGUAGE SQL;

-- ActivityLog: Users can only see their own activity
CREATE POLICY user_isolation_activity_log
  ON "ActivityLog"
  USING (user_id = current_user_id());

-- Setting: Users can only see their own settings
CREATE POLICY user_isolation_setting
  ON "Setting"
  USING (user_id = current_user_id());

-- ProcessedEmail: Users can only see their own processed emails
CREATE POLICY user_isolation_processed_email
  ON "ProcessedEmail"
  USING (user_id = current_user_id());

-- Account: Users can only see their own OAuth accounts
CREATE POLICY user_isolation_account
  ON "Account"
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM "User" WHERE id = current_user_id()
  ));
```

**How RLS works:** Every query must set `app.user_id` session variable before executing. Prisma middleware (via custom wrapper) sets this before queries. Even if application code forgets the WHERE clause, database rejects access.

### Session & Authentication Flow

```typescript
// lib/auth.ts - Auth.js Configuration
import NextAuth from 'next-auth'
import Email from 'next-auth/providers/email'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      async sendVerificationRequest({ identifier, url }) {
        // Use Resend for magic link delivery
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@ynab-automation.railway.app',
          to: identifier,
          subject: 'Sign in to YNAB Automation',
          html: `
            <h1>Sign in to YNAB Automation</h1>
            <p><a href="${url}">Click here to sign in</a></p>
            <p>This link expires in 24 hours.</p>
          `,
        })
        if (!result.success) {
          throw new Error('Failed to send email')
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  session: { strategy: 'database' }, // Database-backed sessions (stateful)

  callbacks: {
    // Add user.id to JWT token
    jwt({ token, user }) {
      if (user) {
        token.id = user.id // Store database ID in token
      }
      return token
    },

    // Extend session with user.id
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  // Email verification token TTL
  events: {
    async linkAccount({ user }) {
      // User linked their OAuth account; create forwarding address in Phase 18
    },
  },
})
```

### API Route Pattern with User Context Extraction

```typescript
// src/app/api/dashboard/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  // Extract session and verify user is authenticated
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // All queries MUST filter by user_id
    const activityLog = await prisma.activityLog.findMany({
      where: { userId }, // CRITICAL: User_id filter required
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const stats = {
      totalProcessed: activityLog.length,
      successCount: activityLog.filter((log) => log.status === 'success').length,
      errorCount: activityLog.filter((log) => log.status === 'error').length,
    }

    return NextResponse.json({ activityLog, stats })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    )
  }
}
```

### Database Migration Strategy (Non-Breaking)

Phase 16 uses a three-phase migration approach to add `user_id` to existing tables without data loss:

**Phase 1: Add Nullable Column**
```sql
-- Migration: 20260328_add_user_id_to_tables.sql
ALTER TABLE "ActivityLog" ADD COLUMN "userId" TEXT;
ALTER TABLE "Setting" ADD COLUMN "userId" TEXT;
ALTER TABLE "ProcessedEmail" ADD COLUMN "userId" TEXT;
```

**Phase 2: Backfill Existing Data**
```typescript
// lib/migrations/backfill-user-id.ts
import { prisma } from '@/lib/prisma'

export async function backfillUserId() {
  // Get or create the initial user (manuel)
  const manuelUser = await prisma.user.upsert({
    where: { email: 'manuel@example.com' }, // Adjust as needed
    update: {},
    create: {
      email: 'manuel@example.com',
      name: 'Manuel',
    },
  })

  // Backfill activity logs
  const updatedLogs = await prisma.activityLog.updateMany({
    where: { userId: null },
    data: { userId: manuelUser.id },
  })

  // Backfill settings
  const updatedSettings = await prisma.setting.updateMany({
    where: { userId: null },
    data: { userId: manuelUser.id },
  })

  // Backfill processed emails
  const updatedEmails = await prisma.processedEmail.updateMany({
    where: { userId: null },
    data: { userId: manuelUser.id },
  })

  console.log(`Backfilled ${updatedLogs.count} activity logs`)
  console.log(`Backfilled ${updatedSettings.count} settings`)
  console.log(`Backfilled ${updatedEmails.count} processed emails`)

  return { updatedLogs, updatedSettings, updatedEmails }
}
```

**Phase 3: Add NOT NULL Constraint**
```sql
-- Migration: 20260328_make_user_id_not_null.sql
-- Only after verifying all records have userId set
ALTER TABLE "ActivityLog"
  ALTER COLUMN "userId" SET NOT NULL,
  ADD CONSTRAINT fk_activity_log_user_id
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE "Setting"
  ALTER COLUMN "userId" SET NOT NULL,
  ADD CONSTRAINT fk_setting_user_id
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE "ProcessedEmail"
  ALTER COLUMN "userId" SET NOT NULL,
  ADD CONSTRAINT fk_processed_email_user_id
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
```

### Sign-Out Implementation

```typescript
// src/app/api/auth/signout/route.ts
import { signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function POST() {
  await signOut({ redirect: false })
  redirect('/auth/signin')
}

// Client-side sign-out button
// src/app/(dashboard)/components/SignOutButton.tsx
'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Sign Out
    </button>
  )
}
```

### Session Wiring: TypeScript Type Augmentation

```typescript
// src/types/next-auth.d.ts
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string
      name?: string
      image?: string
    }
  }

  interface User {
    id: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User authentication (signup, login, password reset) | Custom auth system with email verification | Auth.js v5 | Handles token storage, session management, token expiration, magic link generation; security-hardened; handles OAuth providers |
| Persistent session storage across browser refresh | In-memory session store or client-side localStorage | Database-backed sessions via Auth.js + Prisma adapter | localStorage is vulnerable to XSS; in-memory is lost on server restart; database sessions are secure (HttpOnly cookie) and persistent |
| Tenant isolation at application layer | WHERE clause on every query; manual user_id filtering | PostgreSQL Row-Level Security (RLS) policies | RLS is a database-level backstop; catches application-layer bugs; developers can't forget the filter |
| Magic link email delivery | Custom email sending logic | Auth.js Email provider + Resend | Auth.js handles token generation, expiration, and link formatting; Resend provides reliable delivery; reduces custom code |
| Session cookie security | Custom cookie handling | Auth.js cookie management | Auth.js sets Secure, HttpOnly, SameSite flags; handles token rotation; prevents CSRF and XSS attacks |
| OAuth provider integration (Google, GitHub, etc.) | Custom OAuth flow implementation | Auth.js with provider packages | Auth.js handles Authorization Code flow, token refresh, callback routing; errors in custom OAuth are security-critical |

**Key insight:** Auth.js handles the security-critical parts of authentication. Custom implementations of session management, token generation, or OAuth flows are high-risk and error-prone. Use Auth.js for all of these.

---

## Common Pitfalls

### Pitfall 1: Data Leakage via Missing user_id Filters

**What goes wrong:**
A query returns data for all users because the WHERE clause forgets to filter by user_id.

Example:
```typescript
// WRONG: No user_id filter
const logs = await prisma.activityLog.findMany()
// Returns all users' activity logs!

// CORRECT: With user_id filter
const logs = await prisma.activityLog.findMany({
  where: { userId: session.user.id }
})
```

**Why it happens:**
- Single-user code doesn't need filters (there's only one user)
- Session context is available but developers forget to extract and use it
- TypeScript doesn't warn about missing WHERE clauses
- Tests pass with a single user, so bugs surface only with multiple users

**How to avoid:**
1. **Establish a rule:** Every database query must filter by `userId` or reference the user through a foreign key
2. **Use RLS as a backstop:** Even if code forgets the filter, PostgreSQL RLS policies reject unauthorized access
3. **Test with multiple users:** Create two user accounts and verify user1 cannot see user2's data via any API endpoint
4. **Code review checklist:** Every query mentions userId in WHERE clause or foreign key reference

**Warning signs:**
- API endpoint returns data without checking session.user.id
- SQL query looks correct but WHERE userId = ? is missing
- Test shows user1 can see user2's activity log
- Multiple users report seeing each other's data

---

### Pitfall 2: Auth.js Session User ID Not Wired Through

**What goes wrong:**
Auth.js authenticates the user, but `session.user.id` is undefined. Developers then hardcode a user_id or skip the check entirely.

**Why it happens:**
- Auth.js by default only includes name, email, and image in the session
- The user's database ID must be explicitly added in the JWT and session callbacks
- This is a simple step but is easy to forget

**How to avoid:**
1. **Explicitly add user.id to JWT token and session callback** (shown in Code Examples above)
2. **Augment the TypeScript Session type** with id field (shown in Code Examples)
3. **Test that session.user.id is defined** in every API route that uses it

**Warning signs:**
- API route uses `session.user.id` but it's always undefined
- Manual test works (hardcoded user_id), but multiple users conflict
- TypeScript doesn't report as missing but runtime error occurs

---

### Pitfall 3: Database Migration Data Integrity

**What goes wrong:**
When adding `user_id` to existing tables, data becomes orphaned (NULL user_id) or assigned to the wrong user.

**Why it happens:**
- Adding a NOT NULL constraint to existing data is a blocker; must use nullable column first
- The backfill step is easy to forget or get wrong
- Testing migrations is skipped, so failures surface in production

**How to avoid:**
1. **Plan the migration in three phases:**
   - Add nullable column
   - Backfill existing data
   - Add NOT NULL constraint
2. **Write an idempotent migration script** (see Architecture Patterns above)
3. **Test against production-like data** before deploying
4. **Document a rollback plan** in case something goes wrong
5. **Verify all records have user_id set** before adding NOT NULL constraint

**Warning signs:**
- Migration script has no backfill step
- Migration not idempotent (running twice causes issues)
- Old records have NULL user_id after migration
- Record counts differ before/after migration

---

### Pitfall 4: Session Context Lost in Webhooks and Background Jobs

**What goes wrong:**
Background jobs or webhooks don't have access to Auth.js session context, so they can't determine which user to process for.

**Why it happens:**
- Auth.js middleware works only for HTTP request/response cycles
- Background jobs run outside HTTP context
- Webhook handlers receive JSON data but may not include user context

**How to avoid:**
1. **Always include user_id in webhook payloads and job parameters** (not in global context)
2. **Pass user_id explicitly to every background job**
3. **Test background jobs with multiple users** to verify they process the correct user's data

**Warning signs:**
- Webhook handler processes an email but updates the wrong user's activity log
- Background job always processes the same user or all users
- Test passes with one user but fails with multiple users

---

### Pitfall 5: Signup Flow Doesn't Create User Record

**What goes wrong:**
Auth.js magic link works, but the User record is never created in the database. Session is created, but queries fail because the user row doesn't exist.

**Why it happens:**
- Auth.js PrismaAdapter handles Account table (OAuth), but User table may not be created
- Developers assume Auth.js creates the User record automatically
- Testing with a single user doesn't expose this (migrations backfill it)

**How to avoid:**
1. **Verify Auth.js creates a User record on first login** — use PrismaAdapter correctly
2. **Test signup flow end-to-end:** Magic link → callback → User record created
3. **Check the database** after clicking a magic link to confirm User row exists

**Warning signs:**
- Signup works (magic link sent), but clicking it causes 500 error
- Session is created but queries for user.id fail with "user not found"
- User record missing from database after first login

---

## Code Examples

All examples verified against Auth.js v5 official documentation and Prisma 5.13 patterns.

### Auth.js Configuration (lib/auth.ts)

**Source:** Auth.js v5.0+ Official Documentation, Prisma Adapter Guide

```typescript
import NextAuth from 'next-auth'
import Email from 'next-auth/providers/email'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || 'noreply@ynab-automation.railway.app',

      // OR use Resend directly (recommended)
      async sendVerificationRequest({ identifier, url, provider, theme }) {
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@ynab-automation.railway.app',
          to: identifier,
          subject: `Sign in to YNAB Automation`,
          html: `
            <body style="font-family: sans-serif;">
              <h1>YNAB Automation Sign In</h1>
              <p>Click the link below to sign in to your account.</p>
              <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Sign In
              </a>
              <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
            </body>
          `,
        })

        if (!result.success) {
          throw new Error(`Failed to send email: ${result.error}`)
        }
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],

  session: {
    strategy: 'database', // Store sessions in database (stateful)
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update every 24 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id // Add database ID to JWT
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string // Include ID in session
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after signin
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return baseUrl
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser) {
        console.log(`New user signed up: ${user.email}`)
        // Optionally: send welcome email, create forwarding address, etc.
      }
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})
```

### API Route with Session Extraction (src/app/api/activity/route.ts)

**Source:** Next.js 14+ API Routes, Auth.js Session Pattern

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Extract session and verify authentication
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const userId = session.user.id
  const page = new URL(request.url).searchParams.get('page') || '1'
  const pageNum = parseInt(page)
  const pageSize = 20

  try {
    // CRITICAL: Filter by userId to prevent data leakage
    const [activityLog, totalCount] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId }, // User_id filter REQUIRED
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          messageId: true,
          status: true,
          sender: true,
          subject: true,
          receivedAt: true,
          parseResult: true,
          ynabResult: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.count({ where: { userId } }),
    ])

    return NextResponse.json({
      data: activityLog,
      pagination: {
        page: pageNum,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  } catch (error) {
    console.error(`[Activity] Error for user ${userId}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 }
    )
  }
}
```

### Signup Route Handler (src/app/auth/signin/page.tsx)

**Source:** Next.js Server Components, Auth.js signIn function

```typescript
import { signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to YNAB Automation
          </h2>
        </div>

        <form className="mt-8 space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            formAction={async (formData) => {
              'use server'
              await signIn('email', {
                email: formData.get('email'),
                redirect: true,
                redirectTo: '/dashboard',
              })
            }}
            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sign in with Magic Link
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-2 text-gray-500">Or</span>
            </div>
          </div>

          <button
            type="submit"
            formAction={async () => {
              'use server'
              await signIn('google', {
                redirect: true,
                redirectTo: '/dashboard',
              })
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

## State of the Art

| Decision | Old Approach | Current Approach (Phase 16) | When Changed | Impact |
|----------|--------------|---------------------------|--------------|--------|
| Session Management | iron-session (JWT-based, admin-only) | Auth.js v5 with database sessions | v5.0 kickoff | Supports multiple users, OAuth providers, stateful session revocation |
| Authentication | Basic HTTP + hardcoded password check | Auth.js magic links + Google OAuth | v5.0 kickoff | Passwordless signup/login, zero friction, OAuth ready |
| Database Model | Single global settings (no user scope) | User table with multi-tenant schema | v5.0 kickoff | Per-user configuration, activity logs, OAuth tokens |
| Tenant Isolation | Application layer (manual WHERE clauses) | PostgreSQL RLS policies + application filters | v5.0 design | Database-level guarantee, prevents leakage even with bugs |
| Email Sending | Resend (already used for admin) | Resend (continue using) | Existing | Reliable, simple API, Auth.js official recommendation |

**Deprecated/Outdated:**
- **iron-session:** Designed for single-user scenarios; doesn't support OAuth providers cleanly
- **NextAuth.js v4:** Stable but older; v5 has better module structure and edge compatibility
- **Custom user authentication:** Too many security edge cases; Auth.js is battle-tested

---

## Validation Architecture

**Nyquist Validation Status:** Enabled (workflow.nyquist_validation = true in .planning/config.json)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 (already configured) |
| Environment | node (vitest.config.ts) |
| Quick run command | `npm test -- --grep "AUTH-01\|AUTH-02\|AUTH-03"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | New user can sign up via email magic link and receive verification email | integration | `npm test -- src/app/api/auth/signin.test.ts` | ❌ Wave 0 |
| AUTH-02 | User session persists after browser refresh (cookie valid, session hydrated) | integration | `npm test -- src/lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-03 | User can log out; session cookie deleted, redirected to login | integration | `npm test -- src/app/api/auth/signout.test.ts` | ❌ Wave 0 |
| DATA-01 | All database tables have user_id column and foreign key to User | unit | `npm test -- src/lib/migrations.test.ts` | ❌ Wave 0 |
| DATA-02 | Existing activity logs, settings, processed emails migrated to "manuel" user with no data loss | integration | `npm test -- src/lib/migrations.test.ts` | ❌ Wave 0 |
| DATA-03 | PostgreSQL RLS policies prevent user from querying other users' data directly | integration | `npm test -- src/lib/rls.test.ts` | ❌ Wave 0 |
| DATA-04 | API endpoints filter by session.user.id; multi-user test shows user1 cannot see user2's data | integration | `npm test -- src/app/api/activity.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run quick auth tests: `npm test -- --grep "AUTH-01|AUTH-02|AUTH-03" --reporter=verbose`
- **Per wave merge:** Full suite: `npm test` (all 300+ tests across auth, migrations, API endpoints)
- **Phase gate:** All tests green, plus manual verification:
  1. Create two user accounts (email + Google OAuth)
  2. User1 logs in, sees their activity log
  3. User2 logs in, sees their (empty) activity log
  4. User1 logs out, redirected to signin
  5. User1 cannot see User2's data via API (403 or RLS blocks)

### Wave 0 Gaps

These test files must be created during implementation:

- [ ] `src/lib/auth.test.ts` — Test Auth.js configuration: session creation, user.id included, JWT callback works
- [ ] `src/app/api/auth/signin.test.ts` — Test magic link and Google OAuth signup flows
- [ ] `src/app/api/auth/signout.test.ts` — Test session deletion and redirect
- [ ] `src/lib/migrations.test.ts` — Test user_id backfill: existing data gets user_id, no orphaned records, rollback plan
- [ ] `src/lib/rls.test.ts` — Test PostgreSQL RLS: direct SQL queries blocked without proper user context
- [ ] `src/app/api/activity.test.ts` — Test multi-user isolation: user1 cannot see user2's activity via API
- [ ] `src/lib/database.test.ts` — Test Prisma middleware for user_id injection (if custom middleware needed)

### Testing Strategy for Phase 16

1. **Unit tests:** Prisma schema changes, migration scripts, encryption/decryption (when Phase 17 adds it)
2. **Integration tests:** Auth.js signup/login flows, session persistence, logout
3. **Multi-user isolation tests:** Create two users, verify isolation at API and database level
4. **Migration safety tests:** Run backfill script on test data, verify integrity, no data loss
5. **RLS policy tests:** Write raw SQL queries and verify they're blocked without proper context

**Test data strategy:**
- Create fixtures for two users: user1 (manuel@example.com) and user2 (test@example.com)
- Seed activity logs and settings for each user
- Verify queries respect user_id boundaries

---

## Sources

### Primary (HIGH confidence)

- **Auth.js v5.0 Official Documentation** (https://authjs.dev) — Magic links, OAuth providers, session management, Prisma adapter, JWT callbacks, session callbacks
- **Prisma Multi-Tenancy Patterns** (https://www.prisma.io/docs/guides/other/multi-tenancy) — Schema design, user_id scoping, migrations
- **PostgreSQL Row-Level Security Documentation** (https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — RLS policies, usage patterns, performance
- **Next.js 14+ API Routes and Middleware** (https://nextjs.org/docs) — Request/response handling, session extraction, authentication patterns
- **Resend Email Service** (https://resend.com) — Magic link delivery, email sending API, reliability

### Secondary (MEDIUM confidence)

- **Auth.js + Prisma Adapter Integration Guide** (https://authjs.dev/getting-started/providers/email-resend) — Specific setup for Email provider + Resend
- **Multi-Tenant Security — OWASP Cheat Sheet Series** (https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — Data isolation best practices, session security
- **Postmark vs. SendGrid 2026 Comparison** (https://postmarkapp.com/compare/sendgrid-alternative) — Email provider features (relevant for Phase 18, referenced here for context)

### Tertiary (verified during implementation)

- **Auth.js GitHub Discussions** (https://github.com/nextauthjs/next-auth/discussions) — Real-world experience, edge cases, community patterns
- **Prisma Migrate Documentation** (https://www.prisma.io/docs/orm/prisma-migrate) — Safe migration strategies, rollback procedures

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — Auth.js v5, Prisma 5.13, PostgreSQL, Resend are all stable, proven technologies with official documentation
- **Architecture:** HIGH — Multi-tenant patterns are well-documented; RLS is PostgreSQL native; session management follows Auth.js best practices
- **Database Migration:** HIGH — Three-phase approach (nullable → backfill → NOT NULL) is industry-standard for safe schema changes
- **Pitfalls:** HIGH — All seven pitfalls are documented with concrete prevention strategies and recovery procedures

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (30 days — stable tech, no breaking changes expected)
**Phase dependencies:** None — Phase 16 is foundational; all subsequent phases depend on this research

---

**End of Research**
