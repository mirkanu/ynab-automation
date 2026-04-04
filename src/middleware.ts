import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight middleware that checks for session cookie existence only.
 * Actual session validation happens in server components/API routes via auth().
 *
 * We cannot use `export { auth as middleware }` with database session strategy
 * because PrismaClient does not support Edge Runtime (where middleware runs).
 */
export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get('authjs.session-token') ??
    request.cookies.get('__Secure-authjs.session-token')

  if (!sessionToken) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protect page routes only — API routes handle their own auth (return 401 instead of redirect)
    // Exclude root / (public homepage), auth pages, API routes, and static files
    '/((?!$|auth|api|_next/static|_next/image|favicon.ico).*)',
  ],
}
