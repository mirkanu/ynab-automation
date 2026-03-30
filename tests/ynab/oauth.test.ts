import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock db module
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  getPrismaForUser: vi.fn(() => ({
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  })),
}))

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  encryptToken: vi.fn((v: string) => `encrypted:${v}`),
  decryptToken: vi.fn((v: string) => v.replace('encrypted:', '')),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Cast to a vi mock function to avoid TS inference issues with next-auth overloads
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth = auth as unknown as { mockResolvedValueOnce: (v: any) => void }

describe('YNAB OAuth Flow (YNAB-01)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.YNAB_CLIENT_ID = 'test-client-id'
    process.env.YNAB_CLIENT_SECRET = 'test-client-secret'
    process.env.APP_URL = 'https://app.example.com'
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(32)
  })

  describe('GET /api/ynab/authorize', () => {
    it('returns 401 if user not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/ynab/authorize/route')
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('redirects to YNAB consent URL with correct params when authenticated', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: '2099-01-01',
      })
      const { GET } = await import('@/app/api/ynab/authorize/route')
      const response = await GET()
      // Should redirect (307)
      expect(response.status).toBe(307)
      const location = response.headers.get('location') ?? ''
      expect(location).toContain('app.ynab.com/oauth/authorize')
      expect(location).toContain('client_id=test-client-id')
      expect(location).toContain('response_type=code')
      expect(location).toContain('redirect_uri=')
      expect(location).toContain('/api/ynab/callback')
    })
  })

  describe('GET /api/ynab/status', () => {
    it('returns 401 if user not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/ynab/status/route')
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('returns { connected: false } if user has no oauthToken', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: '2099-01-01',
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        oauthToken: null,
      } as never)
      const { GET } = await import('@/app/api/ynab/status/route')
      const response = await GET()
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ connected: false })
    })

    it('returns { connected: true } if user has oauthToken', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: '2099-01-01',
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        oauthToken: 'encrypted:sometoken',
      } as never)
      const { GET } = await import('@/app/api/ynab/status/route')
      const response = await GET()
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ connected: true })
    })
  })

  describe('GET /api/ynab/callback', () => {
    it('returns 401 if user not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/ynab/callback/route')
      const req = new Request('https://app.example.com/api/ynab/callback?code=abc123')
      const response = await GET(req)
      expect(response.status).toBe(401)
    })

    it('returns 400 if code param is missing', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: '2099-01-01',
      })
      const { GET } = await import('@/app/api/ynab/callback/route')
      const req = new Request('https://app.example.com/api/ynab/callback')
      const response = await GET(req)
      expect(response.status).toBe(400)
    })

    it('exchanges code for tokens and redirects to settings page on success', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: '2099-01-01',
      })

      // Mock successful token exchange
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-abc',
          refresh_token: 'refresh-xyz',
          expires_in: 7200,
        }),
      } as never)

      vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 'user-1' } as never)

      const { GET } = await import('@/app/api/ynab/callback/route')
      const req = new Request('https://app.example.com/api/ynab/callback?code=valid-code')
      const response = await GET(req)
      expect(response.status).toBe(307)
      const location = response.headers.get('location') ?? ''
      expect(location).toContain('/dashboard/settings')
      expect(location).toContain('ynab_connected=true')
    })

    it('returns 500 if YNAB token exchange fails', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: '2099-01-01',
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as never)

      const { GET } = await import('@/app/api/ynab/callback/route')
      const req = new Request('https://app.example.com/api/ynab/callback?code=bad-code')
      const response = await GET(req)
      expect(response.status).toBe(500)
    })
  })
})
