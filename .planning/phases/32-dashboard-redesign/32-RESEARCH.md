# Phase 32: Dashboard Redesign - Research

**Researched:** 2026-05-30
**Domain:** Next.js App Router dashboard UI + PostgreSQL data access + client-side polling
**Confidence:** HIGH

---

## Summary

Phase 32 replaces the current YNAB dashboard with a two-panel layout: an Email Automation panel (existing data, reshuffled) and a Currency panel (new data that doesn't yet exist in any DB table). The UI-SPEC.md provides a complete pixel contract. No component library is used — everything is inline React style objects, consistent with the existing codebase.

The Email Automation panel is straightforward: `getDashboardStats()` in `src/lib/activity-log-queries.ts` already returns exactly what the panel needs (week stats, last transaction). This function needs a one-field addition: the timestamp of the last email received (`lastEmailReceivedAt`), which is directly accessible from `ActivityLog.receivedAt`.

The Currency panel is the hard part. No tool-run metadata is stored anywhere today. The two tool API routes (`/api/tools/fix-eur-transfers` POST and `/api/tools/reconcile-eur-wise` POST) return results to the caller but write nothing to the database. There is no `ToolRun` table or equivalent. Phase 32 must decide whether to persist tool-run outcomes in the `Setting` table (lightweight, using namespaced keys like `LAST_RUN_TRANSFER_FIX`) or add a new `ToolRun` model to the Prisma schema. The Setting table approach avoids a schema migration; the ToolRun table approach is cleaner and extensible for Phase 34 (workflow UI needs the same data).

The "auto-update within 5 seconds" requirement (DASH-04) points to a client-side polling interval on the Currency panel. The existing tool cards (`FixEurGbpTransfersCard`, `ReconcileEurWiseCard`) are client components that call the tool API routes — the dashboard Currency panel can poll a new `GET /api/dashboard/currency-status` endpoint every 5 seconds, or the tool cards themselves can dispatch a custom event that the dashboard listens to. For a single-admin app, `setInterval` polling is the correct choice.

**Primary recommendation:** Store tool-run metadata in the `Setting` table using namespaced keys (no migration required). Create a `getLastToolRuns()` query function. Create a `GET /api/dashboard/currency-status` route. Convert the Currency panel to a `'use client'` component with a 5-second polling interval.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email Automation panel data | API / Backend | — | `getDashboardStats()` is a server-side Prisma query; panel is a server component |
| Currency panel data (last-run metadata) | API / Backend | Database / Storage | New query reads from Setting table; tool routes write on POST |
| Currency panel real-time refresh | Browser / Client | API / Backend | `setInterval` polling of a GET endpoint; panel is a client component |
| Tool-run metadata persistence | Database / Storage | — | Written by tool API routes on success; read by dashboard query |
| Dashboard page layout | Frontend Server (SSR) | Browser / Client | Page is server component; Currency panel upgrades to client component |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-03 | Dashboard Email Automation panel shows last email processed timestamp, success rate, and last YNAB transaction created | `getDashboardStats()` provides week stats + last transaction; add `lastEmailReceivedAt` from `ActivityLog.receivedAt` |
| DASH-04 | Dashboard Currency panel shows last transfer-fix run (date + pairs fixed), last EUR conversion run (date + transactions converted), and last reconciliation (date + gap amount) | Requires new tool-run persistence layer (Setting table keys) and new query function |
</phase_requirements>

---

## Current Dashboard State

**File:** `src/app/(dashboard)/dashboard/page.tsx` [VERIFIED: file read]

Current dashboard renders:
- Two clickable stat cards ("This Week" total, "Success Rate") — grid, `repeat(auto-fit, minmax(180px, 1fr))`
- "Last Transaction" card (retailer + amount + processed-at timestamp)
- "Forwarding Address" card (from Phase 28, must be preserved below the two new panels)

**Auth pattern:** Server component, checks `getAdminSession()` and redirects to `/login` if not logged in. This pattern continues unchanged in Phase 32.

**Card style object** (used throughout codebase, defined inline in `dashboard/page.tsx`):
```javascript
const card = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}
```
[VERIFIED: file read]

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | installed | SSR server components + client components | Project standard |
| React (useState, useEffect) | installed | Client-side state + polling via `setInterval` | Project standard |
| Prisma | installed | PostgreSQL access via `prisma.setting`, `prisma.activityLog` | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | installed | Type safety on query return shapes | All new functions |

**No new packages required.** [VERIFIED: package.json + codebase read]

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard page.tsx (server component)
  │
  ├── getDashboardStats()            → ActivityLog table (Prisma)
  │     returns: thisWeek stats + lastTransaction + lastEmailReceivedAt
  │
  ├── EmailAutomationPanel (server component, inline JSX)
  │     renders from getDashboardStats() data
  │
  ├── CurrencyPanel (client component, 'use client')
  │     on mount + every 5s: GET /api/dashboard/currency-status
  │         └── getLastToolRuns()   → Setting table (Prisma)
  │               keys: LAST_RUN_TRANSFER_FIX, LAST_RUN_EUR_CONVERSION, LAST_RUN_RECONCILIATION
  │
  └── Forwarding Address card (unchanged from Phase 28)
```

```
Tool routes (existing, to be extended):
  POST /api/tools/fix-eur-transfers
    → on success: saveSettings({ LAST_RUN_TRANSFER_FIX: JSON.stringify({ date, pairsFixed, status }) })

  POST /api/tools/reconcile-eur-wise
    → on success: saveSettings({ LAST_RUN_RECONCILIATION: JSON.stringify({ date, gapAmount, status }) })

  (POST /api/tools/eur-conversion — Phase 33, not in scope)
    → on success: saveSettings({ LAST_RUN_EUR_CONVERSION: JSON.stringify({ date, converted, status }) })

New route:
  GET /api/dashboard/currency-status
    → calls getLastToolRuns()
    → returns { transferFix, eurConversion, reconciliation } (each: date | null, count | null, gapAmount | null)
```

### Recommended Project Structure

No structural changes. New files:

```
src/
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       └── currency-status/
│   │           └── route.ts          # new GET endpoint
│   └── (dashboard)/
│       └── dashboard/
│           ├── page.tsx              # modified (Email Automation panel + layout)
│           └── CurrencyPanel.tsx     # new 'use client' component
└── lib/
    └── activity-log-queries.ts       # modified: add lastEmailReceivedAt to getDashboardStats
    └── tool-run-queries.ts           # new: getLastToolRuns() + ToolRunData types
```

### Pattern 1: Tool-Run Metadata in Setting Table

**What:** Persist last-run outcome as a JSON string in an existing Setting row, keyed by tool name.
**When to use:** Avoiding schema migration; single-admin volume; data needed only for dashboard display.

```typescript
// Source: existing saveSettings pattern in src/lib/settings.ts [VERIFIED: file read]

// Written by tool route on success:
await saveSettings({
  LAST_RUN_TRANSFER_FIX: JSON.stringify({
    runAt: new Date().toISOString(),
    pairsFixed: succeeded.length,
    status: 'success',
  }),
})

// Read by getLastToolRuns():
const raw = await getSetting('LAST_RUN_TRANSFER_FIX')
const data = raw ? JSON.parse(raw) : null
```

**Why Setting table over new ToolRun model:**
- No Prisma migration required (no schema change, no `npx prisma migrate dev` step)
- Setting table already handles upsert by key — one call replaces the previous run record
- Phase 34 (currency workflow) needs "last run date" for status badges — same Setting keys serve both
- Downside: no run history (only latest run stored) — acceptable for Phase 32 requirement (shows last run only)

[ASSUMED] The planner may prefer a `ToolRun` Prisma model for run history. If so, a migration wave is needed before the UI wave.

### Pattern 2: Client-Side Polling for Currency Panel

**What:** `'use client'` component with `useEffect` + `setInterval` to poll `GET /api/dashboard/currency-status` every 5 seconds.
**When to use:** Single-admin app, no WebSocket infrastructure, "within 5 seconds" SLA.

```typescript
// Source: React docs pattern [ASSUMED — standard React useEffect pattern]
'use client';
import { useState, useEffect } from 'react';

export default function CurrencyPanel() {
  const [data, setData] = useState<ToolRunData | null>(null);

  useEffect(() => {
    function fetchStatus() {
      fetch('/api/dashboard/currency-status')
        .then(r => r.json())
        .then(setData)
        .catch(() => {}); // silent fail — panel shows stale data
    }

    fetchStatus(); // immediate on mount
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id); // cleanup on unmount
  }, []);

  // render panel using data...
}
```

**Why polling over WebSocket/SSE:** Single admin, no concurrent users, no real-time infrastructure exists. Polling is auditable, trivially debuggable, and zero infrastructure overhead.

### Pattern 3: getDashboardStats Extension

`getDashboardStats()` needs `lastEmailReceivedAt` added. It currently queries `ActivityLog.receivedAt` via the `lastSuccess` findFirst — the same query already has `receivedAt` in its select. This is a one-field addition to the existing query and interface.

```typescript
// Existing query in src/lib/activity-log-queries.ts [VERIFIED: file read]
// lastSuccess.receivedAt is already fetched — just surface it in the return shape

