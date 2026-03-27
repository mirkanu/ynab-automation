import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { type AdminSessionData, sessionOptions } from '@/lib/admin-session';

export async function middleware(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except /login, /logout, /api/*, /setup/*, and Next.js internals
  matcher: ['/((?!login|logout|api|setup|_next|favicon.ico).*)'],
};
