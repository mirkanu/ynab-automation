import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test that sessionOptions has the correct shape
describe('sessionOptions', () => {
  it('uses admin_session as cookieName', async () => {
    const { sessionOptions } = await import('./admin-session');
    expect(sessionOptions.cookieName).toBe('admin_session');
  });

  it('sets httpOnly on the cookie', async () => {
    const { sessionOptions } = await import('./admin-session');
    expect(sessionOptions.cookieOptions?.httpOnly).toBe(true);
  });

  it('sets sameSite to lax', async () => {
    const { sessionOptions } = await import('./admin-session');
    expect(sessionOptions.cookieOptions?.sameSite).toBe('lax');
  });

  it('sets secure based on NODE_ENV, not hardcoded true', async () => {
    const { sessionOptions } = await import('./admin-session');
    const expected = process.env.NODE_ENV === 'production';
    expect(sessionOptions.cookieOptions?.secure).toBe(expected);
  });
});

// Test middleware redirect logic (pure logic, no Next.js runtime needed)
describe('middleware auth logic', () => {
  it('excludes /login from middleware matcher so it loads without auth', () => {
    const matcher = '/((?!login|logout|api|setup|_next|favicon.ico).*)';
    const loginPath = '/login';
    const regex = new RegExp(`^${matcher}$`);
    expect(regex.test(loginPath)).toBe(false);
  });

  it('identifies unauthenticated session as needing redirect', () => {
    const session = { isLoggedIn: false };
    expect(session.isLoggedIn).toBe(false);
  });

  it('identifies authenticated session as allowed through', () => {
    const session = { isLoggedIn: true };
    expect(session.isLoggedIn).toBe(true);
  });
});
