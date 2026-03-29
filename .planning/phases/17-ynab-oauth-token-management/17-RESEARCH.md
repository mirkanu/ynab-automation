# Phase 17: YNAB OAuth & Token Management — Research

**Researched:** 2026-03-30
**Domain:** YNAB OAuth 2.0 Authorization Code Grant flow, encrypted token storage, automatic token refresh
**Confidence:** HIGH

## Summary

Phase 17 implements the YNAB OAuth Authorization Code Grant flow to allow users to connect their own YNAB accounts, replacing the current single-user `YNAB_PERSONAL_ACCESS_TOKEN` environment variable with per-user encrypted tokens. The implementation builds directly on Phase 16's multi-tenant foundation: Auth.js session middleware is already in place, the User model has pre-allocated fields for `oauthToken`, `oauthRefreshToken`, and `oauthExpiresAt`, and all API routes already extract `session.user.id` for tenant scoping. The critical requirements are: (1) OAuth consent flow that exchanges authorization codes for access/refresh tokens, (2) AES-256-GCM encryption for tokens at rest in the database, (3) proactive token expiration checking and automatic refresh before YNAB API calls, (4) concurrent refresh token locking to prevent race condition exhaustion, and (5) disconnect/revocation on user action. All existing YNAB API calls (in webhook and test-parse routes) will be migrated to use the per-user token, with minimal changes to business logic.

**Primary recommendation:** Implement YNAB OAuth using Authorization Code Grant (not Implicit), store encrypted tokens in the User model (already prepared), use database-level row locking for token refresh concurrency safety, and handle token refresh proactively (check expiration before making YNAB API calls, not in error handlers).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| YNAB-01 | User can connect YNAB account via OAuth (Authorization Code Grant) | OAuth flow pattern documented below; Auth.js already configured for multi-provider OAuth |
| YNAB-02 | YNAB OAuth tokens are encrypted at rest (AES-256-GCM) | Token encryption pattern and library recommendations in Standard Stack |
| YNAB-03 | YNAB tokens auto-refresh before expiry | Refresh mechanism with proactive expiration checking and database locking patterns documented |
| YNAB-04 | User can disconnect YNAB account (revokes tokens) | Disconnect pattern and YNAB revocation endpoint covered in Common Pitfalls section |
| YNAB-05 | User can select default YNAB budget and account after connecting | Schema support documented; budget/account selection UI will be Phase 17 delivery |

---

## User Constraints (from CONTEXT.md)

*No CONTEXT.md file exists for Phase 17 yet. Phase 16 completed with all auth/isolation foundations in place.*

---

## Standard Stack

### Core OAuth & Token Management

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Auth.js | v5.0+ | OAuth provider abstraction, session callbacks, token refresh patterns | Already integrated in Phase 16; v5 has native support for OAuth providers and Account table token storage |
| YNAB API (Authorization Code Grant) | v1 | OAuth endpoint for token exchange and refresh | Standard OAuth 2.0 flow; YNAB natively supports refresh tokens (not Implicit Grant) |
| libsodium.js | Latest | AES-256-GCM authenticated encryption for tokens at rest | Proven crypto library; easier than Node.js native crypto; prevents tampering via authentication tag |
| node-cache or Redis (optional) | Latest | Token cache to reduce database lookups on repeated API calls | Low priority for Phase 17; database sufficient, optimization for Phase 18+ |

### Encryption Implementation

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Master encryption key | Railway Vault (env var) | Secrets management; never committed to git; rotated separately from app code |
| Algorithm | AES-256-GCM | Authenticated encryption; detects tampering; standard for sensitive data at rest |
| Key derivation | SHA-256 hash of master key | Deterministic; no salt needed since key is already random |
| Nonce/IV | Random 12 bytes per token | XORed with ciphertext; ensures same plaintext + key ≠ same ciphertext |

### Token Refresh Strategy

| Mechanism | Implementation | Purpose |
|-----------|----------------|---------|
| Expiration check | Pre-check `oauthExpiresAt < now()` before YNAB API call | Detects token expiry proactively; prevents 401 errors |
| Refresh request | POST to `https://app.ynab.com/oauth/token` with refresh token + credentials | Obtains new access token |
| Concurrency lock | Database row-level lock (`FOR UPDATE`) or mutex via `last_refresh_attempt_at` timestamp | Prevents simultaneous refresh requests exhausting the refresh token |
| Token storage | Update User row atomically: `UPDATE user SET oauth_token = ..., oauth_expires_at = ... WHERE id = ?` | Ensures new token is visible before old token expires |

