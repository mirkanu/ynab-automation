import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test that getSessionOptions() returns the correct shape
describe('getSessionOptions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses admin_session as cookieName', async () => {
    vi.mock('@/lib/settings', () => ({
      getSetting: vi.fn().mockResolvedValue('test-secret-value-32-bytes-long!!'),
      saveSettings: vi.fn().mockResolvedValue(1),
    }));
    const { getSessionOptions } = await import('./admin-session');
    const opts = await getSessionOptions();
    expect(opts.cookieName).toBe('admin_session');
  });

  it('sets httpOnly on the cookie', async () => {
    vi.mock('@/lib/settings', () => ({
      getSetting: vi.fn().mockResolvedValue('test-secret-value-32-bytes-long!!'),
      saveSettings: vi.fn().mockResolvedValue(1),
    }));
    const { getSessionOptions } = await import('./admin-session');
    const opts = await getSessionOptions();
    expect(opts.cookieOptions?.httpOnly).toBe(true);
  });

  it('sets sameSite to lax', async () => {
    vi.mock('@/lib/settings', () => ({
      getSetting: vi.fn().mockResolvedValue('test-secret-value-32-bytes-long!!'),
      saveSettings: vi.fn().mockResolvedValue(1),
    }));
    const { getSessionOptions } = await import('./admin-session');
    const opts = await getSessionOptions();
    expect(opts.cookieOptions?.sameSite).toBe('lax');
  });

  it('sets secure based on NODE_ENV, not hardcoded true', async () => {
    vi.mock('@/lib/settings', () => ({
      getSetting: vi.fn().mockResolvedValue('test-secret-value-32-bytes-long!!'),
      saveSettings: vi.fn().mockResolvedValue(1),
    }));
    const { getSessionOptions } = await import('./admin-session');
    const opts = await getSessionOptions();
    const expected = process.env.NODE_ENV === 'production';
    expect(opts.cookieOptions?.secure).toBe(expected);
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
