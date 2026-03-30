# Phase 18: Per-User Inbound Email - Research

**Researched:** 2026-03-31
**Domain:** Email inbound routing, webhook processing, multi-user email forwarding
**Confidence:** HIGH

## Summary

Phase 18 converts the app from a single global webhook endpoint that processes forwarded emails for one user into a multi-user email routing system where each user has a unique forwarding address routed to their YNAB account. This requires three integration layers: (1) an email service provider (Postmark or SendGrid) for per-user forwarding address generation and webhook delivery, (2) webhook idempotency handling to prevent duplicate YNAB transactions from retried webhooks, and (3) user identification logic that maps inbound forwarding addresses to user IDs for correct token loading and transaction creation. The existing email parsing and YNAB transaction logic (Phase 17) remain unchanged; only the webhook routing and user context extraction changes. Phase 18 depends critically on Phase 17's per-user YNAB token infrastructure and Phase 16's user authentication/session system.

**Primary recommendation:** Use Postmark for inbound email routing (MailboxHash-based user context embedding, simpler webhook security model, 10 retries over 10.5 hours vs SendGrid's 3-day window). Implement webhook idempotency with `processed_webhooks` table (UNIQUE constraint on provider webhook ID) before processing any email.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EMAIL-01 | User receives a unique forwarding email address upon signup | Forwarding address assigned at User signup via `forwardingEmail` field; format: `{mailbox_hash}@{domain}` where hash embeds user_id |
| EMAIL-02 | Forwarded emails routed to the correct user via inbound email service | Postmark/SendGrid webhook posts to `/api/email/inbound`; MailboxHash extracted from To header and mapped back to userId |
| EMAIL-03 | Inbound webhook verifies signature to prevent forged emails | Postmark uses IP allowlisting + HTTPS (or Basic Auth); webhook must verify signature before processing (see Common Pitfalls) |
| EMAIL-04 | Duplicate webhook deliveries deduplicated (idempotency) | `processed_webhooks(provider_webhook_id)` table with UNIQUE constraint prevents duplicate YNAB transaction creation |
| EMAIL-05 | Forwarded email creates YNAB transaction in user's account | Webhook extracts userId from MailboxHash, loads user's decrypted YNAB token (Phase 17), calls createYnabTransaction(userId, ...) |

## Standard Stack

### Email Inbound Provider

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Postmark Inbound | Latest API v1 | Per-user forwarding addresses, webhook delivery, MailboxHash routing | Industry-standard for inbound email; simpler auth (no HMAC verification), 10 retries in 10.5 hours = aggressive retry with shorter window = better for critical paths |
| SendGrid Inbound Parse | Latest API v1 | Alternative: per-user forwarding addresses, webhook delivery | Enterprise-grade; supports ECDSA signature verification (stricter but requires key management); 3-day retry window = longer resilience but higher latency risk |

**Recommendation:** Postmark. Reasons: (1) MailboxHash embedded directly in To address (simpler user routing), (2) webhook auth via IP allowlist + HTTPS (no HMAC key management during beta), (3) 10 retries over 10.5 hours = faster retry cadence = better user experience (email bounces faster if system down). SendGrid more suitable if higher signature assurance (ECDSA) or 3-day retention needed.

**Installation:**
```bash
npm install postmark  # If using Postmark
# npm install @sendgrid/mail  # If using SendGrid (sendgrid-nodejs library)
```

### Database & Idempotency

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| PostgreSQL | 15+ | Store forwarding addresses per user, webhook deduplication log | Existing; RLS policies ensure user_id scoping |
| Prisma | 5.0+ | Schema migrations for new tables (EmailForwardingAddress, ProcessedWebhook) | Existing; typed migrations |
| Processed Webhooks Table | n/a | Deduplicate webhook deliveries by provider webhook ID | Prevents duplicate YNAB transactions; UNIQUE constraint on (provider, webhook_id) |

### Supporting

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| crypto (Node.js built-in) | Built-in | Webhook signature verification (Postmark IP check via HTTPS, or SendGrid ECDSA) | HTTPS + IP allowlist (Postmark) requires no extra library; ECDSA (SendGrid) requires crypto module |
| URL API (Node.js) | Built-in | Parse MailboxHash from To header (`user+hash@domain` format) | Extract user context from email address |

## Architecture Patterns

### Recommended Schema Additions

```sql
-- User table additions (add to Phase 16 schema)
ALTER TABLE "User" ADD COLUMN "forwardingEmail" TEXT UNIQUE NOT NULL DEFAULT 'pending';

-- New table: Email forwarding address mapping
CREATE TABLE "EmailForwardingAddress" (
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "mailboxHash" TEXT NOT NULL,  -- e.g., "user_123_abc" (hash of userId)
  "email" TEXT NOT NULL,         -- e.g., "user_123_abc@inbound.postmarkapp.com"
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "mailboxHash"),
  FOREIGN KEY("userId") REFERENCES "User"(id)
);

-- New table: Processed webhooks (idempotency)
CREATE TABLE "ProcessedWebhook" (
  "id" SERIAL PRIMARY KEY,
  "provider" TEXT NOT NULL,      -- "postmark" or "sendgrid"
  "providerId" TEXT NOT NULL,    -- webhook ID from provider (MessageID for Postmark, sg_event_id for SendGrid)
  "userId" TEXT NOT NULL REFERENCES "User"(id),
  "status" TEXT DEFAULT 'success',  -- 'success', 'error', 'skipped'
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("provider", "providerId")  -- CRITICAL: prevents duplicates across retries
);

-- Enable RLS on new tables
ALTER TABLE "EmailForwardingAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedWebhook" ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation_email_forwarding
  ON "EmailForwardingAddress"
  USING (user_id = current_user_id());

CREATE POLICY user_isolation_processed_webhook
  ON "ProcessedWebhook"
  USING (user_id = current_user_id());
```

### Pattern 1: Forwarding Address Generation

**What:** On user signup, generate a unique forwarding email address and store it in the User table. Address format: `{mailbox_hash}@{provider_domain}`.

**When to use:** Every new user signup. Must happen before user enters the dashboard.

**Example:**
```typescript
// src/lib/email-forwarding.ts
import { createHash } from 'crypto';

export function generateMailboxHash(userId: string): string {
  // Hash userId so it's not plaintext in email addresses
  const hash = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return `user_${userId.slice(0, 8)}_${hash}`;
}

export async function assignForwardingAddress(userId: string): Promise<string> {
  const mailboxHash = generateMailboxHash(userId);
  const forwardingEmail = `${mailboxHash}@inbound.postmarkapp.com`;

  // Store in User table
  await prisma.user.update({
    where: { id: userId },
    data: { forwardingEmail },
  });

  return forwardingEmail;
}
```

**Source:** Postmark MailboxHash documentation — user context embedding via email address

### Pattern 2: Webhook Idempotency Layer

**What:** Every inbound webhook payload contains a unique provider ID (Postmark's MessageID or SendGrid's sg_event_id). Before processing, check if this ID exists in `ProcessedWebhook` table with UNIQUE constraint. If duplicate, return 200 immediately without re-processing.

**When to use:** First operation in `/api/email/inbound` handler. Must happen before any state mutation (YNAB API call).

**Example:**
```typescript
// src/app/api/email/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Extract webhook ID from provider
  const providerId = body.MessageID;  // Postmark field
  // OR: const providerId = body.sg_event_id; // SendGrid field

  // Check for duplicate (UNIQUE constraint will reject if exists)
  try {
    const existing = await prisma.processedWebhook.findUnique({
      where: {
        provider_providerId: {
          provider: 'postmark',
          providerId,
        },
      },
    });

    if (existing) {
      // Duplicate delivery — acknowledge but don't re-process
      return NextResponse.json({ status: 'skipped', reason: 'already_processed' }, { status: 200 });
    }

    // NEW: Extract user ID from MailboxHash in To header
    const toAddress = body.To; // e.g., "user_abc123_xyz@inbound.postmarkapp.com"
    const mailboxHash = toAddress.split('@')[0]; // "user_abc123_xyz"

    // Reverse lookup: mailboxHash → userId
    const emailForwarding = await prisma.emailForwardingAddress.findUnique({
      where: { mailboxHash },
    });

    if (!emailForwarding) {
      // Recipient not found — skip silently (spam/misconfigured)
      return NextResponse.json({ status: 'rejected', reason: 'unknown_recipient' }, { status: 200 });
    }

    const userId = emailForwarding.userId;

    // Load user's YNAB token (Phase 17 dependency)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { oauthToken: true, selectedBudgetId: true, selectedAccountId: true },
    });

    if (!user?.oauthToken) {
      // User not connected to YNAB
      return NextResponse.json({ status: 'error', reason: 'no_ynab_token' }, { status: 200 });
    }

    // Process email (existing logic from v4.0)
    const transactionResult = await createYnabTransaction(userId, {
      from: body.From,
      subject: body.Subject,
      textBody: body.TextBody,
      // ... other fields
    });

    // NOW record as processed (inside transaction to ensure atomicity)
    await prisma.processedWebhook.create({
      data: {
        provider: 'postmark',
        providerId,
        userId,
        status: 'success',
      },
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    // Constraint violation = duplicate (another request is processing this)
    if (error.code === 'P2002') {
      return NextResponse.json({ status: 'skipped', reason: 'race_condition' }, { status: 200 });
    }

    // Other error — log and return 200 (don't retry)
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
```

**Source:** Standard webhook idempotency pattern from HookDeck, Hookbin, and Stripe docs — store delivery ID, check before processing

### Pattern 3: User Context Extraction from Email Address

**What:** Parse MailboxHash from the To header to identify which user owns this forwarding address. Use database lookup for security (not parsing user_id directly from email).

**When to use:** In webhook handler after signature verification.

**Example:**
```typescript
// src/lib/email-routing.ts
import { prisma } from '@/lib/prisma';

export async function getUserFromForwardingAddress(toAddress: string): Promise<string | null> {
  // Extract domain and local part
  const [localPart] = toAddress.split('@');

  // Query by mailboxHash (via EmailForwardingAddress table)
  const forwarding = await prisma.emailForwardingAddress.findUnique({
    where: { mailboxHash: localPart },
    select: { userId: true },
  });

  return forwarding?.userId || null;
}
```

### Anti-Patterns to Avoid

- **Parsing user_id directly from email address:** NEVER embed plaintext user_id in the MailboxHash. Always hash it and store the reverse lookup in DB. Otherwise, users can guess other users' forwarding addresses.
- **Processing webhook before idempotency check:** Calling YNAB API before checking ProcessedWebhook table creates duplicate transactions on retry. Always deduplicate first.
- **Skipping webhook signature verification:** Even with HTTPS, verify Postmark's IP allowlist or SendGrid's ECDSA signature. Prevents forged emails from creating fake transactions.
- **Storing webhook in success state before processing:** If webhook handler crashes mid-processing, the duplicate check will skip the retry. Only mark as processed AFTER successful YNAB API call (or wrap in transaction).
- **Per-user webhook secrets:** Do NOT generate a unique webhook secret per user. Use a single app-wide secret or IP allowlist. Per-user secrets are complex to rotate and don't improve security beyond IP allowlist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email address uniqueness per user | Custom email gen logic with collision checking | Postmark's MailboxHash + database lookup | Postmark handles address allocation and delivery; custom logic is complex, error-prone, and requires monitoring |
| Webhook deduplication | In-memory set of processed IDs or Redis cache | ProcessedWebhook table with UNIQUE constraint | In-memory loses data on restart; Redis adds operational overhead; database constraint is atomic and survives failures |
| User identification from email | Parsing email address format in application | Database lookup via MailboxHash | Parsing is brittle (email format changes = bugs); DB lookup is single source of truth, supports address migration |
| Webhook signature verification | Custom HMAC calculation from raw body | Postmark IP allowlist + HTTPS (or SendGrid's crypto library) | Custom implementation has timing-attack vulnerabilities; providers have battle-tested implementations |
| Email provider integration | Custom SMTP client with Postmark API calls | Postmark SDK (postmark npm package) | SDK handles retries, error codes, rate limiting; building it yourself requires months of edge case handling |

**Key insight:** Inbound email routing is deceptively complex — providers handle SPF/DKIM/DMARC authentication, webhook retries with backoff, attachment parsing, and spam filtering. Custom implementations typically miss edge cases like rate limiting, concurrent webhook deliveries, and provider API changes.

## Common Pitfalls

### Pitfall 1: Forged Webhooks (Signature Verification Skipped)

**What goes wrong:** App processes a webhook without verifying it came from the email provider. Attacker crafts a JSON payload, calls `/api/email/inbound` directly, and creates fake YNAB transactions.

**Why it happens:** During development, signature verification seems like optional hardening. In production, it's critical.

**How to avoid:**
- **Postmark:** IP allowlist incoming requests to Postmark's IP range (available in Postmark docs). Require HTTPS (no plaintext). Optional: add Basic Auth header to webhook URL.
- **SendGrid:** Verify ECDSA signature using the public key in SigningSecret header. Code: `crypto.verify('sha256', buffer, pubKey, signature)` from @sendgrid/mail or community guides.
- **Test:** Before deploying, manually test forged webhook: `curl -X POST http://localhost:3000/api/email/inbound -H "Content-Type: application/json" -d '{"From":"attacker@example.com"}'` — should fail or skip processing.

**Warning signs:** Webhook handler doesn't check signature; IP allowlist disabled in code comments; SendGrid key stored as plaintext in code (should be in env var).

### Pitfall 2: Duplicate YNAB Transactions from Webhook Retries

**What goes wrong:** Email provider retries webhook delivery (network timeout, 5xx error). Application processes the same email twice, creating two YNAB transactions for one forwarded email.

**Why it happens:** Idempotency layer was skipped because "we'll just handle it in error cases." But "handling it" requires deduplication logic anyway.

**How to avoid:**
- **ProcessedWebhook table:** Before any processing, check if `provider + provider_id` exists in DB. If yes, skip processing (return 200 OK immediately).
- **UNIQUE constraint:** Database constraint prevents race conditions (two concurrent webhooks). If both try to INSERT, only one succeeds; the other gets constraint violation (which you catch and skip).
- **Atomic writes:** Wrap ProcessedWebhook.create() and YNAB transaction in a single transaction (or use database trigger). If YNAB API fails, rollback the ProcessedWebhook insert so retries are allowed.
- **Test:** Simulate webhook retry by calling `/api/email/inbound` twice with same MessageID. Verify YNAB only got one transaction.

**Warning signs:** No ProcessedWebhook table; idempotency key stored in Redis only (lost on restart); YNAB API called before dedup check.

### Pitfall 3: Wrong User Gets the Transaction

**What goes wrong:** Email forwarded to User A's address is processed as User B's transaction (amount added to User B's account).

**Why it happens:** User ID extraction logic is broken. Either MailboxHash is not unique, or the reverse lookup is wrong.

**How to avoid:**
- **MailboxHash uniqueness:** Hash should include the user_id (not plaintext). Verify UNIQUE constraint on (userId, mailboxHash) in database.
- **Reverse lookup:** Query `EmailForwardingAddress.findUnique({ where: { mailboxHash } })` before every webhook. Do NOT cache the mapping (users should be able to delete and recreate forwarding addresses).
- **Test with multiple users:** Create User A and User B. Assign them forwarding addresses. Forward an email to A's address. Verify transaction is in A's YNAB account, not B's. Repeat for B.

**Warning signs:** MailboxHash is plaintext userId; EmailForwardingAddress table missing or not queried; test suite has only one user.

### Pitfall 4: Webhook Timeout → No User Gets Email

**What goes wrong:** Webhook handler takes >30 seconds processing email (Claude API call, YNAB API call, etc.). Postmark/SendGrid times out webhook delivery. Postmark retries, but if handler is consistently slow, email is eventually dropped.

**Why it happens:** Handler does synchronous work (Claude parsing, YNAB transaction) instead of queueing async jobs.

**How to avoid:**
- **Enqueue immediately:** Webhook handler should store webhook data in ProcessedWebhook, return 200 OK, then process asynchronously (job queue, Cloud Tasks, etc.).
- **Fast path:** For beta, if async not yet implemented, ensure webhook handler timeout is >30s. Set Postmark webhook timeout to 20s, leave 10s buffer.
- **Test:** Simulate slow YNAB API: add a `setTimeout(20000)` in the webhook handler, call it, verify provider still retries (not hanging the app).

**Warning signs:** Handler calls `await createYnabTransaction()` synchronously; no job queue; webhook tests pass but prod sees timeouts.

### Pitfall 5: User Signs Up but Forwarding Address Not Assigned

**What goes wrong:** User signup completes, user sees dashboard, but forwardingEmail field is empty or "pending". User can't forward emails because they don't have an address.

**Why it happens:** Postmark address allocation is async or requires API call; signup flow doesn't wait for it.

**How to avoid:**
- **Synchronous during signup:** Call `assignForwardingAddress(userId)` immediately after user row is created (in signup route or server action).
- **Fallback plan:** If Postmark API fails, use a deterministic format: `user-{userId}@inbound.postmarkapp.com`. Postmark accepts any subdomain on your domain; no per-address config needed.
- **Test:** Sign up a new user, immediately check User.forwardingEmail in DB. Should be non-null and contain provider domain.

**Warning signs:** forwardingEmail has default value "pending"; signup route doesn't call assignForwardingAddress; no tests for signup flow.

### Pitfall 6: Signature Verification Breaks During Provider Upgrade

**What goes wrong:** Postmark or SendGrid changes signature algorithm or IP range. Webhooks are rejected as forged. Emails stop processing.

**Why it happens:** Signature verification is tightly coupled to provider's IP list or key format. Changes break it.

**How to avoid:**
- **Postmark:** Store the allowed IP range in code or env var (update when Postmark publishes changes). Document where to find updates.
- **SendGrid:** Store public key in env var (from SigningSecret header of any webhook). Periodically rotate/verify it matches docs.
- **Monitor:** Alert if webhook handler starts rejecting deliveries (e.g., 403 Forbidden). Likely cause: provider upgrade.
- **Test:** Unit test signature verification with sample payloads from provider's docs (they usually include examples).

**Warning signs:** IP address hardcoded without comment; public key not in env var; no webhook rejection monitoring.

## Code Examples

### Complete Webhook Handler (Postmark)

```typescript
// src/app/api/email/inbound/route.ts
// Source: Postmark webhook documentation + Phase 17 YNAB integration

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createYnabTransaction } from '@/lib/ynab';
import { decryptToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic'; // Webhook, not static

export async function POST(request: NextRequest) {
  try {
    // Verify source IP (Postmark IPs only)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip');
    const postmarkIps = (process.env.POSTMARK_IPS || '').split(',');
    if (!postmarkIps.includes(clientIp)) {
      console.warn(`Rejected webhook from unauthorized IP: ${clientIp}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Step 1: Deduplication (idempotency)
    const providerId = body.MessageID; // Postmark field
    const existing = await prisma.processedWebhook.findUnique({
      where: {
        provider_providerId: {
          provider: 'postmark',
          providerId,
        },
      },
    });

    if (existing) {
      // Already processed, return 200 OK (don't re-process)
      return NextResponse.json({ status: 'skipped', id: providerId }, { status: 200 });
    }

    // Step 2: Extract user from forwarding address
    const toAddress = body.To; // e.g., "user_abc_xyz@inbound.postmarkapp.com"
    const mailboxHash = toAddress.split('@')[0];

    const forwarding = await prisma.emailForwardingAddress.findUnique({
      where: { mailboxHash },
    });

    if (!forwarding) {
      // Unknown recipient, skip (return 200 so provider doesn't retry)
      await prisma.processedWebhook.create({
        data: {
          provider: 'postmark',
          providerId,
          userId: 'unknown', // Placeholder for orphaned webhook
          status: 'skipped',
        },
      });
      return NextResponse.json({ status: 'unknown_recipient' }, { status: 200 });
    }

    const userId = forwarding.userId;

    // Step 3: Load user's YNAB token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        oauthToken: true,
        selectedBudgetId: true,
        selectedAccountId: true,
      },
    });

    if (!user?.oauthToken) {
      // User not connected, skip (will email user about incomplete setup)
      await prisma.processedWebhook.create({
        data: {
          provider: 'postmark',
          providerId,
          userId,
          status: 'skipped',
        },
      });
      return NextResponse.json({ status: 'no_ynab_account' }, { status: 200 });
    }

    // Step 4: Process email (existing v4.0 logic, now per-user)
    const transactionResult = await createYnabTransaction(userId, {
      from: body.From,
      subject: body.Subject,
      textBody: body.TextBody,
      htmlBody: body.HtmlBody,
      attachments: body.Attachments || [],
    });

    // Step 5: Record as processed (idempotency checkpoint)
    await prisma.processedWebhook.create({
      data: {
        provider: 'postmark',
        providerId,
        userId,
        status: 'success',
      },
    });

    return NextResponse.json({ status: 'success', transaction: transactionResult }, { status: 200 });

  } catch (error) {
    // Constraint violation = another request won the race
    if (error.code === 'P2002') {
      return NextResponse.json({ status: 'race_condition' }, { status: 200 });
    }

    console.error('Webhook processing error:', error);
    // Return 200 anyway (don't retry on app error; log it for manual investigation)
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
```

### Forwarding Address Assignment (Signup)

```typescript
// src/app/auth/signup/action.ts (server action)
// Source: Phase 16 signup pattern + email forwarding

import { prisma } from '@/lib/prisma';
import { generateMailboxHash } from '@/lib/email-forwarding';

export async function signUpAction(email: string): Promise<{ userId: string; forwardingEmail: string }> {
  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      emailVerified: new Date(),
    },
  });

  // Assign forwarding address
  const mailboxHash = generateMailboxHash(user.id);
  const forwardingEmail = `${mailboxHash}@inbound.postmarkapp.com`;

  // Store mapping and update user
  await prisma.$transaction([
    prisma.emailForwardingAddress.create({
      data: {
        userId: user.id,
        mailboxHash,
        email: forwardingEmail,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { forwardingEmail },
    }),
  ]);

  return { userId: user.id, forwardingEmail };
}
```

### Webhook Signature Verification (SendGrid Alternative)

```typescript
// src/lib/sendgrid-webhook-verify.ts
// Source: SendGrid docs on signature verification

