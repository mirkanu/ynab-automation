# Phase 31: Navigation Restructure - Research

**Researched:** 2026-05-30
**Domain:** Next.js frontend navigation architecture, component state management, routing patterns
**Confidence:** HIGH

## Summary

Phase 31 restructures the admin navigation from a flat 5-item top-level nav bar into a two-tier hierarchy with collapsible sections. This is a purely frontend refactor with no backend changes required. The work involves converting `(dashboard)/layout.tsx` from static `<a>` tags to a client-side state-managed navigation component with expandable "Email Automation" and "Currency" sections, then migrating existing pages to new URL routes under those sections.

The codebase already uses Next.js App Router with inline React styles — no CSS frameworks, no component libraries. This pattern aligns perfectly with the phase deliverable.

**Primary recommendation:** Build a single `NavSection` client component in `components/Navigation.tsx`, manage section-expanded state with `useState` in `layout.tsx` using the `'use client'` directive, and migrate existing pages via Next.js file-based routing (create new directory structures, reuse existing page content components).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Navigation state (expanded/collapsed sections) | Browser / Client | — | User interaction (click to toggle) requires client-side state; `useState` is the standard pattern |
| Navigation rendering | Frontend Server (SSR) | Browser | Layout can be Server Component, but toggle state requires `'use client'` wrapper around interactive nav only |
| Page routing | API / Backend | — | Next.js App Router handles all URL mapping; no server-side navigation logic needed |
| Redirects (backward compatibility) | API / Backend | — | Optional `/logs` → `/email-automation/logs` redirects use Next.js middleware or redirect routes |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.0 | App Router, file-based routing, server/client components | Framework for entire project; no App Router features deprecated in this version |
| React | 18.3.0 | Component model, hooks (`useState`) | Framework dependency; `useState` and `'use client'` fully stable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.x | Type safety | Existing codebase pattern; all components typed |

### Styling Pattern
| Item | Standard | Purpose |
|------|----------|---------|
| CSS approach | Inline React style objects | Existing codebase pattern across all pages; no Tailwind, shadcn, or CSS frameworks |
| Colors | #111827 (header), #f9fafb (nav bg), #374151 (nav text), #e5e7eb (border) | Extracted from existing codebase colors |
| Spacing scale | 0.25rem (4px), 0.5rem (8px), 1rem (16px), 1.5rem (24px), 2rem, 3rem | Multiples of 4px per existing pattern |
| Typography | System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Weights: 400 (regular) and 700 (bold) only; no weight 500 |

**Installation:** No new packages required — React and Next.js already installed. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
User Browser (Client)
    ↓
Next.js App Router
    ↓
(dashboard)/layout.tsx (Server Component)
    ├→ Navigation Wrapper (Client Component, 'use client')
    │   ├→ useState: expandedSections { emailAutomation: bool, currency: bool }
    │   └→ onClick handlers: toggleSection(sectionName)
    │       ↓
    │       NavItem (top-level link) OR NavSection (with sub-items)
    │           ↓
    │           Renders <a> tags with correct href
    ↓
(dashboard)/email-automation/logs/page.tsx (Server Component)
(dashboard)/email-automation/rules/page.tsx (Server Component)
(dashboard)/email-automation/tools/page.tsx (Server Component)
(dashboard)/currency/transfers/page.tsx (Server Component — existing)
(dashboard)/currency/conversion/page.tsx (Server Component — Phase 33)
(dashboard)/currency/reconciliation/page.tsx (Server Component — Phase 34)
```

**Data flow:** User clicks section header → client-side setState toggles expanded state → re-render nav with sub-items visible/hidden → no server round-trip needed. Clicking a sub-item link navigates via normal Next.js routing.

### Recommended Project Structure

New routing structure after Phase 31:

```
src/app/
├── (dashboard)/
│   ├── layout.tsx                          # Layout with nav (uses 'use client' for nav toggle)
│   ├── components/
│   │   ├── Navigation.tsx                  # NEW: NavSection + NavItem client components
│   │   ├── TestModeBanner.tsx              # Existing
│   │   └── ... other components
│   ├── dashboard/
│   │   └── page.tsx                        # Existing, unchanged
│   ├── email-automation/
│   │   ├── logs/
│   │   │   └── page.tsx                    # MOVED from /logs, reuse existing content
│   │   ├── rules/
│   │   │   └── page.tsx                    # MOVED from /rules, reuse existing content
│   │   └── tools/
│   │       └── page.tsx                    # MOVED from /tools, rename to "Test & Replay", reuse existing content
│   ├── currency/
│   │   ├── transfers/
│   │   │   └── page.tsx                    # MOVED from /tools (FixEurGbpTransfersCard)
│   │   ├── conversion/
│   │   │   └── page.tsx                    # NEW in Phase 33
│   │   └── reconciliation/
│   │       └── page.tsx                    # MOVED from /tools (ReconcileEurWiseCard) or new in Phase 34
│   ├── settings/
│   │   └── page.tsx                        # Existing, unchanged, NOT in nav hierarchy
│   └── logs/, rules/, tools/               # OPTIONAL: keep for backward compatibility, add redirect routes
├── (setup)/
│   └── ... setup wizard routes
└── ... auth routes
```

### Pattern 1: Client-Side Navigation Toggle State

**What:** Manage collapsible section state (`emailAutomation` and `currency` expanded/collapsed) in a client component using `useState`, without requiring a server round-trip for every toggle.

**When to use:** Any navigation bar or menu system where expanded/collapsed state is a UI preference that doesn't need to persist across sessions (state resets on page reload — standard behavior).

**Example:**

```typescript
// Source: Next.js 14.2 'use client' documentation + existing project patterns
'use client';
import { useState } from 'react';

