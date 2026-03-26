import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { type AdminSessionData, sessionOptions } from '@/lib/admin-session';

export async function middleware(request: NextRequest) {
  // Allow /admin/login through unauthenticated — prevents redirect loop.
  // The matcher catches /admin/:path* which includes /admin/login.
  if (request.nextUrl.pathname === '/admin/login') {
    return NextResponse.next();
  }

  // In middleware, use getIronSession directly (not the getAdminSession helper).
  // iron-session v8 is Edge-compatible — no Node.js crypto dependency.
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
