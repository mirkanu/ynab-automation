export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    // Protect all routes except auth routes, static files, and API auth handlers
    '/((?!auth|api/auth|_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
}