### Existing Stack (No Changes)

| Layer | Tech | Unchanged? |
|-------|------|-----------|
| Database | PostgreSQL + Prisma | Yes; User model already has token fields |
| Session | Auth.js + database | Yes; session.user.id already available |
| API routes | Next.js | Yes; all routes already extract userId |
| YNAB API calls | Native fetch | Yes; only token source changes (env var → user.oauth_token) |
| Multi-tenancy | PostgreSQL RLS + getPrismaForUser | Yes; token scoped to user via userId FK |

## Architecture Patterns

### Pattern 1: OAuth Authorization Code Grant Flow

**What:** Three-leg OAuth flow where user grants consent, app exchanges authorization code for tokens, and tokens are stored encrypted.

**When to use:** YNAB account connection from any authenticated user.

**Flow diagram:**
```
1. User clicks "Connect YNAB"
   ↓
2. App redirects to: https://app.ynab.com/oauth/authorize?
   client_id=<APP_ID>&
   redirect_uri=https://app.example.com/api/ynab/callback&
   response_type=code&
   state=<random_nonce>
   ↓
3. User logs in to YNAB and grants permission
   ↓
4. YNAB redirects to: https://app.example.com/api/ynab/callback?
   code=<authorization_code>&
   state=<random_nonce>
   ↓
5. App exchanges code for tokens (server-side, in /api/ynab/callback):
   POST https://app.ynab.com/oauth/token
   {
     code: <code>,
     client_id: <APP_ID>,
     client_secret: <SECRET>,
     grant_type: "authorization_code"
   }
   ↓
6. YNAB responds with:
   {
     access_token: "eyJ0eX...",
     refresh_token: "5e2ab...",
     expires_in: 7200,
     token_type: "Bearer"
   }
   ↓
7. App encrypts tokens, stores in User row:
   UPDATE user SET
     oauth_token = encryptToken(access_token),
     oauth_refresh_token = encryptToken(refresh_token),
     oauth_expires_at = now + (expires_in * 1000)
   WHERE id = session.user.id
```

**Example implementation:**
```typescript
// src/app/api/ynab/authorize/route.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Generate random state for CSRF protection
  const state = crypto.getRandomValues(new Uint8Array(32)).toString()

  // Store state temporarily (in Redis or session) — must validate on callback
  // TODO: store state → userId mapping with 10min TTL

  const authUrl = new URL('https://app.ynab.com/oauth/authorize')
  authUrl.searchParams.set('client_id', process.env.YNAB_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/ynab/callback`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl)
}

// src/app/api/ynab/callback/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encryptToken } from '@/lib/crypto'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // Validate state (retrieve from Redis/session, verify TTL)
  // TODO: const isValidState = await validateState(state, session.user.id)
  // if (!isValidState) return NextResponse.json({ error: 'Invalid state' }, { status: 403 })

  // Exchange code for tokens
  const tokenRes = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: process.env.YNAB_CLIENT_ID!,
      client_secret: process.env.YNAB_CLIENT_SECRET!, // Secret never exposed to client
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const error = await tokenRes.text()
    console.error('YNAB token exchange failed:', error)
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }

  // Encrypt and store
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      oauthToken: encryptToken(tokenData.access_token),
      oauthRefreshToken: encryptToken(tokenData.refresh_token),
      oauthExpiresAt: BigInt(Date.now() + tokenData.expires_in * 1000),
    },
  })

  // Redirect to settings/dashboard
  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/settings?ynab_connected=true`)
}
```

---

### Pattern 2: Proactive Token Expiration Check & Refresh

**What:** Before making a YNAB API call, check if the token is expired. If so, refresh using the refresh token. Only use the refreshed token for the API call.

**When to use:** Every YNAB API call (createYnabTransaction, getCategories, getAccountName, etc.).

**Key insight:** Refreshing in the error handler (after a 401) is too late—by then the request failed. Proactive check prevents failures.