export interface DashboardStats {
  thisWeek: { total: number; successes: number; rate: number }
  lastEmailReceivedAt: Date | null  // ADD: from most recent ActivityLog row
  lastTransaction: { ... } | null
}
```

The "last email processed" timestamp should be the most recent `ActivityLog.receivedAt` regardless of status (not just successes). A separate `findFirst` ordered by `receivedAt desc` with no status filter is needed.

### Anti-Patterns to Avoid

- **Full page server-component for Currency panel:** Cannot auto-update without full page reload. Must split Currency panel to `'use client'`.
- **Polling from the page root:** Poll only within the CurrencyPanel component so EmailAutomationPanel (server-rendered) is unaffected.
- **Storing tool-run metadata in ActivityLog:** ActivityLog is for email processing events. Mixing currency tool runs into it conflates two different domains and breaks log filtering.
- **Invoking `router.refresh()` from tool cards on completion:** This would refresh the entire server component tree — correct but requires wiring props callbacks through multiple levels. Polling is simpler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polling state management | Custom event bus | `useEffect` + `setInterval` | Standard React pattern, no deps |
| JSON storage in DB | Custom blob table | `Setting` table JSON string | Already used for other serialised state |
| Date formatting | Custom formatter | `toLocaleDateString('en-GB', {...})` | Already used in existing dashboard |

---

## Common Pitfalls

### Pitfall 1: Currency Panel Renders Stale "Never run" on First Load
**What goes wrong:** Panel mounts and shows "Never run" for 5 seconds before first poll completes.
**Why it happens:** `useState(null)` initial state renders fallback copy immediately.
**How to avoid:** Fetch on mount synchronously inside `useEffect` (no delay before first call — `fetchStatus()` called immediately before `setInterval`).
**Warning signs:** "Never run" flashes then updates.

### Pitfall 2: Tool Routes Don't Persist Metadata on Partial Success
**What goes wrong:** Transfer fix finds 3 pairs, fixes 2, 1 fails — `LAST_RUN_TRANSFER_FIX` records `pairsFixed: 2` (correct) but the route must write the Setting even when `failed > 0`.
**How to avoid:** Write Setting metadata in the `finally` block after results are computed, not only in a success branch. Or write after computing `succeeded.length` regardless of `failed.length`.

### Pitfall 3: `useEffect` Cleanup Leak
**What goes wrong:** User navigates away before interval fires — interval keeps running, tries to `setData` on unmounted component (React warning).
**How to avoid:** Return `() => clearInterval(id)` from `useEffect` (shown in Pattern 2 above).

### Pitfall 4: getDashboardStats `lastEmailReceivedAt` Off-By-One
**What goes wrong:** Using `lastSuccess.receivedAt` as "last email processed" — this is the last *successful* email, not the last email received (which could be a failed parse).
**How to avoid:** Add a separate `findFirst` with `orderBy: { receivedAt: 'desc' }` and no status filter to get the true last-received timestamp.

### Pitfall 5: Forwarding Address Card Removed
**What goes wrong:** Rewriting the dashboard page accidentally drops the Forwarding Address card introduced in Phase 28.
**How to avoid:** UI-SPEC.md explicitly states "Do NOT remove or move — only panels above are in scope for Phase 32." Planner must include explicit preservation note.

---

## Code Examples

### getDashboardStats return shape extension

```typescript
// src/lib/activity-log-queries.ts [VERIFIED: file read — current shape]
export interface DashboardStats {
  thisWeek: { total: number; successes: number; rate: number }
  lastEmailReceivedAt: Date | null           // NEW
  lastTransaction: {
    retailer: string
    amount: number
    date: string
    receivedAt: Date
  } | null
}
```

### New getLastToolRuns function shape

```typescript
// src/lib/tool-run-queries.ts (new file)
export interface ToolRunEntry {
  runAt: string        // ISO string
  status: 'success' | 'error'
  pairsFixed?: number          // transfer fix only
  converted?: number           // eur conversion only
  gapAmount?: number           // reconciliation only
}

