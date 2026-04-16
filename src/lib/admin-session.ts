import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { getSetting, saveSettings } from '@/lib/settings';

export interface AdminSessionData {
  isLoggedIn: boolean;
}

let cachedSecret: string | null = null;

/**
 * Returns iron-session options with a secret read from DB.
 * On first call (no DB row), generates a 32-byte hex secret, stores it,
 * and caches it in memory so subsequent requests skip the DB query.
 */
export async function getSessionOptions(): Promise<SessionOptions> {
  if (!cachedSecret) {
    let secret = await getSetting('IRON_SESSION_SECRET');
    if (!secret) {
      // Fall back to env var if set (allows manual override)
      secret = process.env.IRON_SESSION_SECRET;
    }
    if (!secret) {
      // Auto-generate and persist
      secret = randomBytes(32).toString('hex');
      await saveSettings({ IRON_SESSION_SECRET: secret });
    }
    cachedSecret = secret;
  }

  return {
    password: cachedSecret,
    cookieName: 'admin_session',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // iron-session default TTL is 14 days — satisfies AUTH-02
    },
  };
}

/**
 * Use in Server Components, Server Actions, and Route Handlers.
 * Do NOT call this from middleware.ts — middleware must use getIronSession directly.
 */
export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, await getSessionOptions());
}
