# Phase 13: Admin UI Shell + Dashboard + Log Viewer - Research

**Researched:** 2026-03-27
**Domain:** Next.js 14 App Router server components with Prisma queries, inline-styled admin UI
**Confidence:** HIGH

## Summary

Phase 13 builds the admin dashboard and activity log viewer on top of the Phase 12 ActivityLog model and Phase 11 authentication. The app already has an authenticated `(dashboard)` route group with a layout (header + logout). The dashboard page is a placeholder that needs to be replaced with real stats and a log viewer.

The UI uses **inline CSS objects** throughout (no Tailwind, no CSS modules). The SetupWizard establishes the design language: `-apple-system` font, `#111827`/`#2563eb`/`#f9fafb` palette, `0.875rem` body text, `6px` border radius.

## Architecture Decisions

### Server Components for Data Fetching
The dashboard and log viewer should be **Server Components** (default in App Router). They can query Prisma directly without API routes. This is simpler and faster than client-side fetching.

### Log Viewer: Server Component + Client Interactivity
- The log list page uses URL search params for filters (status, date range, page number)
- Filtering updates the URL, triggering a server-side re-render with new query params
- Row expansion uses a client component for toggle state
- No SWR/React Query needed — standard Next.js patterns

### Navigation
The dashboard layout needs nav links. Add a simple nav bar below the header:
- **Dashboard** (`/`) — stats overview
- **Activity Log** (`/logs`) — filterable log viewer

### Pagination
Use offset-based pagination with `skip`/`take` in Prisma. 20 entries per page. Page number in URL search params (`?page=2`).

## Phase Requirements

| ID | Description | Implementation |
|----|-------------|----------------|
| DASH-01 | Emails this week + success rate | Server component querying ActivityLog with `receivedAt >= startOfWeek`, count by status |
| DASH-02 | Last transaction summary | `findFirst` where `status='success'`, `orderBy: {createdAt: 'desc'}`, display parseResult/ynabResult |
| DASH-03 | Webhook URL with copy button | Derive from request headers (`x-forwarded-host`), client component for copy |
| LOG-05 | Log UI with filters + pagination | `/logs` page with status filter, date range, skip/take pagination |
| LOG-06 | Expandable request trace per row | Client component toggling detail view with rawBody, parseResult, ynabResult, errors |

## File Structure

```
src/app/(dashboard)/
├── layout.tsx           # (existing) Add nav links
├── page.tsx             # (modify) Dashboard with stats
├── logs/
│   └── page.tsx         # (new) Activity log viewer
```

Supporting:
```
src/lib/activity-log-queries.ts  # (new) Prisma queries for dashboard stats + log listing
```

## Key Patterns

### Webhook URL derivation (DASH-03)
```typescript
import { headers } from 'next/headers';

async function getWebhookUrl() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}/api/webhook`;
}
```

### Dashboard stats query (DASH-01)
```typescript
const startOfWeek = new Date();
startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
startOfWeek.setHours(0, 0, 0, 0);

const thisWeek = await prisma.activityLog.findMany({
  where: { receivedAt: { gte: startOfWeek } },
  select: { status: true },
});
const total = thisWeek.length;
const successes = thisWeek.filter(e => e.status === 'success').length;
const rate = total > 0 ? Math.round((successes / total) * 100) : 0;
```

### Log listing with filters (LOG-05)
```typescript
const PAGE_SIZE = 20;

async function getActivityLogs(params: {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
}) {
  const where: Prisma.ActivityLogWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.from || params.to) {
    where.receivedAt = {};
    if (params.from) where.receivedAt.gte = new Date(params.from);
    if (params.to) where.receivedAt.lte = new Date(params.to + 'T23:59:59');
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: ((params.page ?? 1) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { logs, total, pageSize: PAGE_SIZE };
}
```