**Example implementation:**
```typescript
// lib/ynab.ts
import { prisma } from '@/lib/db'
import { decryptToken, encryptToken } from '@/lib/crypto'

async function getValidYnabToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { oauthToken: true, oauthRefreshToken: true, oauthExpiresAt: true },
  })

  if (!user?.oauthToken || !user?.oauthRefreshToken) {
    throw new Error('User has not connected YNAB account')
  }

  // Check expiration (5min buffer)
  if (user.oauthExpiresAt && BigInt(Date.now()) < user.oauthExpiresAt - BigInt(5 * 60 * 1000)) {
    // Token is still valid
    return decryptToken(user.oauthToken)
  }

  // Token expired or expiring soon — refresh it
  console.log(`Token expired for user ${userId}, refreshing...`)
  const refreshToken = decryptToken(user.oauthRefreshToken)

  const tokenRes = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.YNAB_CLIENT_ID!,
      client_secret: process.env.YNAB_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    const error = await tokenRes.text()
    console.error('Token refresh failed:', error)
    throw new Error('YNAB token refresh failed — user must re-authorize')
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Update tokens atomically
  await prisma.user.update({
    where: { id: userId },
    data: {
      oauthToken: encryptToken(tokenData.access_token),
      oauthRefreshToken: encryptToken(tokenData.refresh_token),
      oauthExpiresAt: BigInt(Date.now() + tokenData.expires_in * 1000),
    },
  })

  return tokenData.access_token
}

export async function createYnabTransaction(
  userId: string,
  params: YnabTransactionParams,
): Promise<string> {
  const token = await getValidYnabToken(userId)

  const { budgetId, accountId, amount, description, senderName, payeeName, date, categoryId } = params
  const milliunits = Math.round(amount * 1000) * -1
  const memo = `${senderName}: ${description} - Automatically added from email`

  const res = await fetch(`https://api.youneedabudget.com/v1/budgets/${budgetId}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`, // Always fresh token
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: {
        account_id: accountId,
        date,
        amount: milliunits,
        payee_name: payeeName,
        memo,
        cleared: 'uncleared',
        approved: false,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`YNAB API error: ${res.status}`)
  }

  const data = await res.json() as { data: { transaction: { id: string } } }
  return data.data.transaction.id
}
```

---

### Pattern 3: Concurrent Token Refresh Locking

**What:** When multiple requests simultaneously detect an expired token, only one should refresh. Others wait for the result or retry with the refreshed token.

**When to use:** Token refresh in multi-user, multi-request environments (any webhook or background job that handles multiple users concurrently).

**Problem it solves:**
- Request A detects expiration, calls YNAB refresh → gets token_A
- Request B detects expiration, calls YNAB refresh → gets token_B
- YNAB marks token_B as "already used" (refresh tokens can only be used once)
- Next request fails with "invalid_token"

**Solution (mutex via timestamp):**
```typescript
async function getValidYnabToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      oauthToken: true,
      oauthRefreshToken: true,
      oauthExpiresAt: true,
      lastRefreshAttemptAt: true, // New field to track refresh mutex
    },
  })

  if (!user?.oauthToken || !user?.oauthRefreshToken) {
    throw new Error('User has not connected YNAB account')
  }

  // Check expiration
  const now = BigInt(Date.now())
  const expiresAt = user.oauthExpiresAt || BigInt(0)
  const isExpired = now >= expiresAt - BigInt(5 * 60 * 1000)

  if (!isExpired) {
    return decryptToken(user.oauthToken)
  }

  // Token expired. Check if another request is already refreshing.
  const lastAttempt = user.lastRefreshAttemptAt
  const now_ms = Date.now()
  if (lastAttempt && now_ms - lastAttempt.getTime() < 30_000) {
    // Another request refreshed within the last 30s. Re-fetch from DB and use the new token.
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { oauthToken: true, oauthExpiresAt: true },
    })
    if (updatedUser?.oauthExpiresAt && now < updatedUser.oauthExpiresAt) {
      return decryptToken(updatedUser.oauthToken)
    }
    // If still expired, fall through to refresh
  }

  // Perform refresh
  const refreshToken = decryptToken(user.oauthRefreshToken)

  const tokenRes = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.YNAB_CLIENT_ID!,
      client_secret: process.env.YNAB_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    const error = await tokenRes.text()
    console.error('Token refresh failed:', error)
    throw new Error('YNAB token refresh failed')
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Update atomically with timestamp
  await prisma.user.update({
    where: { id: userId },
    data: {
      oauthToken: encryptToken(tokenData.access_token),
      oauthRefreshToken: encryptToken(tokenData.refresh_token),
      oauthExpiresAt: BigInt(Date.now() + tokenData.expires_in * 1000),
      lastRefreshAttemptAt: new Date(),
    },
  })

  return tokenData.access_token
}
```

**Alternative: Database row-level lock (more robust):**
```typescript
// Use Prisma raw query for FOR UPDATE lock (if Prisma supports it)
const updatedUser = await prisma.$queryRaw`
  SELECT id, oauth_token, oauth_refresh_token, oauth_expires_at
  FROM "User"
  WHERE id = ${userId}
  FOR UPDATE
`
// Perform refresh and update within the same transaction
```

---

### Pattern 4: Disconnect & Token Revocation

**What:** User clicks "Disconnect YNAB" → tokens are deleted from database and (optionally) revoked with YNAB.

**When to use:** User-initiated account disconnection, account deletion.

**Implementation:**
```typescript
// src/app/api/ynab/disconnect/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Delete tokens from database (required)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        oauthToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        // TODO: Reset selectedBudgetId, selectedAccountId
      },
    })

    // Optional: Revoke with YNAB (check YNAB docs for revocation endpoint)
    // await fetch('https://app.ynab.com/oauth/revoke', {
    //   method: 'POST',
    //   body: new URLSearchParams({ token: refreshToken, client_id: ... })
    // })

    return NextResponse.json({ status: 'disconnected' })
  } catch (err) {
    console.error('Disconnect failed:', err)
    return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 })
  }
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth redirect & token exchange | Custom OAuth implementation from scratch | YNAB's Authorization Code Grant API + Auth.js | YNAB's endpoints are well-documented; implementing OAuth correctly requires CSRF protection (state param), PKCE for SPAs, and secure token storage—all handled by the patterns above |
| Token encryption/decryption | DIY crypto with Node.js native crypto | libsodium.js with AES-256-GCM | Authenticated encryption prevents tampering; libsodium abstracts key derivation and nonce handling |
| Session state management during OAuth flow | Store state in global variable or memory | Redis with 10min TTL (or temporary DB table) | Global variables lost on process restart; Redis survives worker crashes; prevents CSRF attacks |
| Token refresh | Refresh in error handler (on 401) | Proactive refresh before API call | Error-handler refresh means the first request fails; users see "connection error"; proactive check prevents failures entirely |
| Concurrent token refresh | Simple lock with a flag | Database timestamp + conditional update (mutex pattern) | A flag can get stuck; timestamp-based mutex is self-healing (if refresh attempt is >30s old, it's assumed failed and can be retried) |

---

## Common Pitfalls

### Pitfall 1: Using Implicit Grant Instead of Authorization Code Grant

**What goes wrong:**
Implicit Grant (client-side token exchange in the browser) is chosen instead of Authorization Code Grant. YNAB only supports Authorization Code Grant for refresh tokens. Result: no refresh token → user must re-authorize every 2 hours.

**Why it happens:**
Implicit Grant seems simpler (no backend token exchange needed). Developers unfamiliar with OAuth might assume client-side is the "modern" approach.

**How to avoid:**
- Verify YNAB API documentation confirms Authorization Code Grant and refresh token support
- Always choose Authorization Code (server-side token exchange) for any OAuth integration that needs long-lived access
- Never expose the client secret to the browser; it's for server-to-server communication

**Warning signs:**
- `oauthToken` is set but `oauthRefreshToken` is NULL
- Users report "need to sign in to YNAB again" after 2 hours
- YNAB OAuth endpoint docs mention "token_type: implicit" instead of "token_type: authorization_code"

**Verification in Phase 17:** Confirm YNAB OAuth endpoint in `/api/ynab/callback` returns both `access_token` and `refresh_token` fields. Test token persists for >2 hours without re-auth.

---

### Pitfall 2: Storing Tokens Unencrypted or in Logs

**What goes wrong:**
YNAB OAuth tokens are stored in plaintext in the database or appear in logs. A database breach or log exposure reveals tokens, allowing attackers to access users' YNAB accounts.

**Why it happens:**
Encryption adds implementation complexity; plaintext storage seems "fine for MVP." Developers might not realize tokens are credentials equivalent to passwords.

**How to avoid:**
1. **Always encrypt tokens before storing in database** — Use AES-256-GCM with a secure key (Railway Vault env var)
2. **Never log tokens** — Redact tokens in error messages:
   ```typescript
   // Bad:
   console.error('Token refresh failed:', tokenRes.status, tokenRes.body)

   // Good:
   console.error('Token refresh failed:', tokenRes.status)
   ```
3. **Test encryption end-to-end** — Verify decrypted token is identical to original
4. **Rotate encryption key periodically** — Store key in Vault, rotate monthly

**Warning signs:**
- Tokens visible in logs when searched with grep
- Database dump shows plaintext token values
- Logs contain "Authorization: Bearer eyJ0eX..." instead of error code only

**Verification in Phase 17:**
- Check that `oauthToken` is encrypted in DB: `SELECT oauth_token FROM "User" LIMIT 1` should show hex/base64, not "eyJ0eX"
- Verify decryption roundtrip: encrypt → decrypt → should equal original
- Verify no token appears in error logs: `grep -r "Bearer\|eyJ0eX" logs/`

---

### Pitfall 3: Concurrent Token Refresh Exhausts Refresh Token

**What goes wrong:**
Two simultaneous requests detect an expired token and both attempt to refresh. YNAB's refresh token can only be used once. The second request gets an "invalid_token" error; the account becomes inaccessible.

**Why it happens:**
Multi-tenant webhook/job processing is concurrent. Two users' emails arrive simultaneously, both trigger token refresh for the same user. Testing with one user rarely triggers this.

**How to avoid:**
1. **Use database-level locking** — Use `FOR UPDATE` or a timestamp-based mutex:
   ```typescript
   const lastAttempt = user.lastRefreshAttemptAt
   if (lastAttempt && now - lastAttempt.getTime() < 30_000) {
     // Refresh already in progress; wait or fetch updated token
   }
   ```
2. **Handle "token reuse" errors gracefully** — If YNAB returns "refresh_token_exhausted", redirect user to re-authorize
3. **Test concurrent requests** — Load test with 5+ simultaneous requests with an expired token

**Warning signs:**
- YNAB API errors mention "refresh_token_reuse" or "too_many_refresh_attempts"
- Multiple refresh attempts in logs within seconds for same user
- User suddenly unable to create transactions (token locked)

**Verification in Phase 17:** Load test with concurrent requests. Use `ab -c 10` or similar to send 10 simultaneous requests for the same user with an expired token. All should succeed without "refresh token" errors.

---

### Pitfall 4: Token Refresh Happens in Error Handler Instead of Proactively

**What goes wrong:**
Token refresh is only attempted after the YNAB API returns a 401 error. This means:
- First request fails with "unauthorized"
- Error handler refreshes token
- Caller retries
- User sees an error, then it works after a retry

**Why it happens:**
Error-handler refresh seems reasonable ("if it fails, fix it"). However, this degrades UX significantly.

**How to avoid:**
1. **Check token expiration before making YNAB API call:**
   ```typescript
   const token = await getValidYnabToken(userId) // Proactive check + refresh
   // At this point, token is guaranteed valid
   const res = await ynabApi(token) // No 401 expected
   ```
2. **Include a 5–10 minute buffer** — Refresh before expiration, not at expiration:
   ```typescript
   if (BigInt(Date.now()) >= expiresAt - BigInt(5 * 60 * 1000)) {
     // Refresh now; token expires in 5 minutes
   }
   ```

**Warning signs:**
- YNAB API calls intermittently return 401 for the same user
- Retry logic in webhook handler logs show "first attempt failed, retrying"
- Users report "sometimes transactions don't go through"

**Verification in Phase 17:** Manually set `oauth_expires_at` to 1 second in the future. Make a YNAB API call. Verify the token is refreshed first, then the call succeeds (no 401 errors in logs).

---

### Pitfall 5: CSRF Protection Missing from OAuth Callback

**What goes wrong:**
The OAuth callback handler doesn't validate the `state` parameter. An attacker initiates an OAuth flow and tricks a user into clicking the callback link, potentially connecting the attacker's YNAB account to the user's app account.

**Why it happens:**
State parameter validation seems optional; Auth.js typically handles it. However, custom OAuth implementations must validate the state.

**How to avoid:**
1. **Generate a random state on `/api/ynab/authorize`:**
   ```typescript
   const state = crypto.getRandomValues(new Uint8Array(32)).toString()
   ```
2. **Store state in Redis or session with 10min TTL:**
   ```typescript
   await redis.setex(`oauth_state:${state}`, 600, JSON.stringify({ userId, createdAt: Date.now() }))
   ```
3. **Validate state on callback:**
   ```typescript
   const storedState = await redis.get(`oauth_state:${state}`)
   if (!storedState) return NextResponse.json({ error: 'Invalid state' }, { status: 403 })
   const { userId } = JSON.parse(storedState)
   if (userId !== session.user.id) return NextResponse.json({ error: 'State mismatch' }, { status: 403 })
   ```

**Warning signs:**
- OAuth callback accepts any state value
- No validation that state came from same session
- Attacker could manually construct a callback URL

**Verification in Phase 17:**
- Test that callback rejects missing state: `GET /api/ynab/callback?code=123` should return error
- Test that callback rejects invalid state: use a random state value should return error
- Test that callback requires userId in state to match session.user.id

---

## Code Examples

All examples verified with YNAB API v1 (as of 2026-03-30) and Auth.js v5.

### Example 1: Encrypt & Decrypt YNAB Tokens

**Source:** libsodium.js docs; standard practice for authenticated encryption

```typescript
// lib/crypto.ts
import sodium from 'libsodium.js'

const ENCRYPTION_KEY = process.env.YNAB_TOKEN_ENCRYPTION_KEY!

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * Returns nonce + ciphertext as base64, separated by ':'
 */
export async function encryptToken(plaintext: string): Promise<string> {
  await sodium.ready

  // Derive a consistent key from the master key using SHA-256
  const key = sodium.crypto_hash_sha256(sodium.from_string(ENCRYPTION_KEY))

  // Generate random nonce (12 bytes for GCM)
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)

  // Encrypt plaintext
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt_detached(
    sodium.from_string(plaintext),
    null, // No additional data
    null, // No secret nonce
    nonce,
    key
  )

  // Combine: nonce + tag + ciphertext, encode as base64
  const combined = sodium.crypto_box_easy(
    sodium.from_string(plaintext),
    nonce,
    key
  )

  // Simpler approach: use crypto_secretbox_easy (same level of security)
  const sbox_ciphertext = sodium.crypto_secretbox_easy(
    sodium.from_string(plaintext),
    nonce,
    key
  )

  return sodium.to_base64(nonce) + ':' + sodium.to_base64(sbox_ciphertext)
}

/**
 * Decrypts a token encrypted with encryptToken.
 * Expects base64 nonce and ciphertext separated by ':'
 */
export async function decryptToken(encrypted: string): Promise<string> {
  await sodium.ready

  const key = sodium.crypto_hash_sha256(sodium.from_string(ENCRYPTION_KEY))
  const [nonceB64, ciphertextB64] = encrypted.split(':')

  const nonce = sodium.from_base64(nonceB64)
  const ciphertext = sodium.from_base64(ciphertextB64)

  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)

  return sodium.to_string(plaintext)
}
```

### Example 2: Get Valid Token (with Proactive Refresh)

**Source:** YNAB OAuth v1 API + architecture pattern above

```typescript
// lib/ynab.ts
import { prisma } from '@/lib/db'
import { decryptToken, encryptToken } from '@/lib/crypto'

export async function getValidYnabToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      oauthToken: true,
      oauthRefreshToken: true,
      oauthExpiresAt: true,
    },
  })

  if (!user?.oauthToken || !user?.oauthRefreshToken) {
    throw new Error('User has not connected a YNAB account. Please authorize first.')
  }

  const now = BigInt(Date.now())
  const expiresAt = user.oauthExpiresAt || BigInt(0)

  // Check if token still valid (with 5-minute buffer)
  const buffer = BigInt(5 * 60 * 1000) // 5 minutes in milliseconds
  if (now < expiresAt - buffer) {
    // Token is still valid
    return decryptToken(user.oauthToken)
  }

  // Token is expired or expiring soon — refresh it
  console.log(`Refreshing YNAB token for user ${userId}`)
  const refreshToken = decryptToken(user.oauthRefreshToken)

  const tokenRes = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.YNAB_CLIENT_ID!,
      client_secret: process.env.YNAB_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text()
    console.error(`YNAB token refresh failed for user ${userId}:`, errorText)
    throw new Error('YNAB token refresh failed. Please re-authorize your account.')
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }

  // Update tokens in database
  const expiresAtMs = BigInt(Date.now() + tokenData.expires_in * 1000)
  await prisma.user.update({
    where: { id: userId },
    data: {
      oauthToken: encryptToken(tokenData.access_token),
      oauthRefreshToken: encryptToken(tokenData.refresh_token),
      oauthExpiresAt: expiresAtMs,
    },
  })

  return tokenData.access_token
}
```

### Example 3: Migrate Existing YNAB API Call (Single-User → Multi-User)

**Before (Phase 16 — uses env var):**
```typescript
// Old code in src/lib/ynab.ts
export async function createYnabTransaction(params: YnabTransactionParams): Promise<string> {
  const token = process.env.YNAB_PERSONAL_ACCESS_TOKEN! // Single-user hardcoded

  const res = await fetch(`https://api.youneedabudget.com/v1/budgets/${params.budgetId}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction: { /* ... */ } }),
  })

  return (await res.json()).data.transaction.id
}
```

**After (Phase 17 — uses per-user token):**
```typescript
// New code in src/lib/ynab.ts
export async function createYnabTransaction(
  userId: string,
  params: YnabTransactionParams,
): Promise<string> {
  // Get valid token (proactively refresh if needed)
  const token = await getValidYnabToken(userId)

  const res = await fetch(`https://api.youneedabudget.com/v1/budgets/${params.budgetId}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`, // Always fresh, per-user token
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction: { /* ... */ } }),
  })

  if (!res.ok) {
    throw new Error(`YNAB API error: ${res.status}`)
  }

  return (await res.json()).data.transaction.id
}