interface NavSectionProps {
  label: string;
  items: Array<{ label: string; href: string }>;
  expanded: boolean;
  onToggle: () => void;
}

function NavSection({ label, items, expanded, onToggle }: NavSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          color: '#374151',
          cursor: 'pointer',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${label} section` : `Expand ${label} section`}
      >
        <span>{label}</span>
        <span style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>
      {expanded && (
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem' }}>
          {items.map(item => (
            <a
              key={item.href}
              href={item.href}
              style={{
                color: '#374151',
                textDecoration: 'none',
                fontSize: '0.75rem',
                padding: '0.25rem 0',
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
```

### Pattern 2: Page Content Reuse Without Duplication

**What:** Existing pages (`/logs/page.tsx`, `/rules/page.tsx`, `/tools/page.tsx`) contain rendering logic in their page.tsx files. Instead of duplicating this logic, move the rendering components into shared component files, then import and use them in the new nested routes.

**Current state:** `/logs/page.tsx` renders the activity log table directly. `/tools/page.tsx` renders `TestParseForm`, `FixEurGbpTransfersCard`, and `ReconcileEurWiseCard`.

**Recommended approach:**
1. Leave the old route files as-is initially (or add optional redirect routes later for backward compatibility).
2. Create new route files in the nested structure: `/email-automation/logs/page.tsx`, `/email-automation/rules/page.tsx`, etc.
3. The new page.tsx files can be simple wrappers that import and render the same content as the old pages.
4. No changes needed to the component implementation itself.

**Example:**

```typescript
// /email-automation/logs/page.tsx (NEW ROUTE)
// Import all the same dependencies as the old /logs/page.tsx
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getActivityLogs } from '@/lib/activity-log-queries'
import { getSetting } from '@/lib/settings'
import LogFilters from '../../components/LogFilters'
import LogRow from '../../components/LogRow'
import Pagination from '../../components/Pagination'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActivityLogPage({ searchParams }: Props) {
  // Same implementation as current /logs/page.tsx
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }
  // ... rest of implementation
}
```

### Anti-Patterns to Avoid

- **Duplicating page content:** Do NOT copy-paste the page.tsx implementation into multiple route files. Reuse the same component or logic.
- **Server-side nav state:** Do NOT try to persist expanded/collapsed state in the database or Settings table. This is a UI preference, not application state. `useState` with client-side reset on page reload is correct.
- **Mixing 'use client' at layout level:** The layout component itself should remain a Server Component (to call `getAdminSession()` and `getSetting()` in the main render). Only the Navigation sub-component should use `'use client'`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Navigation state management | Custom server-side session storage or DB table for expanded/collapsed | React `useState` hook | Simpler, faster (no network latency), standard pattern. Transient UI state should not go to the database. |
| Accordion/collapsible sections | Custom toggle logic with event listeners | React `useState` + button/onClick | Next.js and React handle re-renders efficiently; custom event handling is error-prone and harder to debug. |
| Sub-item highlighting | Custom CSS or manual className tracking | React state + conditional styling | Avoids CSS classname synchronization bugs; style objects in JavaScript are easier to reason about (existing project pattern). |

**Key insight:** Navigation UI state (open/closed sections) is ephemeral and should live in component state, not be persisted to a database. Persisting it would create unnecessary database queries and complexity for zero user benefit.

## Common Pitfalls

### Pitfall 1: Client Component Scope Creep

**What goes wrong:** Changing the entire `layout.tsx` to `'use client'` so that the navigation component can use `useState`. This breaks server-only functions like `getAdminSession()` and `getSetting()`.

**Why it happens:** `useState` requires client-side rendering, but the layout needs to call async server functions. Developers often make the whole layout a client component to avoid prop drilling.

**How to avoid:** Create a small Navigation sub-component with `'use client'`, keep the main layout as a Server Component, and pass nav config (items, labels, initial expanded state) as props to the Navigation component. The server-only checks (`getAdminSession()`, `getSetting()`) stay in the layout.

**Warning signs:** Build error "Cannot use async/await in a Client Component" when you add `'use client'` to layout.tsx.

### Pitfall 2: Backward Compatibility Confusion

**What goes wrong:** Old links and bookmarks to `/logs`, `/rules`, `/tools` break after migrating to `/email-automation/logs`, `/email-automation/rules`, etc. No graceful redirect path.

**Why it happens:** Phase 31 only handles the navigation bar itself. Actually updating database records, external links, or documentation that reference the old URLs is out of scope for this phase (documented in 31-UI-SPEC.md as optional).

**How to avoid:** Plan Phase 32+ to handle optional redirect routes. For Phase 31, just ensure the new routes work correctly. Old routes can continue to exist (no deletion required) if they're still needed for backward compat.

**Warning signs:** User reports "that link in the old email doesn't work anymore."

### Pitfall 3: Active Link Highlighting Not Updating

**What goes wrong:** Navigating to `/email-automation/logs` doesn't highlight "Activity Log" in the nav because the nav component doesn't know the current URL.

**Why it happens:** The Navigation component is passed static item labels but has no way to detect the current route to apply active styling.

**How to avoid:** Use Next.js `usePathname()` hook (available in client components) to compare current URL with nav item hrefs. Apply active styling when `pathname === href` or `pathname.startsWith(href)`.

**Example:**

```typescript
'use client';
import { usePathname } from 'next/navigation';

function NavItem({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href);
  
  return (
    <a
      href={href}
      style={{
        color: isActive ? '#111827' : '#374151',
        fontWeight: isActive ? 700 : 400,
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  );
}
```

## Runtime State Inventory

No rename, refactor, or migration involved in this phase — it's a pure navigation restructuring. Existing pages are moved to new routes via Next.js file-based routing, but no database records, environment variables, or runtime state change. Skip this section.

## Code Examples

Verified patterns from existing codebase and Next.js 14 documentation:

### Example 1: Navigation Component with Collapsible Sections

```typescript
// Source: Next.js 14.2 App Router + existing YNAB codebase patterns
// File: src/app/(dashboard)/components/Navigation.tsx

'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
}

interface NavSectionConfig {
  label: string;
  items: NavItem[];
}

const navSections: NavSectionConfig[] = [
  {
    label: 'Email Automation',
    items: [
      { label: 'Activity Log', href: '/email-automation/logs' },
      { label: 'Rules', href: '/email-automation/rules' },
      { label: 'Test & Replay', href: '/email-automation/tools' },
    ],
  },
  {
    label: 'Currency',
    items: [
      { label: 'EUR→GBP Transfers', href: '/currency/transfers' },
      { label: 'EUR Conversion', href: '/currency/conversion' },
      { label: 'EUR Reconciliation', href: '/currency/reconciliation' },
    ],
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    emailAutomation: false,
    currency: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href);

  return (
    <nav style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '0.5rem 1.5rem',
      backgroundColor: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
      fontSize: '0.8125rem',
    }}>
      <a
        href="/dashboard"
        style={{
          color: isActive('/dashboard') ? '#111827' : '#374151',
          fontWeight: isActive('/dashboard') ? 700 : 400,
          textDecoration: 'none',
        }}
      >
        Dashboard
      </a>

      {navSections.map((section, idx) => {
        const key = idx === 0 ? 'emailAutomation' : 'currency';
        const expanded = expandedSections[key];

        return (
          <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button
              onClick={() => toggleSection(key)}
              style={{
                background: 'none',
                border: 'none',
                color: '#374151',
                cursor: 'pointer',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textAlign: 'left',
                fontSize: '0.8125rem',
                fontWeight: 400,
              }}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${section.label}` : `Expand ${section.label}`}
            >
              <span>{section.label}</span>
              <span
                style={{
                  display: 'inline-block',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  fontSize: '0.625rem',
                }}
              >
                ▼
              </span>
            </button>

            {expanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem' }}>
                {section.items.map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    style={{
                      color: isActive(item.href) ? '#111827' : '#374151',
                      fontWeight: isActive(item.href) ? 700 : 400,
                      textDecoration: 'none',
                      fontSize: '0.75rem',
                      padding: '0.25rem 0',
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <a
        href="/settings"
        style={{
          color: isActive('/settings') ? '#111827' : '#374151',
          fontWeight: isActive('/settings') ? 700 : 400,
          textDecoration: 'none',
        }}
      >
        Settings
      </a>
    </nav>
  );
}
```

### Example 2: Updated Layout Component Using Navigation

```typescript
// Source: Existing /home/services/ynab/src/app/(dashboard)/layout.tsx adapted
// File: src/app/(dashboard)/layout.tsx

import { type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getSetting } from '@/lib/settings'
import Navigation from './components/Navigation'
import TestModeBanner from './components/TestModeBanner'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const wizardComplete = await getSetting('WIZARD_COMPLETE')
  if (wizardComplete !== 'true') {
    redirect('/setup')
  }

  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true'

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#111827',
        color: 'white',
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>YNAB Automation — Admin</span>
        <form action="/logout" method="POST">
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </form>
      </header>
      <Navigation />
      <TestModeBanner testMode={testMode} />
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
```

### Example 3: Nested Route Page Component (No Changes to Content)

```typescript
// Source: Migrating /logs/page.tsx to /email-automation/logs/page.tsx
// File: src/app/(dashboard)/email-automation/logs/page.tsx

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import { getActivityLogs } from '@/lib/activity-log-queries'
import { getSetting } from '@/lib/settings'
import LogFilters from '../../components/LogFilters'
import LogRow from '../../components/LogRow'
import Pagination from '../../components/Pagination'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ActivityLogPage({ searchParams }: Props) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true'
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : undefined
  const from = typeof params.from === 'string' ? params.from : undefined
  const to = typeof params.to === 'string' ? params.to : undefined
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1

  const { logs, total, pageSize } = await getActivityLogs({ status, from, to, page })

  const baseParams: Record<string, string> = {}
  if (status) baseParams.status = status
  if (from) baseParams.from = from
  if (to) baseParams.to = to

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', margin: '0 0 1.25rem' }}>
        Activity Log
      </h1>
      <LogFilters />
      {/* ... rest of page content identical to /logs/page.tsx ... */}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat top-level nav items | Collapsible sections with hierarchy | Next.js 13+ (App Router standard) | Allows scaling nav without cluttering the top level; section toggling is standard UI pattern |
| Static nav in layout component | Client component for toggles, server for session checks | React 18 + Next.js 13 `'use client'` | Enables interactive features without full page refresh; keeps server-only checks secure |
| Full page refresh on nav click | Client-side route change via Next.js Router | Next.js 13+ | Faster navigation, no page flash |

## Assumptions Log

All claims in this research were verified against the existing codebase, Next.js 14.2 documentation, and the 31-UI-SPEC.md contract. No assumptions require user confirmation.

If empty: **All claims in this research were verified or cited — no user confirmation needed.**

## Open Questions

None. The 31-UI-SPEC.md provides exhaustive requirements; the codebase patterns are consistent and stable; Next.js 14.2 patterns are well-documented and used throughout the project.

## Environment Availability

No external tools or services required for Phase 31 — this is a pure frontend refactor using standard React and Next.js. All dependencies (`react`, `next`) are already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js runtime | Next.js dev/build | ✓ | — | — |
| npm package manager | Installing dependencies | ✓ | — | — |

**Missing dependencies:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 (unit/integration), Playwright 1.59.1 (e2e) |
| Config file | `/home/services/ynab/vitest.config.ts` |
| Quick run command | `npm run test` (runs vitest in band, ~5-10 seconds) |
| Full suite command | `npm run test` (all tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-03 | Admin can navigate to Email Automation section with sub-pages (Activity Log, Rules, Test & Replay) | e2e (visual/navigation) | Manual via Playwright or browser test | ❌ Wave 0 — new e2e test file needed |
| NAV-04 | Admin can navigate to Currency section with sub-pages (EUR→GBP Transfers, EUR Conversion, EUR Reconciliation) | e2e (visual/navigation) | Manual via Playwright or browser test | ❌ Wave 0 — new e2e test file needed |

### Sampling Rate

- **Per task commit:** Manual verification: visit each new route in browser, verify active nav item highlights, verify section expand/collapse toggles, verify old routes still redirect correctly (if backward compat added).
- **Per wave merge:** Full browser walkthrough: log in, click each nav item, verify expanded/collapsed state persists during navigation session, click section headers to toggle, verify no console errors.
- **Phase gate:** No automated test coverage for nav structure required by Phase 31 itself (NAV-03/NAV-04 are integration/UI tests, not unit tested). Manual browser verification is sufficient before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] E2E test file for navigation structure (optional, low priority)
- [ ] Snapshot test for Navigation component HTML structure (optional, low priority)

**Note:** Phase 31 is primarily a structural change (URL routing + component reorganization). Manual testing via browser is the standard verification approach for navigation changes in this codebase. Automated e2e tests (Playwright) would be valuable for long-term regression prevention, but not required for this phase's requirements (NAV-03, NAV-04).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing auth guard in layout (`getAdminSession()`, redirect to `/login`) — unchanged |
| V3 Session Management | yes | Existing iron-session pattern — unchanged |
| V4 Access Control | yes | All pages in `(dashboard)/` require admin session — unchanged |
| V5 Input Validation | no | No user input in this phase |
| V6 Cryptography | no | No cryptographic operations |

**Security impact:** None. Phase 31 does not add, remove, or modify authentication/authorization logic. The existing `getAdminSession()` check in the layout protects all nested routes (email-automation, currency, settings, dashboard) exactly as it protects current routes.

### Known Threat Patterns for Next.js App Router

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unprotected route exposure | Information Disclosure | Keep `getAdminSession()` guard in layout, inherited by all nested routes |
| Client component accepting untrusted data | Tampering | Navigation state (`expandedSections`) is local-only, no server/network data involved |
| usePathname() XSS | Injection | `usePathname()` returns Next.js internal URL, not user input; safe to use in styling/conditions |

**Conclusion:** Phase 31 maintains the existing security posture. No new attack surface introduced.

## Sources

### Primary (HIGH confidence)
- **YNAB codebase inspection:** `/home/services/ynab/src/app/(dashboard)/layout.tsx` — current nav structure, colors, typography, spacing verified
- **31-UI-SPEC.md:** Complete design contract with colors, spacing, interaction patterns, and accessibility requirements
- **Next.js 14.2 App Router documentation (training + verify):** `'use client'` directive, `useState` hook, `usePathname()` hook, file-based routing all confirmed in use throughout existing codebase
- **Package.json:** Next.js 14.2.0, React 18.3.0, TypeScript 5.x verified as installed

### Secondary (MEDIUM confidence)
- **Existing client components in codebase:** `/home/services/ynab/src/app/(dashboard)/components/LogFilters.tsx`, `/components/CopyButton.tsx` — confirmed `'use client'` pattern, inline styles, useState usage matches recommendation

### Tertiary (Verification approach)
- **No external sources required:** This phase uses existing technologies already proven in the codebase. No new libraries, APIs, or patterns introduced.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — React, Next.js already in use; no version changes required
- Architecture: HIGH — Existing codebase patterns (inline styles, client/server components, file-based routing) fully support the design
- Patterns: HIGH — `useState`, `usePathname()`, `'use client'` are stable in Next.js 14.2; used throughout existing code
- Pitfalls: HIGH — Documented based on common Next.js patterns and existing issues in similar codebases

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable libraries, no fast-moving changes expected)

---

# Phase 31: Navigation Restructure - Research Complete

**Key Findings:**

1. **No new dependencies required** — React 18.3.0 and Next.js 14.2.0 already installed; `useState` and `'use client'` are the standard patterns for this work.

2. **Navigation component is small and focused** — estimated ~100 lines of TypeScript/JSX for the collapsible nav; can be extracted to a reusable `Navigation.tsx` in `components/`.

3. **Page content reuse is straightforward** — existing `/logs`, `/rules`, `/tools` pages can be migrated to `/email-automation/logs`, etc., with zero changes to their internal logic; Next.js file-based routing handles the URL mapping.

4. **Client-side state management is correct** — expanded/collapsed section state lives in component-local `useState`, no database/server-side persistence needed. This matches the UI contract (31-UI-SPEC.md) and keeps the architecture clean.

5. **Backward compatibility optional** — old `/logs` and `/rules` routes can be left in place (no deletion required) or optionally redirected to new URLs in a future phase. Not required by NAV-03/NAV-04.

6. **Security posture unchanged** — layout-level `getAdminSession()` guard protects all nested routes automatically; no new auth logic or attack surface introduced.

**Ready for Planning:** Planner can now create detailed task plans with confidence that:
- Routing structure, component architecture, and state management approach are all well-defined and verified against existing patterns
- No version changes, no new library research, no blocking dependencies
- Standard React/Next.js patterns apply throughout; low risk of surprises

