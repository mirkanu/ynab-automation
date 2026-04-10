import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight middleware that checks for iron-session cookie existence only.
 * Actual session validation (isLoggedIn=true) happens in server components
 * via getAdminSession() which has Node.js runtime access.
 *
 * Cannot decrypt the iron-session cookie here — Edge Runtime cannot run
 * Node.js crypto. Cookie presence is sufficient to let the server component
 * perform the real check.
 */
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('admin_session')

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'callbackUrl',
      request.nextUrl.pathname + request.nextUrl.search
    )
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protect page routes only.
    // Excludes: login, logout, setup wizard, API routes, Next.js internals, favicon
    '/((?!login|logout|setup|api|_next/static|_next/image|favicon.ico).*)',
  ],
}
