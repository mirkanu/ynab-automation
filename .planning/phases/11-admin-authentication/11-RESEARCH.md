# Phase 11: Admin Authentication - Research

**Researched:** 2026-03-26
**Domain:** Next.js 14 App Router stateless cookie-based auth, single-password protection
**Confidence:** HIGH

## Summary

This phase adds a simple single-password admin area to an existing Next.js 14 App Router project. No user database or complex auth flows are needed — the entire session state lives in an encrypted httpOnly cookie keyed to one `ADMIN_PASSWORD` env var.

Two credible approaches exist: **iron-session** (encrypted session cookie, tiny abstraction layer) and **jose** (manual JWT encrypted with HS256, raw Web Crypto API). The official Next.js authentication docs explicitly recommend both iron-session and jose as the two canonical session management libraries. For a single-password scenario with no user identities, iron-session is the cleaner fit: less boilerplate, no JWT payload design required, and a first-class `getIronSession(cookies(), opts)` API that works identically in Server Actions, Route Handlers, and middleware.

The key architectural insight is that Next.js middleware runs in the **Edge runtime**, which means it cannot use Node.js `crypto`. iron-session v8 is compatible with the Edge runtime (it uses the Web Crypto API internally), and `getIronSession(cookies(), opts)` works directly in `middleware.ts` as confirmed by the official iron-session example repo.

