# Technology Stack: Multi-Tenant SaaS

**Project:** Email-to-YNAB Automation (v5.0 Multi-Tenant Beta)
**Researched:** 2026-03-28
**Confidence:** HIGH

## Recommended Stack

### Authentication & Session Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Auth.js | v5.0+ | Multi-user signup, login, OAuth providers, session management | Official Next.js auth solution; edge-compatible; passwordless + OAuth in one library; handles magic links natively via email provider |
| Resend | Latest | Email transport for Auth.js magic link verification | Auth.js official recommendation; simple API; reliable deliverability; already integrated in admin features (error notifications) |

**Why not alternatives:** NextAuth.js is Auth.js v4 (stable but older); custom auth adds maintenance burden and security risk; iron-session (current admin auth) doesn't support OAuth providers well.

### Database & Multi-Tenancy

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 15+ | Persistent user data, activity logs, settings, email→user mappings | Already deployed on Railway; row-level security (RLS) built-in for tenant isolation; no additional infrastructure |
| Prisma | 5.0+ | Database ORM, schema management, migrations | Strongly typed; excellent TypeScript support; clear schema declaration; easy to add `user_id` scoping |
| Row-Level Security (RLS) | PostgreSQL native | Enforce tenant isolation at database level | Every query automatically filters by `user_id`; prevents data leakage even with compromised session tokens; zero application-level trust required |

**Multi-tenancy approach:** Shared database, single schema, `user_id` on all tables + RLS policies. Proven at scale up to thousands of users. No separate databases per tenant (reduces ops complexity, enables cross-tenant aggregation for later analytics).

