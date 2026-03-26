import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getAdminSession to return a controllable session object
const mockDestroy = vi.fn().mockResolvedValue(undefined);
const mockSession = { isLoggedIn: true, destroy: mockDestroy };

vi.mock('@/lib/admin-session', () => ({
  getAdminSession: vi.fn().mockResolvedValue(mockSession),
}));

// Mock NextResponse.redirect
const mockRedirect = vi.fn((url: URL) => ({
  status: 302,
  headers: { location: url.toString() },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: mockRedirect,
  },
}));

describe('POST /admin/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockReturnValue({ status: 302, headers: { location: 'http://localhost:3000/admin/login' } });
  });

  it('calls session.destroy() to clear the session cookie', async () => {
    const { POST } = await import('./route');
    await POST();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('redirects to /admin/login after destroying the session', async () => {
    const { POST } = await import('./route');
    await POST();
    expect(mockRedirect).toHaveBeenCalledOnce();
    const redirectArg = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectArg.pathname).toBe('/admin/login');
  });
});