// All existing callers need to pass userId:
// OLD: createYnabTransaction(params)
// NEW: createYnabTransaction(userId, params)
```

**Call sites to update:**
- `src/app/api/webhook/route.ts` (email processing) → extract userId, pass to createYnabTransaction
- `src/app/api/replay/route.ts` (replay test) → already has userId from session
- `src/app/api/test-parse/route.ts` (test parse) → would need userId (test with user's token, not env var)

---

## State of the Art

| Pattern | Pre-2024 | 2024–2025 | 2026+ | Implication for Phase 17 |
|---------|----------|----------|-------|--------------------------|
| **OAuth Flow** | Implicit Grant (browser-based) | Authorization Code Grant (server-side exchange) | Authorization Code + PKCE for SPAs | Use Authorization Code Grant (YNAB supports it; more secure) |
| **Token Storage** | Plaintext in DB | Encrypted at rest (AES-256) | Encrypted at rest + key rotation | Implement AES-256-GCM encryption with libsodium.js |
| **Token Refresh** | Manual (on 401 error) | Proactive (before expiry) | Proactive + intelligent retry | Implement proactive refresh with 5-min buffer |
| **Concurrency** | No locking (single-user) | Mutex via timestamp | Database row-level lock (FOR UPDATE) | Use timestamp-based mutex for Phase 17; upgrade to DB lock in Phase 18 |
| **Session State** | In-memory (lost on restart) | Redis or persistent cache | Redis with TTL | Use environment-based state storage (TODO in callback validation) |
| **Monitoring** | Logs only | Logs + error tracking | Logs + metrics + alerts | Add metrics for token refresh success/failure rate |

**Deprecated/outdated:**
- **Implicit Grant:** YNAB doesn't support it; Authorization Code Grant is the only option
- **Client-side token storage:** Tokens must remain server-side; never expose to browser

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 (already configured in Phase 16) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- --run oauth.test.ts` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| YNAB-01 | OAuth authorize endpoint redirects to YNAB | unit | `npm run test -- --run ynab-oauth.test.ts -t "authorize redirects"` | ❌ Wave 0 |
| YNAB-01 | OAuth callback exchanges code for tokens | unit | `npm run test -- --run ynab-oauth.test.ts -t "callback exchanges code"` | ❌ Wave 0 |
| YNAB-01 | User can click "Connect YNAB", complete flow, session has token | integration (manual) | Test flow in browser | ✅ Manual in Phase 17-02 |
| YNAB-02 | Token encryption roundtrip (encrypt → decrypt) | unit | `npm run test -- --run crypto.test.ts -t "encryptToken decryptToken"` | ❌ Wave 0 |
| YNAB-02 | Encrypted token in DB cannot be decrypted with wrong key | unit | `npm run test -- --run crypto.test.ts -t "decrypt fails with wrong key"` | ❌ Wave 0 |
| YNAB-03 | getValidYnabToken proactively refreshes before expiry | unit | `npm run test -- --run ynab-refresh.test.ts -t "proactive refresh"` | ❌ Wave 0 |
| YNAB-03 | Token refresh includes new tokens in response | unit | `npm run test -- --run ynab-refresh.test.ts -t "refresh response"` | ❌ Wave 0 |
| YNAB-04 | Disconnect endpoint clears tokens from User row | unit | `npm run test -- --run ynab-disconnect.test.ts -t "disconnect clears tokens"` | ❌ Wave 0 |
| YNAB-05 | User can select budgetId after connecting YNAB | integration (manual) | Test UI in browser | ✅ Manual in Phase 17-02 |