### OAuth & Token Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| YNAB OAuth (Authorization Code Grant) | v1 API | Secure, user-controlled connection to YNAB account | Standard OAuth 2.0; YNAB supports refresh tokens; user never shares password with us; tokens scoped to YNAB access only |
| TweetNaCl.js or libsodium.js | Latest | Encryption/decryption of stored YNAB tokens | Lightweight; proven for AES-256-GCM encryption; easier than Node.js `crypto` for authenticated encryption |
| node-cache (optional) or Redis | Latest (if using) | Token cache (refresh tokens don't hit DB on every request) | Optional optimization; low priority for beta; PostgreSQL sufficient initially |

**Token storage:** Encrypt YNAB access + refresh tokens before writing to DB. Store encryption key in Railway environment variable (Vault). Rotate refresh tokens on each API call (YNAB supports this; improves security).

### Email Inbound Routing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Postmark OR SendGrid | Latest API v1 | Inbound email routing, webhook processing, per-user address management | Both support per-domain MX routing; deliver inbound emails as JSON webhooks; Postmark has slight DX advantage; choose one based on comparison |
| Database (email_forwarding_address table) | n/a | Store per-user forwarding addresses and webhook credentials | Map `noreply-user-{id}@domain.com` → `user_id`; track MX records + webhook secrets per domain |

**Why not Mailgun or others:** Postmark/SendGrid are enterprise-grade with better documentation; Mailgun equally viable but less common in Node.js SaaS. Pipedream (current approach) not suitable for multi-user (single shared webhook, no user isolation).

### Email Parsing & YNAB Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude API (via Anthropic SDK) | Latest | Email → structured transaction (retailer, amount, category) | Already integrated; proven effective; no changes needed for multi-tenant (stateless API calls) |
| YNAB API Client | v1 (via direct HTTP or library) | Create/update transactions in user's YNAB account | REST API; calls happen in user context (YNAB OAuth token scoped to their account) |

**No changes needed:** Email parsing + YNAB logic is already stateless per-request. Just scope each request to the user's YNAB token from DB.

### Frontend & UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15+ | App router, API routes, server components | Existing; seamless integration with Auth.js; edge-compatible; SSR for dashboards |
| shadcn/ui | Latest | Pre-built components (buttons, forms, dialogs, tables) | Copy-paste, fully customizable; used in admin UI (v4.0); Tailwind-native |
| Tailwind CSS | 3.4+ | Utility-first CSS | Existing; efficient; dark mode support via CSS variables |
| React Hook Form | Latest | Form validation for signup, settings | Lightweight; integrates well with shadcn; reduces boilerplate |

**No changes to existing admin UI stack:** Keep inline CSS patterns where established; extend with new forms for signup/YNAB OAuth/settings.

### Infrastructure & Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Railway | n/a | Hosting (Next.js, PostgreSQL, environment variables) | Existing; seamless; Vault for secrets (encryption keys); auto-scaling sufficient for beta scale |
| Environment Variables (Railway Vault) | n/a | Store secrets (database URL, YNAB OAuth credentials, token encryption key, Postmark API key) | Railway's built-in secret management; no extra infrastructure |

**No infrastructure changes needed:** Railway handles Next.js + PostgreSQL + environment variables. Just add YNAB OAuth client ID/secret + Postmark/SendGrid API key + token encryption key to Vault.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Auth | Auth.js (magic links + OAuth) | Supabase Auth, Clerk, Firebase Auth | Supabase good but ties you to Postgres hosting; Clerk/Firebase add vendor lock-in; Auth.js is framework-agnostic + open-source |
| Database | PostgreSQL + RLS | Row-level per-user database (separate DB per user) | Separate DBs add ops overhead (backups, migrations); limit cross-tenant analytics; overkill for beta scale |
| Email Inbound | Postmark/SendGrid | Mailgun | Equally viable; choose based on phase 2 technical comparison (DX, retry behavior, cost) |
| Token Encryption | TweetNaCl.js + libsodium | Node.js native `crypto` + pbkdf2 | Native crypto is lower-level, more error-prone; NaCl provides authenticated encryption (prevents tampering) |
| Frontend Auth | Auth.js + Resend | Magic.link service | Magic.link is third-party (adds cost + dependency); Auth.js + Resend gives control over flow + user experience |

## Installation & Setup

```bash
# Core dependencies
npm install next@latest react@latest react-dom@latest
npm install @prisma/client
npm install next-auth@latest resend
npm install @hookform/resolvers zod react-hook-form  # Form validation
npm install lucide-react  # Icons (shadcn dependency)

# Dev dependencies
npm install -D prisma
npm install -D typescript @types/node @types/react
npm install -D tailwindcss postcss autoprefixer
npm install -D @hookform/resolvers

# Token encryption (choose one)
npm install tweetnacl-util
npm install libsodium.js  # OR: libsodium.js (better WASM support for edge)

# YNAB API (optional; use native fetch + types instead)
# npm install ynab  # OR use direct HTTP calls for simplicity

# Postmark/SendGrid (choose one)
npm install postmark  # If using Postmark
# npm install @sendgrid/mail  # If using SendGrid
```

### Auth.js Configuration (Minimal Example)

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Email from 'next-auth/providers/email'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      // OR use Resend directly
      sendVerificationRequest: async ({ identifier, url }) => {
        await resend.emails.send({
          from: 'noreply@ynab-automation.com',
          to: identifier,
          subject: 'Sign in to YNAB Automation',
          html: `<a href="${url}">Sign in</a>`,
        })
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

### PostgreSQL RLS Policy (Example)

```sql
-- All tables have user_id foreign key
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation_activity
  ON "Activity"
  USING (user_id = current_user_id());  -- Assumes custom function

-- Similar for: User, Setting, EmailForwardingAddress, YNABToken
```

### Token Encryption (libsodium Example)

```typescript
// lib/crypto.ts
import sodium from 'libsodium.js'

export async function encryptToken(token: string, masterKey: string): Promise<string> {
  await sodium.ready
  const key = sodium.crypto_hash_sha256(sodium.from_string(masterKey))
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(
    sodium.from_string(token),
    nonce,
    key
  )
  return sodium.to_base64(nonce) + ':' + sodium.to_base64(ciphertext)
}

export async function decryptToken(encrypted: string, masterKey: string): Promise<string> {
  await sodium.ready
  const key = sodium.crypto_hash_sha256(sodium.from_string(masterKey))
  const [nonceB64, ciphertextB64] = encrypted.split(':')
  const nonce = sodium.from_base64(nonceB64)
  const ciphertext = sodium.from_base64(ciphertextB64)
  const token = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)
  return sodium.to_string(token)
}
```

## Sources

- [Auth.js Official Documentation](https://authjs.dev)
- [Prisma Multi-Tenancy Patterns](https://www.prisma.io)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [YNAB OAuth Authorization Code Flow](https://api.ynab.com)
- [libsodium.js Cryptography](https://docs.libsodium.org)
- [Postmark Inbound Processing](https://postmarkapp.com/inbound)
- [SendGrid Inbound Parse Webhook](https://docs.sendgrid.com/for-developers/parsing-email)

---

*Technology stack for: Multi-Tenant SaaS (email-to-YNAB automation)*
*Phase: v5.0 Beta*
*Last updated: 2026-03-28*
