# Phase 19: Dashboard, Onboarding & Account Management - Research

**Researched:** 2026-03-30
**Domain:** Multi-tenant SaaS dashboard, guided onboarding flow, account management
**Confidence:** HIGH

## Summary

Phase 19 completes the core user-facing features for the multi-tenant SaaS. Phases 16-18 built the authentication foundation, email routing infrastructure, and YNAB integration. Phase 19 focuses on **user experience**: a guided onboarding flow that gets new users from signup to first working transaction in under 5 minutes, a comprehensive dashboard for visibility into automation activity, and self-service account management (settings, test mode, account deletion).

The research shows that **most dashboard and settings infrastructure already exists** from Phase 16 (dashboard page, activity log, settings page, tools). Phase 19's primary work is: (1) building the guided onboarding flow with email provider instructions, (2) adding account deletion with GDPR compliance, (3) creating a public homepage, and (4) enhancing existing pages with per-user test mode and parse transparency.

**Primary recommendation:** Adapt existing v4.0 dashboard/settings/tools pages for multi-user, implement onboarding flow as a post-signup redirect modal, add account deletion endpoint and UI, and create a simple homepage. All infrastructure for isolation, YNAB integration, and test mode is already in place.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can view their activity log (processed emails, outcomes, errors) | Activity log page exists; already per-user scoped via Phase 16 RLS and userId filtering |
| DASH-02 | User can view their dashboard with stats (success rate, last transaction, total processed) | Dashboard page exists with getDashboardStats; shows this-week stats and last transaction |
| DASH-03 | User can edit their settings (sender routing, currency accounts) | Settings page exists; YNAB connection section (Phase 17) and SettingsForm for config; needs per-user scope |
| DASH-04 | User can toggle test mode (process emails without YNAB writes) | Test mode toggle exists in settings; test-parse endpoint exists; needs per-user flag in User table |
| DASH-05 | User can see email parse transparency (Claude's reasoning for each parse) | parseResult JSON stored in ActivityLog; needs UI to display reasoning + detection logic |
| ONBD-01 | New user guided through signup → connect YNAB → receive forwarding address | Auth works; forwarding address assigned on createUser event; needs guided flow UI |
| ONBD-02 | User sees provider-specific email forwarding instructions (Gmail, Outlook, etc.) | Does not exist; needs provider-detection logic + instruction templates per provider |
| ONBD-03 | User can delete their account and all associated data (GDPR) | Does not exist; needs DELETE endpoint + cascading data removal + UI confirmation |
| ONBD-04 | Homepage/landing page explains product and has signup CTA | Does not exist; needs public page before /auth/signin redirect |

## Standard Stack

### Core Stack (Already in Place)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 15+ | Full-stack framework | ✓ In use (Phase 16+) |
| Auth.js | v5.0+ | Authentication (magic links + OAuth) | ✓ Implemented Phase 16 |
| Prisma | 5.0+ | ORM with multi-tenancy support | ✓ Implemented Phase 16 |
| PostgreSQL | 15+ | Database with RLS enforcement | ✓ In production |
| shadcn/ui | Latest | Copy-paste component library | ✓ In use |
| Tailwind CSS | 3.0+ | Styling | ✓ In use |
| React Hook Form | 7.0+ | Form handling | ✓ In use |
| Resend | Latest | Email transport (magic links + account deletion notifications) | ✓ Integrated Phase 16 |

### Supporting Libraries for Phase 19
| Library | Version | Purpose | When to Use |
|---------|---------|---------|------------|
| lucide-react | Latest | Icons (copy-paste from shadcn) | Navigation, buttons, UI feedback |
| next/image | Built-in | Image optimization (for homepage hero/screenshots) | Public homepage visual content |
| clsx or cn() | Latest | Conditional class binding (already in project) | Dynamic UI states (test mode active, YNAB connected, etc.) |

### No New Dependencies Needed
All infrastructure for dashboard, settings, test mode, and account deletion can be built with existing tech stack. No new packages required.

## Architecture Patterns

### Current Dashboard/Settings/Tools Structure
The codebase already follows a clean pattern:

```
src/app/(dashboard)/
├── layout.tsx              # Auth guard + nav (implemented Phase 16)
├── page.tsx                # Dashboard with stats (implemented Phase 16)
├── logs/page.tsx           # Activity log with filters (implemented Phase 16)
├── settings/page.tsx       # Settings editor (implemented Phase 16)
│   ├── SettingsForm.tsx    # Form component
│   └── YnabConnectionSection.tsx # YNAB OAuth flow
├── tools/page.tsx          # Test mode & replay (implemented Phase 16)
│   └── TestParseForm.tsx   # Form for test parsing
└── components/
    ├── LogFilters.tsx      # Filter UI
    ├── LogRow.tsx          # Individual log entry
    ├── Pagination.tsx      # Pagination controls
    └── CopyButton.tsx      # Utility button

src/app/api/
├── ynab/authorize/route.ts      # OAuth flow
├── ynab/callback/route.ts       # Token exchange
├── ynab/disconnect/route.ts     # Token revocation
├── ynab/selection/route.ts      # Budget/account selection
├── settings/route.ts            # GET/PUT settings
├── replay/route.ts              # Replay transaction
├── test-parse/route.ts          # Test email parsing
└── email/inbound/route.ts       # Webhook handler (Phase 18)
```

### Pattern 1: Multi-User Data Scoping (Applied Throughout)
**What:** Every database query filters by `session.user.id` (app layer) and uses `getPrismaForUser(userId)` which sets RLS session variable (DB layer).
**When to use:** Every API route, every database query, every page component
**Evidence from codebase:**
```typescript
// From src/app/(dashboard)/page.tsx — dashboard page
const stats = await getDashboardStats(session.user.id)  // userId passed

// From src/lib/activity-log-queries.ts
export async function getDashboardStats(userId: string, ...) {
  const db = getPrismaForUser(userId)  // RLS enforcement
  // All queries include where: { userId } filter
}

// From src/app/api/settings/route.ts
const db = getPrismaForUser(session.user.id)
const settings = await db.setting.findMany({ where: { userId } })
```

### Pattern 2: Per-User Configuration via Database (Settings)
**What:** User settings stored in `Setting` table with (userId, key) composite unique constraint. Read at server-component level, passed to client components as props.
**When to use:** Per-user feature flags, preferences, configuration that doesn't change during request
**Example from Phase 17 (YNAB settings):**
```typescript
// From src/app/(dashboard)/settings/page.tsx — server component
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: {
    oauthToken: true,
    selectedBudgetId: true,
    selectedAccountId: true,
  },
});
const ynabConnected = !!user?.oauthToken;

// Pass to client component
<YnabConnectionSection connected={ynabConnected} />
```

### Pattern 3: Server Component Auth Guard
**What:** All protected pages redirect unauthenticated users to /auth/signin using `const session = await auth(); if (!session?.user?.id) redirect('/auth/signin')`.
**When to use:** Every dashboard page, every settings form
**Evidence:**
```typescript
// Every dashboard page starts with this pattern
export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }
  // Now safe to use session.user.id
}
```

### Pattern 4: API Routes with Auth Check (401 Return)
**What:** All authenticated API endpoints check session first, return 401 JSON if missing.
**When to use:** Server actions, form submissions via fetch, webhook processing
**Evidence:**
```typescript
// From src/app/api/settings/route.ts
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Safe to use session.user.id
}
```

### Anti-Patterns to Avoid
- **Do NOT read SENDERS/CURRENCY_ACCOUNTS from env in dashboard/settings pages** — These are deployment-wide configs, not per-user. Phase 19 removes SetupWizard from authenticated dashboard (it's v4.0 single-user tooling).
- **Do NOT bypass getPrismaForUser for "just a lookup"** — Even a single query without RLS could leak data. Always use `getPrismaForUser(userId)` and WHERE filters.
- **Do NOT trust client-submitted userId** — Always extract from `session.user.id`. Never read userId from request body.
- **Do NOT store YNAB tokens in logs or error messages** — Tokens are encrypted in DB; never expose plaintext in logs (Phase 17 pattern).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Email forwarding instructions per provider | Custom logic for Gmail, Outlook, Apple, Thunderbird | Predefined templates with copy-paste instructions + provider-specific screenshots | Different providers have different folder/auto-forward UI; testing with each is error-prone |
| Test mode toggle persistence | Custom in-memory flag | `testMode` boolean field on User table (already prepared) | In-memory flags lost on deploy; multiple users need isolated test state |
| Parse transparency detail view | Custom parsing display logic | Store parseResult as JSON in ActivityLog, display with structured UI showing retailer, amount, category | Parsing is already stored; just needs UI to render it; don't recalculate |
| Account deletion cascading | Manual DELETE queries | Prisma `onDelete: Cascade` (already in schema) + single `prisma.user.delete()` call | CASCADE constraints are database-level; Prisma cascade ensures nothing orphaned |
| Per-user activity filtering | Custom WHERE clauses | `getActivityLogs(userId, filters)` function wrapper | Reusable, prevents query-building mistakes; centralizes user_id scoping |
| Onboarding flow UI | Custom modal/stepper | Redirect post-signup to /onboarding route with Suspense + skeleton loaders | Simpler than modal state management; follows Next.js patterns; can show forwarding address once YNAB is connected |

**Key insight:** Phase 19 is mostly wiring existing pieces together. The database schema is ready (userId on all tables, RLS enabled, cascading deletes). The dashboard/settings/tools pages exist. Just add: (1) account deletion endpoint, (2) onboarding flow route, (3) homepage, (4) parse transparency UI.

## Common Pitfalls

### Pitfall 1: Forgetting User Scope in Dashboard Stats
**What goes wrong:** Dashboard shows all-time stats instead of this-week stats; activity log filters ignored; multiple users see each other's data.
**Why it happens:** Copying code from v4.0 admin UI which was global; forgetting to add `where: { userId }` to queries.
**How to avoid:** Always pass `session.user.id` to query functions; add `userId: string` as first parameter to all data-fetching functions; review every query for WHERE clause.
**Warning signs:** Stats don't change when switching users; activity log has entries from other senders; filters don't work.

### Pitfall 2: Test Mode State Not Persisting
**What goes wrong:** User toggles test mode; it applies for one request then reverts; or test mode applies globally to all users.
**Why it happens:** Test mode stored in memory/context instead of database; env var read at deploy time instead of per-request.
**How to avoid:** Add `testMode` field to User table; read at page load time via `prisma.user.findUnique({ select: { testMode: true } })`; toggle via API route that updates User row.
**Warning signs:** Test mode state doesn't survive refresh; test mode affects all users simultaneously.

### Pitfall 3: Account Deletion Not Cascading
**What goes wrong:** User deletes account; some data remains (orphaned ActivityLog, ProcessedEmail, Settings rows); orphaned data becomes security issue.
**Why it happens:** Forgot `onDelete: Cascade` on foreign keys; or manual DELETE query that doesn't hit all related tables.
**How to avoid:** Verify Prisma schema has `onDelete: Cascade` on all User relations (it does in Phase 16+); use single `prisma.user.delete({ where: { id: userId } })` call; test deletion leaves no orphaned rows (query for userId in all tables, should get 0 results).
**Warning signs:** After deleting a user, `SELECT * FROM activity_log WHERE user_id = ?` returns rows; unmatched foreign key errors in logs.

### Pitfall 4: Onboarding Flow Sent to Existing Users
**What goes wrong:** User re-logs in after setup is complete; they're redirected to /onboarding again; frustrating UX.
**Why it happens:** Onboarding redirect based on first-time-login flag not being persisted.
**How to avoid:** Track completion state in User table: add `onboardingCompleted` boolean field; set to TRUE after user connects YNAB or dismisses onboarding; redirect only if FALSE and user already authenticated.
**Warning signs:** Long-time users see onboarding flow again; step-through wizard appears on every login.

### Pitfall 5: Email Provider Instructions Hardcoded
**What goes wrong:** Instructions show Gmail steps for Outlook users; different providers have different UI; users get confused.
**Why it happens:** Single instruction template doesn't account for provider differences.
**How to avoid:** Detect email provider from user's email domain (gmail.com, outlook.com, etc.); or show tabs/buttons for provider selection; store predefined instruction templates per provider; test with real users on each provider.
**Warning signs:** Users reporting confusion in feedback; high support questions about "how do I set up forwarding?"

### Pitfall 6: Parse Transparency Reveals Too Much Debug Info
**What goes wrong:** Showing raw Claude API responses with internal token counts, warnings, or incomplete JSON; user confusion or privacy leak.
**Why it happens:** Dumping entire parseResult JSON without filtering.
**How to avoid:** Define a clean schema for what to show: retailer name, detected amount, category reasoning, confidence level. Map parseResult to user-facing fields; never show raw token counts or debug fields.
**Warning signs:** Users see fields like "stop_reason": "end_turn" or incomplete JSON fragments.

## Code Examples

### Existing Dashboard Stats (Working Example)
Source: Phase 16 — Activity Log Queries

```typescript
// src/lib/activity-log-queries.ts — Pattern for user-scoped stats
export async function getDashboardStats(userId: string) {
  const db = getPrismaForUser(userId)  // RLS enforcement

  const thisWeek = await db.activityLog.findMany({
    where: {
      userId,  // Double-filter: app layer + RLS
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    },
  })

  const total = thisWeek.length
  const successes = thisWeek.filter(log => log.status === 'success').length
  const rate = total === 0 ? 0 : Math.round((successes / total) * 100)

  const lastLog = thisWeek.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  const lastTransaction = lastLog ? {
    retailer: lastLog.parseResult?.retailer ?? 'Unknown',
    amount: lastLog.parseResult?.amount ?? 0,
    date: lastLog.parseResult?.date ?? 'Unknown',
    receivedAt: lastLog.createdAt,
  } : null

  return { thisWeek: { total, successes, rate }, lastTransaction }
}
```

### Account Deletion Endpoint (New for Phase 19)
Pattern: Server action that cascades via Prisma `onDelete: Cascade`

```typescript
// src/app/api/account/delete/route.ts (NEW)
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Prisma cascade will delete all related rows:
  // - Setting (userId FK)
  // - ActivityLog (userId FK)
  // - ProcessedEmail (userId FK)
  // - ProcessedWebhook (userId FK)
  // - EmailForwardingAddress (userId FK)
  // - Account (userId FK for OAuth)
  // - Session (userId FK)
  await prisma.user.delete({ where: { id: userId } })

  // Optionally: send deletion confirmation email to archived address
  // await sendDeletionNotification(user.email)

  return NextResponse.json({ status: 'deleted' })
}
```

### Onboarding Flow (New for Phase 19)
Pattern: Redirect post-signup to /onboarding; mark complete when YNAB connected

```typescript
// src/app/onboarding/page.tsx (NEW)
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OnboardingSteps from './OnboardingSteps'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingCompleted: true,
      oauthToken: true,
      forwardingEmail: true,
    },
  })

  // Skip if already completed
  if (user?.onboardingCompleted) {
    redirect('/')
  }

  return (
    <div>
      <h1>Welcome! Let's get you set up in under 5 minutes</h1>
      <OnboardingSteps
        ynabConnected={!!user?.oauthToken}
        forwardingEmail={user?.forwardingEmail ?? ''}
      />
    </div>
  )
}
```

### Email Provider Detection (New for Phase 19)
Pattern: Extract provider from email domain; return provider-specific instructions

```typescript
// src/lib/email-providers.ts (NEW)
export function detectEmailProvider(email: string): 'gmail' | 'outlook' | 'apple' | 'other' {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (['gmail.com', 'googlemail.com'].includes(domain)) return 'gmail'
  if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) return 'outlook'
  if (['icloud.com', 'me.com'].includes(domain)) return 'apple'
  return 'other'
}

export function getForwardingInstructions(provider: 'gmail' | 'outlook' | 'apple' | 'other') {
  const instructions: Record<string, { title: string; steps: string[] }> = {
    gmail: {
      title: 'Set up forwarding in Gmail',
      steps: [
        'Open Settings → Forwarding and POP/IMAP',
        'Click "Add a forwarding address"',
        'Paste your forwarding address: [address]',
        'Complete the verification email',
        'Go back to Settings, select your forwarding address in the dropdown',
        'Choose "Forward a copy of incoming mail to [address]"',
        'Click Save',
      ],
    },
    outlook: {
      title: 'Set up forwarding in Outlook',
      steps: [
        'Click the gear icon → Forwarding',
        'Enable "Start forwarding"',
        'Paste your forwarding address: [address]',
        'Choose "Forward" or "Forward and keep a copy"',
        'Click Save',
      ],
    },
    // ... etc
  }
  return instructions[provider] ?? instructions.gmail
}
```

### Test Mode Toggle (Pattern)
Existing from Phase 16; Phase 19 makes it per-user

```typescript
// src/app/(dashboard)/settings/SettingsForm.tsx
// Add testMode field to form:
<label>
  <input
    type="checkbox"
    checked={testModeEnabled}
    onChange={(e) => {
      // Call API to update User.testMode
      fetch('/api/settings/test-mode', {
        method: 'POST',
        body: JSON.stringify({ enabled: e.target.checked }),
      })
    }}
  />
  Enable test mode (parse emails without sending to YNAB)
</label>
```

### Parse Transparency UI (New for Phase 19)
Pattern: Format parseResult JSON into user-friendly sections

```typescript
// src/app/(dashboard)/components/ParseTransparency.tsx (NEW)
export function ParseTransparency({ parseResult }: { parseResult: Record<string, unknown> | null }) {
  if (!parseResult) return null

  return (
    <div style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.75rem' }}>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
          Show Claude's reasoning
        </summary>
        <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid #e5e7eb' }}>
          <p><strong>Retailer detected:</strong> {parseResult.retailer ?? 'Unknown'}</p>
          <p><strong>Amount:</strong> {parseResult.amount ?? '—'}</p>
          <p><strong>Date:</strong> {parseResult.date ?? '—'}</p>
          {parseResult.confidence && (
            <p><strong>Confidence:</strong> {(parseResult.confidence as number * 100).toFixed(0)}%</p>
          )}
        </div>
      </details>
    </div>
  )
}
```

## State of the Art

| Old Approach (v4.0) | Current Approach (Phase 19) | When Changed | Impact |
|-------------------|----------------------------|--------------|--------|
| Single admin user, shared account | Multi-tenant with per-user isolation | Phase 16 kickoff | All dashboard, settings, logs now per-user; security + usability |
| Env-var based config (SENDERS, CURRENCY_ACCOUNTS) | Database-backed + per-user overrides | Phase 19 | Users can customize without code deploy; admin UI removed from authenticated dashboard |
| Test mode as global env flag | Per-user testMode boolean | Phase 19 | Each user has independent test environment; one user's testing doesn't affect others |
| Manual email forwarding instructions | Provider-detected auto-instructions | Phase 19 | Reduced support burden; Gmail users see Gmail steps, not generic |
| No account deletion | Self-service account deletion with GDPR cascade | Phase 19 | Legal compliance; user data ownership |
| Ad-hoc onboarding | Guided 3-step flow (YNAB → address → done) | Phase 19 | <5 minute onboarding reduces signup-to-value time |

**Deprecated/outdated:**
- SetupWizard component (v4.0 admin tool) — Stays in codebase for backward compatibility, but Phase 19 removes it from authenticated dashboard. New multi-user deployments don't render it.
- Global SENDERS/CURRENCY_ACCOUNTS env vars — Still loaded for backward compatibility, but Phase 19 adds per-user overrides in database.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x with Node.js environment |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npm test -- --run tests/onboarding/ tests/account/` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Activity log filters by userId; no cross-user leakage | unit | `npm test -- --run tests/dashboard/activity-log.test.ts` | ❌ Wave 0 |
| DASH-02 | Dashboard stats show only current user's data; "this week" calculation correct | unit | `npm test -- --run tests/dashboard/stats.test.ts` | ❌ Wave 0 |
| DASH-03 | Settings page loads user's YNAB selection; PUT updates persisted | unit | `npm test -- --run tests/dashboard/settings.test.ts` | ✅ Partial (Phase 16) |
| DASH-04 | Test mode toggle persists per user; one user's flag doesn't affect others | unit | `npm test -- --run tests/dashboard/test-mode.test.ts` | ❌ Wave 0 |
| DASH-05 | parseResult JSON displayed in activity log without exposing debug fields | unit | `npm test -- --run tests/dashboard/parse-transparency.test.ts` | ❌ Wave 0 |
| ONBD-01 | New user signup redirects to /onboarding; completes after YNAB connect; sets onboardingCompleted flag | integration | `npm test -- --run tests/onboarding/flow.test.ts` | ❌ Wave 0 |
| ONBD-02 | detectEmailProvider returns correct provider for gmail.com, outlook.com, etc.; instructions differ per provider | unit | `npm test -- --run tests/onboarding/email-providers.test.ts` | ❌ Wave 0 |
| ONBD-03 | Account deletion endpoint cascades to all user data; no orphaned rows remain | integration | `npm test -- --run tests/account/deletion.test.ts` | ❌ Wave 0 |
| ONBD-04 | Public homepage accessible to unauthenticated users; has signup CTA button | e2e (manual) | `/` route returns 200, contains "Sign up" button | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run tests/{dashboard,onboarding,account}/ --reporter=verbose` (~30s)
- **Per wave merge:** `npm test -- --run` (full suite ~2min)
- **Phase gate:** Full suite green + manual verification of homepage accessibility

### Wave 0 Gaps
- [ ] `tests/dashboard/activity-log.test.ts` — userId filter on getActivityLogs, cross-user isolation
- [ ] `tests/dashboard/stats.test.ts` — getDashboardStats respects user scope, week boundary calculation
- [ ] `tests/dashboard/settings.test.ts` — Per-user settings CRUD, no cross-user access
- [ ] `tests/dashboard/test-mode.test.ts` — testMode field toggle, persistence, isolation
- [ ] `tests/dashboard/parse-transparency.test.ts` — parseResult display, no debug field leakage
- [ ] `tests/onboarding/flow.test.ts` — New user signup → onboarding redirect → YNAB connect → completion
- [ ] `tests/onboarding/email-providers.test.ts` — Provider detection logic, instruction templates
- [ ] `tests/account/deletion.test.ts` — User deletion cascades, no orphaned rows
- [ ] `src/app/page.tsx` (or `/index`) — Public homepage (manual test only)
- [ ] `src/lib/email-providers.ts` — Provider detection + instruction lookup

*(Existing test infrastructure from Phase 16-18 covers Auth, YNAB OAuth, email routing; Phase 19 adds dashboard/onboarding/account tests)*

## Open Questions

1. **Parse Transparency Level of Detail**
   - What we know: parseResult stores retailer, amount, date, category at parse time; ActivityLog has JSON field
   - What's unclear: Should we show confidence scores? Token counts? Full Claude reasoning? Or just structured output?
   - Recommendation: Show minimal set (retailer, amount, category, date) in collapsible "Why?" section; hide token/model details. User testing will validate.

2. **Onboarding Flow UX After Cancellation**
   - What we know: New users redirect to /onboarding after signup; flow is 3 steps (welcome → YNAB connect → get address)
   - What's unclear: If user dismisses onboarding without connecting YNAB, can they use the app? Do we force re-entry?
   - Recommendation: Allow dismissal; show banner on dashboard "Connect YNAB to activate forwarding"; no hard blocker. Re-show onboarding on next login if incomplete.

3. **Test Mode Scope — Applies to What?**
   - What we know: Test mode parses email and shows YNAB output without writing; already works in /tools
   - What's unclear: Does test mode apply to: (a) manual test-parse only, or (b) also to incoming forwarded emails?
   - Recommendation: Apply to incoming emails (via webhook). User toggles testMode in settings; webhook checks User.testMode before createYnabTransaction call.

4. **Email Provider Instructions Maintenance**
   - What we know: Gmail, Outlook, Apple Mail all have different UIs
   - What's unclear: How to keep instructions up-to-date as providers change UI? Do we version them?
   - Recommendation: Store in code as strings (easy to update); add links to provider's official help docs as fallback; plan quarterly review.

5. **Account Deletion Notification**
   - What we know: GDPR requires ability to delete; Resend can send emails
   - What's unclear: Should we send a "Your account was deleted" confirmation email? Store deleted user info for audit?
   - Recommendation: Send deletion confirmation email before removal (or to registered email address with timestamp). Don't retain deleted user info (hard delete per GDPR). Test with privacy lawyer if available.

## Sources

### Primary (HIGH confidence)
- **Existing codebase:** Phase 16 (Auth.js, dashboard pages, activity-log-queries.ts) and Phase 18 (email routing, inbound processing) provide working patterns for user scoping, data isolation, and RLS
- **Prisma Schema:** User table with onDelete: Cascade on all relations; Activity tables with userId FK and RLS enabled; EmailForwardingAddress and ProcessedWebhook scoped (verified in schema review)
- **Auth.js v5 Session Callbacks:** session callback wires user.id to session object (verified in lib/auth.ts line 21-27)
- **Next.js App Router:** Suspense + Skeleton patterns for perceived performance (CLAUDE.md, Web UI conventions)

### Secondary (MEDIUM confidence)
- **SaaS Onboarding Patterns:** Multi-source research from FEATURES.md indicates 3-5 step flows reduce friction; guided flows convert better than self-service forms
- **Email Provider Documentation:** Gmail, Outlook, Apple Mail official help centers confirm forwarding setup differs per provider; screenshots available in official docs

### Tertiary (validation during implementation)
- **Parse Transparency UX:** User feedback during Phase 19 Wave 2 will validate if JSON-in-collapsible is right UI or if a table/list is better
- **Test Mode Behavior:** Live testing with forwarded emails will confirm scope (manual vs automatic)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Existing dependencies sufficient; no new packages needed
- Architecture: HIGH — Dashboard/settings/tools infrastructure exists; Phase 19 adds light wrapper for onboarding/deletion
- Pitfalls: HIGH — Multi-tenant data leakage pitfalls documented in Phase 16; Phase 19 adds onboarding-specific pitfalls (cascade deletion, test mode persistence)
- Validation: MEDIUM — Test infrastructure exists; Phase 19 adds 8 new test files

**Research date:** 2026-03-30
**Valid until:** 2026-04-13 (14 days — SaaS onboarding patterns are stable; team may iterate on UX details)

## Key Findings Summary

1. **Most dashboard infrastructure already exists.** Dashboard page, activity log page, settings page, tools/test mode all implemented in Phase 16. Phase 19 focuses on: (a) per-user test mode flag, (b) parse transparency display, (c) onboarding flow, (d) account deletion.

2. **Multi-tenant data isolation is solid.** All tables have userId FK and RLS; all query functions use getPrismaForUser(userId) + WHERE filters. No cross-user data leakage detected in Phase 16 verification.

3. **Onboarding is the biggest new feature.** Guided 3-step flow (YNAB connect → forwarding address → done) is a differentiator. Email provider detection is simple (domain regex) but needs instruction templates per provider.

4. **Account deletion needs careful implementation.** Prisma cascading is in place; phase needs to: (1) add delete endpoint, (2) add confirmation UI, (3) send deletion notification email, (4) verify no orphaned data remains.

5. **Public homepage is required but light.** Just needs to explain product value, show how it works (email → YNAB), have signup CTA. Can reuse existing shadcn/ui components.

6. **Test framework is ready.** Vitest 4.x with 27+ existing tests from Phase 16-18; Phase 19 adds ~8 test files for dashboard/onboarding/account features.

---

**RESEARCH COMPLETE — Ready for planning.**