**Primary recommendation:** Use iron-session v8 with `getIronSession`, a Server Action for login, a Route Handler for logout, and a `middleware.ts` for /admin/* route protection. Total surface area: ~5 files, zero database dependencies.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | /admin routes protected by single ADMIN_PASSWORD env var | iron-session `isLoggedIn` bool in session; middleware checks it for `/admin/:path*` |
| AUTH-02 | Cookie-based session persists after successful login | iron-session sets httpOnly encrypted cookie; default TTL 14 days |
| AUTH-03 | Login page at /admin/login with password field | App Router page at `src/app/admin/login/page.tsx`; Server Action handles comparison |
| AUTH-04 | Logout clears session and redirects to login | `session.destroy()` in a Route Handler or Server Action; redirect to /admin/login |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| iron-session | ^8.0.4 | Encrypted httpOnly cookie session | Officially recommended in Next.js auth docs; Edge-compatible; no DB needed; simple single-method API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| server-only | (built-in npm pkg) | Prevent session logic from leaking to client | Import at top of `lib/session.ts` to hard-fail if accidentally client-bundled |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| iron-session | jose (SignJWT/jwtVerify) | jose requires more boilerplate: encode secret, design JWT payload, write encrypt/decrypt helpers. Official docs use it for multi-user auth where you store userId in payload. Overkill here. |
| iron-session | Custom HMAC cookie | Would require implementing constant-time comparison, proper encoding, and signing by hand. Many edge cases. No benefit for a solo-developer project. |
| iron-session | next-auth / Auth.js | Massive overkill for a single password with no user identities. Adds OAuth providers, DB adapters, and complex config for zero gain. |

**Installation:**
```bash
npm install iron-session
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          # optional admin shell layout
│   │   ├── page.tsx            # admin dashboard (protected)
│   │   ├── login/
│   │   │   └── page.tsx        # /admin/login — login form (public)
│   │   └── logout/
│   │       └── route.ts        # POST /admin/logout — clears session
├── lib/
│   └── admin-session.ts        # getIronSession wrapper, session type, options
└── middleware.ts                # Edge middleware — protects /admin/* except /admin/login
```

### Pattern 1: Session Configuration in `lib/admin-session.ts`
**What:** Central module defining the SessionData type and SessionOptions. Imported by the login Server Action, logout Route Handler, and middleware.
**When to use:** Every time you need to read or write the session.
**Example:**
```typescript
// Source: https://github.com/vvo/iron-session/blob/main/examples/next/src/app/app-router-client-component-route-handler-swr/lib.ts
// and https://www.alexchantastic.com/revisiting-password-protecting-next

import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface AdminSessionData {
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET!, // min 32 chars
  cookieName: 'admin_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // iron-session default TTL is 14 days (1,209,540 seconds)
  },
};

// Use in Server Components, Server Actions, Route Handlers (NOT in middleware.ts)
export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, sessionOptions);
}
```

### Pattern 2: Login Server Action
**What:** A `'use server'` function that compares the submitted password to `ADMIN_PASSWORD` env var and sets `session.isLoggedIn = true`.
**When to use:** Called by the login form in `app/admin/login/page.tsx`.
**Example:**
```typescript
// src/app/admin/login/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD env var is not set');
  }

  if (password !== adminPassword) {
    return { error: 'Invalid password' };
  }

  const session = await getAdminSession();
  session.isLoggedIn = true;
  await session.save();

  redirect('/admin');
}
```

### Pattern 3: Logout Route Handler
**What:** A POST route handler that calls `session.destroy()` and redirects to /admin/login.
**When to use:** Triggered by a logout form/button on any admin page.
**Example:**
```typescript
// src/app/admin/logout/route.ts
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

export async function POST() {
  const session = await getAdminSession();
  session.destroy();
  return NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
}
```

### Pattern 4: Middleware Route Protection
**What:** `middleware.ts` at the project root that intercepts all `/admin/*` requests (except `/admin/login`) and redirects unauthenticated users.
**When to use:** Runs on every matching request before rendering — the outer security perimeter.

**CRITICAL:** In middleware, use `getIronSession` from iron-session directly with `cookies()` — the official iron-session example does this and confirms Edge runtime compatibility.

```typescript
// src/middleware.ts  (place at src/ root, not inside app/)
// Source: https://github.com/vvo/iron-session/blob/main/examples/next/src/middleware.ts

import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { type AdminSessionData, sessionOptions } from '@/lib/admin-session';

export async function middleware(request: NextRequest) {
  // Allow /admin/login through unauthenticated
  if (request.nextUrl.pathname === '/admin/login') {
    return NextResponse.next();
  }

  const session = await getIronSession<AdminSessionData>(
    cookies(),
    sessionOptions,
  );

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

### Anti-Patterns to Avoid
- **Storing the raw ADMIN_PASSWORD in the session cookie:** Never store the actual password in the cookie. Only store `isLoggedIn: true`. The password is only used for comparison at login time.
- **String equality with `===` without considering timing attacks:** For a single internal admin tool, this is acceptable. For public-facing auth, use `crypto.timingSafeEqual`. This project qualifies for simple string comparison.
- **Checking auth only in a layout.tsx:** Due to Next.js partial rendering, layouts don't re-run on client-side navigation. Middleware is the reliable gate.
- **Using `next-iron-session` (the old package):** That package is deprecated and unmaintained. The current package is `iron-session` (without `next-` prefix), version 8+.
- **Using iron-session's `withIronSessionApiRoute` or `withIronSessionSsr`:** These were removed in v8. Use `getIronSession` everywhere.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie encryption | Custom AES/HMAC | iron-session | Handles key derivation, MAC, IV, encoding correctly |
| Session expiry | Manual max-age tracking | iron-session TTL option | Gets cookie expiry right including renewal edge cases |
| Edge-compatible crypto | Custom Web Crypto wrappers | iron-session (built on Web Crypto) | Already tested in Edge runtime; no Node.js crypto dependency |

**Key insight:** Cookie encryption has many subtle failure modes (key derivation, padding, IV reuse, timing leaks). iron-session is battle-tested with 1M+ weekly downloads specifically for this problem.

## Common Pitfalls

### Pitfall 1: `cookies()` is async in Next.js 14+
**What goes wrong:** Calling `cookies()` without `await` returns a Promise, not the cookie store. `getIronSession` receives a Promise and silently creates an empty session.
**Why it happens:** Next.js made `cookies()` return a Promise starting around 14.1. Many blog posts still show the synchronous pattern.
**How to avoid:** Always `await cookies()` before passing to `getIronSession`.
```typescript
// WRONG (pre-14.1 pattern, breaks silently)
const session = await getIronSession(cookies(), sessionOptions);

// CORRECT
const cookieStore = await cookies();
const session = await getIronSession(cookieStore, sessionOptions);
```
**Warning signs:** Session appears to reset on every request even though `session.save()` is called.

### Pitfall 2: `IRON_SESSION_SECRET` must be at least 32 characters
**What goes wrong:** iron-session throws a runtime error if the password is shorter than 32 characters.
**Why it happens:** Enforced by the underlying `iron-webcrypto` library for sufficient key entropy.
**How to avoid:** Generate with `openssl rand -base64 32` and store in Railway environment variables.

### Pitfall 3: Redirect loop if middleware matches `/admin/login`
**What goes wrong:** Middleware redirects unauthenticated users to `/admin/login`, but `/admin/login` also matches the `/admin/:path*` pattern, causing an infinite redirect.
**Why it happens:** The matcher `/admin/:path*` matches `/admin/login`.
**How to avoid:** Add an explicit early return in middleware when `pathname === '/admin/login'`, OR use a negative lookahead in the matcher:
```typescript
export const config = {
  matcher: ['/admin/((?!login).*)'],
};
```
Or simply the conditional check at the top of the middleware function (simpler to read).

### Pitfall 4: Cookie not set on localhost without `secure: false`
**What goes wrong:** Session cookie is silently dropped in development because `secure: true` requires HTTPS.
**Why it happens:** Browsers reject `Secure` cookies on `http://localhost`.
**How to avoid:** `secure: process.env.NODE_ENV === 'production'` — already shown in Pattern 1.

### Pitfall 5: `session.destroy()` vs clearing cookie manually
**What goes wrong:** Manually deleting the cookie (`cookies().delete('admin_session')`) doesn't always work the same way as `session.destroy()` because iron-session may set the cookie with specific path/domain attributes.
**How to avoid:** Always use `session.destroy()` for logout — it handles the correct cookie deletion attributes.

### Pitfall 6: Using `cookies()` from `next/headers` vs `request.cookies` in middleware
**What goes wrong:** Some resources suggest reading `request.cookies.get(cookieName)?.value` and calling `unsealData` manually in middleware. This is the fallback pattern from older iron-session versions.
**Correct approach:** The official iron-session example uses `cookies()` from `next/headers` + `getIronSession` in middleware. This works because iron-session v8 is Edge-compatible. Use this approach for consistency across all contexts.

## Code Examples

### Generating the session secret
```bash
# Source: Official Next.js auth docs
openssl rand -base64 32
```

### Complete login page (minimal)
```typescript
// Source: iron-session official pattern adapted for single-password
// src/app/admin/login/page.tsx
import { loginAction } from './actions';

export default function LoginPage() {
  return (
    <form action={loginAction}>
      <label htmlFor="password">Admin Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <button type="submit">Log in</button>
    </form>
  );
}
```

### Using `useActionState` for login errors (React 18/19 pattern)
```typescript
// src/app/admin/login/page.tsx  — client component variant
'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action}>
      <input name="password" type="password" required />
      {state?.error && <p style={{ color: 'red' }}>{state.error}</p>}
      <button disabled={pending} type="submit">Log in</button>
    </form>
  );
}
```

### Logout button (form POST)
```typescript
// any admin page
export function LogoutButton() {
  return (
    <form action="/admin/logout" method="POST">
      <button type="submit">Log out</button>
    </form>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-iron-session` package | `iron-session` v8 package | v8.0.0 (2023) | Different package name; old package is abandoned |
| `withIronSessionApiRoute(handler, opts)` | `getIronSession(cookies(), opts)` | v8.0.0 | Simpler; single function for all contexts |
| Synchronous `cookies()` | `await cookies()` | Next.js ~14.1 | Must await; older blog posts will silently fail |
| Separate `/edge` import for middleware | Single `iron-session` import everywhere | v8.0.0 | No more conditional import paths |
| Pages Router API routes for auth | Server Actions + Route Handlers | Next.js 13+ | Native App Router patterns; no API routes needed for simple flows |

**Deprecated/outdated:**
- `next-iron-session`: Archived, do not use. The current package is `iron-session`.
- `withIronSessionApiRoute` / `withIronSessionSsr`: Removed in iron-session v8.
- `import { getIronSession } from 'iron-session/edge'`: Removed in v8; use base import.

## Open Questions

1. **Password comparison timing safety**
   - What we know: Simple `===` comparison is vulnerable to timing attacks in theory
   - What's unclear: Whether this matters for an internal admin tool on Railway
   - Recommendation: Use `===` for simplicity. If the app ever becomes public-facing with a known endpoint, consider `crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(stored))`

2. **Session TTL choice**
   - What we know: iron-session defaults to 14 days; can be overridden with `ttl` in SessionOptions
   - What's unclear: Project preference not specified in requirements
   - Recommendation: Accept the 14-day default. It satisfies AUTH-02 ("persists without re-login") without extra config.

3. **iron-session maintenance status**
   - What we know: v8.0.4 is the latest (released ~2024); no new versions in ~1 year; 1M+ weekly downloads; explicitly listed in official Next.js docs
   - What's unclear: Whether maintainer plans further updates
   - Recommendation: Stable enough for this use case. Official Next.js docs continue to recommend it as of March 2026.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1 |
| Config file | `/data/home/ynab/vitest.config.ts` (exists — `environment: 'node'`) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | middleware redirects unauthenticated requests to /admin/login | unit | `npm test -- src/lib/admin-session.test.ts` | ❌ Wave 0 |
| AUTH-01 | middleware passes authenticated requests through | unit | `npm test -- src/lib/admin-session.test.ts` | ❌ Wave 0 |
| AUTH-02 | `loginAction` sets `isLoggedIn: true` and saves cookie | integration | manual / smoke | N/A — requires Next.js cookie runtime |
| AUTH-03 | login page renders a password input field | manual-only | n/a | N/A — UI smoke test |
| AUTH-04 | logout handler calls `session.destroy()` | unit | `npm test -- src/app/admin/logout/route.test.ts` | ❌ Wave 0 |

**Notes on testability:** iron-session's `getIronSession` requires an actual cookie store from Next.js headers, making true integration testing complex without a running server. The most valuable unit tests are:
- Verifying `adminSession.ts` exports are correctly typed and configured (no runtime errors from wrong options)
- Testing the `loginAction` logic by mocking `getAdminSession` to return a mock session object

For AUTH-02/AUTH-03, smoke testing via browser or `curl` is the pragmatic validation path.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual browser smoke (visit /admin without cookie → redirected to /admin/login; enter correct password → reach /admin; refresh → still on /admin; logout → back to /admin/login)

### Wave 0 Gaps
- [ ] `src/lib/admin-session.test.ts` — covers AUTH-01 middleware logic (mock-based unit tests of session check)
- [ ] `src/app/admin/logout/route.test.ts` — covers AUTH-04 logout behavior

## Sources

### Primary (HIGH confidence)
- Official Next.js Authentication Guide (fetched 2026-03-25, version 16.2.1) — https://nextjs.org/docs/app/guides/authentication
- Official Next.js Middleware docs (fetched, version 14.2.35) — https://nextjs.org/docs/14/app/building-your-application/routing/middleware
- iron-session official GitHub example middleware.ts — https://github.com/vvo/iron-session/blob/main/examples/next/src/middleware.ts
- iron-session v8 release notes — https://github.com/vvo/iron-session/releases/tag/v8.0.0

### Secondary (MEDIUM confidence)
- Alex Chantastic blog post on password-protecting Next.js (verified against iron-session README) — https://www.alexchantastic.com/revisiting-password-protecting-next
- Lama Dev blog: Next.js 14 Auth with Iron Session (verified against iron-session docs) — https://blog.lama.dev/next-js-14-auth-with-iron-session/

### Tertiary (LOW confidence)
- iron-session GitHub discussion #658 on middleware pattern — https://github.com/vvo/iron-session/discussions/658 (maintainer confirmed `getIronSession` works in middleware but full code not verified independently)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — iron-session is explicitly listed in official Next.js auth docs as a recommended session library
- Architecture: HIGH — middleware pattern and Server Action pattern verified against official Next.js docs and iron-session official example code
- Pitfalls: HIGH — `cookies()` async change confirmed via Next.js issue tracker; redirect loop is a structural guarantee; cookie secure flag behavior is well-documented web standard

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (90 days — iron-session is stable, Next.js 14 API is stable)
