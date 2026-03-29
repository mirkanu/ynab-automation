export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    // Protect page routes only — API routes handle their own auth (return 401 instead of redirect)
    '/((?!auth|api|_next/static|_next/image|favicon.ico).*)',
  ],
}