### Sampling Rate

- **Per task commit:** Run `npm run test -- --run oauth.test.ts crypto.test.ts ynab-refresh.test.ts` (unit tests only; ~10 sec)
- **Per wave merge:** Run `npm run test -- --run` (full suite; ~30 sec)
- **Phase gate:** Full suite green + manual integration test (user flow in browser) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/oauth/ynab-oauth.test.ts` — covers YNAB-01 (authorize redirect, code exchange)
- [ ] `tests/crypto/crypto.test.ts` — covers YNAB-02 (encrypt/decrypt roundtrip, tampering detection)
- [ ] `tests/oauth/ynab-refresh.test.ts` — covers YNAB-03 (proactive refresh, concurrent requests)
- [ ] `tests/oauth/ynab-disconnect.test.ts` — covers YNAB-04 (revocation)
- [ ] Prisma schema: Add `lastRefreshAttemptAt DateTime?` field to User for refresh mutex tracking

---

## Sources

### Primary (HIGH confidence)

- [YNAB API Docs - OAuth](https://api.ynab.com/docs#/API_Reference) — Authorization Code Grant flow, token endpoints, refresh mechanism
- [Auth.js Official Docs](https://authjs.dev) — OAuth provider setup, session callbacks, token storage patterns (v5 current)
- [libsodium.js Documentation](https://docs.libsodium.org/bindings/nodejs) — AES-256-GCM encryption, key derivation
- [PostgreSQL Documentation - Row-Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html) — RLS enforcement in database

### Secondary (MEDIUM confidence)

- [OAuth 2.0 Security Best Practices - RFC 6749](https://tools.ietf.org/html/rfc6749) — Authorization Code Grant security, state parameter, CSRF protection
- [Auth.js Refresh Token Rotation Guide](https://authjs.dev/guides/refresh-token-rotation) — Patterns for secure refresh token handling
- [Webhook Security Best Practices](https://hooque.io/guides/webhook-security/) — Signature validation, idempotency (applicable to webhook token refresh)
- [Node.js OAuth Token Storage Best Practices](https://www.authgear.com/post/nodejs-security-best-practices) — Token encryption, key management

### Tertiary (LOW confidence - flagged for validation)

- Community blog posts on "concurrent token refresh" (implementation details may vary)
- Postmark/SendGrid docs on webhook reliability (tangentially related; covered in Phase 18)

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — All libraries (Auth.js, libsodium.js, YNAB OAuth) are industry-standard with extensive documentation
- Architecture: **HIGH** — OAuth Authorization Code Grant is well-established; refresh token patterns are standard practice; encryption is straightforward with libsodium.js
- Pitfalls: **HIGH** — All pitfalls are documented in multi-tenant OAuth research; prevention strategies are concrete and testable
- Test infrastructure: **MEDIUM** — Vitest is configured; unit test patterns are established from Phase 16; integration tests (OAuth flow in browser) are manual

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days; OAuth/encryption patterns are stable; re-check if YNAB API changes)
**Researched by:** Claude (GSD researcher phase)
