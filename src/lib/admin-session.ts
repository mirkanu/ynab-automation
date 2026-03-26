import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface AdminSessionData {
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET!,
  cookieName: 'admin_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // iron-session default TTL is 14 days — satisfies AUTH-02
  },
};

/**
 * Use in Server Components, Server Actions, and Route Handlers.
 * Do NOT call this from middleware.ts — middleware must use getIronSession directly.
 */
export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, sessionOptions);
}