export interface LastToolRuns {
  transferFix: ToolRunEntry | null
  eurConversion: ToolRunEntry | null
  reconciliation: ToolRunEntry | null
}

export async function getLastToolRuns(): Promise<LastToolRuns> { ... }
```

### Setting key names (namespaced)

```
LAST_RUN_TRANSFER_FIX      → { runAt, pairsFixed, status }
LAST_RUN_EUR_CONVERSION    → { runAt, converted, status }
LAST_RUN_RECONCILIATION    → { runAt, gapAmount, status }
```

### New API route

```typescript
// src/app/api/dashboard/currency-status/route.ts
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { getLastToolRuns } from '@/lib/tool-run-queries'

export async function GET() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await getLastToolRuns()
  return NextResponse.json(data)
}
```

### Writing metadata from tool route (fix-eur-transfers POST)

```typescript
// After results computed, before returning response:
await saveSettings({
  LAST_RUN_TRANSFER_FIX: JSON.stringify({
    runAt: new Date().toISOString(),
    pairsFixed: succeeded.length,
    status: failed.length === 0 ? 'success' : 'partial',
  }),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stat cards (clickable, link to logs with filters) | Two structured panels with row layout | Phase 32 | Old clickable stat cards replaced; log links now accessible via nav |
| Tool-run metadata: none | Persisted in Setting table JSON | Phase 32 | Currency panel can display last-run outcome |

**Deprecated/outdated after Phase 32:**
- The two clickable stat cards (DASH-01 "This Week" + "Success Rate") are replaced by the Email Automation panel rows — the data moves, not disappears
- The standalone "Last Transaction" card is absorbed into the Email Automation panel

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting table is correct storage for tool-run metadata (vs. new ToolRun Prisma model) | Architecture Patterns | If planner prefers ToolRun model, a migration wave is needed before the UI wave |
| A2 | `setInterval` polling at 5s is the chosen real-time update mechanism | Architecture Patterns | UI-SPEC defers this to planner; WebSocket/SSE would require infrastructure not present |
| A3 | "Last email processed" timestamp = most recent ActivityLog.receivedAt regardless of status | Pitfall 4 / getDashboardStats | If it should be "last successfully processed email", the query changes |

---

## Open Questions

1. **Tool-run metadata storage: Setting table vs. new ToolRun model**
   - What we know: Setting table requires no migration; ToolRun model requires `prisma migrate dev` + new migration file
   - What's unclear: Phase 34 (workflow UI) will need last-run status badges — does it need run *history* (multiple rows) or only the latest? If history, ToolRun model is better now.
   - Recommendation: Decide before planning. For Phase 32 alone, Setting table is sufficient. If Phase 34 needs history, add ToolRun model now.

2. **EUR Conversion "Never run" state**
   - What we know: Phase 33 (EUR Conversion tool) doesn't exist yet. The dashboard will show "Never run" for this row until Phase 33 ships.
   - What's unclear: Should Phase 32 wire the EUR Conversion row at all, or omit it until Phase 33?
   - Recommendation: Wire the row now (renders "Never run" permanently until Phase 33 writes `LAST_RUN_EUR_CONVERSION`). This avoids touching the dashboard again in Phase 33.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 32 is purely code changes to Next.js files and PostgreSQL via existing Prisma connection. No new external tools, services, CLIs, or runtimes required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | none detected — inferred from package.json `"test": "vitest run"` |
| Quick run command | `npx vitest run src/lib/tool-run-queries.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-03 | `getDashboardStats()` returns `lastEmailReceivedAt` from most-recent ActivityLog row | unit | `npx vitest run src/lib/activity-log-queries.test.ts` | ✅ (extend existing) |
| DASH-03 | Email Automation panel renders correct fallback copy when no emails | manual | visual check at `/dashboard` | N/A |
| DASH-04 | `getLastToolRuns()` returns null for all tools when no Setting keys exist | unit | `npx vitest run src/lib/tool-run-queries.test.ts` | ❌ Wave 0 |
| DASH-04 | `getLastToolRuns()` parses Setting JSON correctly for each tool | unit | `npx vitest run src/lib/tool-run-queries.test.ts` | ❌ Wave 0 |
| DASH-04 | POST fix-eur-transfers writes LAST_RUN_TRANSFER_FIX to Setting | unit | `npx vitest run src/app/api/tools/fix-eur-transfers/route.test.ts` | ❌ Wave 0 |
| DASH-04 | POST reconcile-eur-wise writes LAST_RUN_RECONCILIATION to Setting | unit | `npx vitest run src/app/api/tools/reconcile-eur-wise/route.test.ts` | ❌ Wave 0 |
| DASH-04 | Currency panel shows updated data after tool run (polling) | manual | run fix-eur-transfers, observe dashboard | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/tool-run-queries.test.ts` — covers DASH-04 query functions
- [ ] `src/app/api/tools/fix-eur-transfers/route.test.ts` — covers Setting write on POST
- [ ] `src/app/api/tools/reconcile-eur-wise/route.test.ts` — covers Setting write on POST

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getAdminSession()` iron-session check on all new routes |
| V3 Session Management | no | No new session handling |
| V4 Access Control | yes | New `GET /api/dashboard/currency-status` must check `isLoggedIn` |
| V5 Input Validation | no | GET-only new endpoint; no user input |
| V6 Cryptography | no | No new secrets or crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated currency-status read | Information Disclosure | `getAdminSession()` guard on GET route — consistent with all existing tool routes |

---

## Sources

### Primary (HIGH confidence)
- `/home/services/ynab/src/app/(dashboard)/dashboard/page.tsx` — current dashboard structure verified by direct read
- `/home/services/ynab/src/lib/activity-log-queries.ts` — getDashboardStats shape and Prisma queries verified
- `/home/services/ynab/src/lib/settings.ts` — getSetting/saveSettings pattern verified
- `/home/services/ynab/prisma/schema.prisma` — data model verified (no ToolRun table, Setting table confirmed)
- `/home/services/ynab/src/app/(dashboard)/tools/FixEurGbpTransfersCard.tsx` — card styling and API call pattern
- `/home/services/ynab/src/app/(dashboard)/tools/ReconcileEurWiseCard.tsx` — card styling and API call pattern
- `/home/services/ynab/src/app/api/tools/fix-eur-transfers/route.ts` — POST response shape (no Setting write currently)
- `/home/services/ynab/src/app/api/tools/reconcile-eur-wise/route.ts` — POST response shape (no Setting write currently)
- `/home/services/ynab/.planning/phases/32-dashboard-redesign/32-UI-SPEC.md` — full layout contract

### Secondary (MEDIUM confidence)
- Vitest test pattern: inferred from existing `src/lib/activity-log-queries.test.ts` and `vi.mock('@/lib/db')` pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, verified from package.json and source files
- Architecture: HIGH — data model, API routes, and component patterns all verified from source; A1/A2/A3 assumptions are the only unknowns
- Pitfalls: HIGH — all derived from direct codebase inspection, not general knowledge

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable codebase; no fast-moving dependencies)