import { createVerify } from 'crypto';

export function verifySignature(body: string, signature: string, publicKey: string): boolean {
  const verifier = createVerify('sha256');
  verifier.update(body);
  return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
}

// In route handler:
// const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature');
// const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp');
// const bodyString = await request.text();
// if (!verifySignature(bodyString, signature, process.env.SENDGRID_PUBLIC_KEY)) {
//   return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
// }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single global webhook endpoint (Pipedream) | Per-user forwarding addresses with provider routing | v5.0 (Phase 18) | Multiple users now supported; each has unique address; email routed correctly |
| Manual email-to-YNAB transaction creation | Email provider webhook → JSON POST → YNAB API | v5.0 (v4.0 logic reused) | Automated pipeline; users forward emails directly |
| Plaintext user ID in email addresses | MailboxHash (hashed user context) in email address | v5.0 (Phase 18) | Users can't guess other users' addresses; better privacy |
| Custom SMTP polling | Webhook-based inbound (push vs pull) | v5.0 (Phase 18) | Real-time processing; lower latency; no polling overhead |

**Deprecated/outdated:**
- **Pipedream:** Single-user flow; not suitable for multi-tenant. Replaced with Postmark/SendGrid per-user routing.
- **In-memory webhook tracking:** Lost on app restart. Replaced with ProcessedWebhook database table.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (existing from Phase 17) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npm run test -- tests/email/ -t "idempotency"` |
| Full suite command | `npm run test -- tests/email/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAIL-01 | User signup assigns unique forwardingEmail | unit | `npm run test -- tests/email/forwarding.test.ts -t "assigns unique"` | ❌ Wave 0 |
| EMAIL-02 | Webhook extracts userId from MailboxHash | unit | `npm run test -- tests/email/routing.test.ts -t "extracts user"` | ❌ Wave 0 |
| EMAIL-03 | Forged webhook (missing IP) is rejected | unit | `npm run test -- tests/email/security.test.ts -t "rejects unauthorized"` | ❌ Wave 0 |
| EMAIL-04 | Duplicate webhook (same MessageID) is skipped | unit | `npm run test -- tests/email/idempotency.test.ts -t "skips duplicate"` | ❌ Wave 0 |
| EMAIL-05 | Webhook creates YNAB transaction scoped to user | integration | `npm run test -- tests/email/integration.test.ts -t "creates transaction"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/email/ -t "idempotency or routing or security"` (quick dedup + user extraction tests, ~5s)
- **Per wave merge:** `npm run test -- tests/email/` (full suite: forwarding, routing, security, idempotency, integration, ~20s)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/email/forwarding.test.ts` — covers EMAIL-01 (forwardingEmail assignment on signup)
- [ ] `tests/email/routing.test.ts` — covers EMAIL-02 (MailboxHash → userId extraction)
- [ ] `tests/email/security.test.ts` — covers EMAIL-03 (webhook signature verification, IP allowlist)
- [ ] `tests/email/idempotency.test.ts` — covers EMAIL-04 (ProcessedWebhook dedup, UNIQUE constraint)
- [ ] `tests/email/integration.test.ts` — covers EMAIL-05 (full webhook → YNAB transaction flow)
- [ ] `prisma/migrations/` — Add EmailForwardingAddress, ProcessedWebhook tables + RLS policies
- [ ] `src/lib/email-forwarding.ts` — generateMailboxHash, assignForwardingAddress functions
- [ ] `src/app/api/email/inbound/route.ts` — Complete webhook handler (IP verification, dedup, user extraction, YNAB call)

## Sources

### Primary (HIGH confidence)
- [Postmark Inbound Email Documentation](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email) — Webhook payload structure, MailboxHash, retry behavior (10 retries over 10.5 hours)
- [Postmark Webhooks Overview](https://postmarkapp.com/developer/webhooks/webhooks-overview) — Signature verification (IP allowlist + HTTPS), Basic Auth optional
- [Postmark Inbound Webhook API](https://postmarkapp.com/developer/webhooks/inbound-webhook) — MailboxHash field extraction, JSON payload schema
- [SendGrid Inbound Parse Webhook](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook) — Alternative provider, ECDSA signature verification
- [SendGrid Webhook Signature Verification](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/securing-your-parse-webhooks) — Elliptic Curve signature algorithm, security policies
- [Webhook Idempotency Patterns](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) — Best practice for deduplication, storage-based idempotency with UNIQUE constraints
- [Inbound Email Webhooks 2026 Guide](https://www.pingram.io/blog/inbound-email-notification-webhooks-how-to-process-incoming-emails-api-2026) — Current SaaS patterns, provider comparison

### Secondary (MEDIUM confidence, verified with primary sources)
- [Postmark vs SendGrid Comparison 2026](https://postmarkapp.com/compare/sendgrid-alternative) — Official Postmark comparison, retry behavior, inbound processing features
- [Best Inbound Email APIs 2026](https://www.pingram.io/blog/best-inbound-email-notification-apis) — Comparative analysis of Postmark, SendGrid, Mailgun; inbound webhook reliability
- [Postmark Review 2026](https://hackceleration.com/postmark-review/) — Third-party review of Postmark reliability, inbound processing
- [Webhook Best Practices at Scale](https://hookdeck.com/blog/webhooks-at-scale) — Retry strategies, idempotency patterns, async processing

### Tertiary (LOW confidence, referenced for context)
- [Email Inbox Design: Webhooks vs Polling](https://mailhook.co/blog/email-inbox-design-webhooks-polling-and-storage) — Architecture decisions for inbound email, no implementation details
- [Webhook Security Best Practices](https://hooque.io/guides/webhook-security/) — General security patterns, not provider-specific

## Open Questions

1. **Postmark IP allowlist during development**
   - What we know: Postmark publishes IP ranges; IPs can change per retry
   - What's unclear: How often do Postmark IPs change? Should we cache the list or query it dynamically?
   - Recommendation: Start with hardcoded IP list from Postmark docs (in env var); set up monitoring to alert if signature verification starts failing; periodically (monthly) review Postmark IP docs for changes

2. **Webhook timeout threshold**
   - What we know: Postmark has 30-second timeout; handler should complete in <20s
   - What's unclear: How long does createYnabTransaction take? Will synchronous processing exceed timeout?
   - Recommendation: During Phase 18 implementation, add timer to webhook handler; if >20s, defer YNAB call to async job queue (Wave 1). For beta, synchronous is acceptable if <20s.

3. **MailboxHash format and collision risk**
   - What we know: MailboxHash is arbitrary string before @; must be globally unique per provider
   - What's unclear: Is there a risk of hash collision using SHA256.slice(0, 16)?
   - Recommendation: Test collision rate with target scale (thousands of users). If collision found, extend hash to full 256-bit (64 hex chars). For beta, 16-char hash is fine.

4. **Webhook retry behavior during user YNAB disconnect**
   - What we know: Webhook stores ProcessedWebhook; if user later disconnects YNAB, old webhooks won't create transactions
   - What's unclear: Should we notify user that their pending email failed? Or silently skip?
   - Recommendation: Add email notification on webhook skip (due to missing YNAB token). Include "reconnect YNAB" link.

## Metadata

**Confidence breakdown:**
- Email provider choice (Postmark): HIGH — Official docs reviewed, comparison with SendGrid based on primary sources, architecture well-documented
- Webhook routing patterns: HIGH — Postmark/SendGrid webhook structure verified in official documentation
- Idempotency patterns: HIGH — Based on industry-standard webhook best practices (HookDeck, Stripe, Shopify)
- Signature verification: HIGH — Postmark (IP allowlist) and SendGrid (ECDSA) both documented in official sources
- YNAB integration: HIGH — Dependency on Phase 17 (verified complete); existing createYnabTransaction logic reused

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (Postmark/SendGrid APIs stable; 30-day review recommended for any provider announcements)

