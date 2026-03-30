import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  decryptToken: vi.fn((ciphertext: string) => `plaintext:${ciphertext}`),
  encryptToken: vi.fn((plaintext: string) => `encrypted:${plaintext}`),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Set required env vars
process.env.YNAB_CLIENT_ID = 'test-client-id'
process.env.YNAB_CLIENT_SECRET = 'test-client-secret'

import { prisma } from '@/lib/db'
import { decryptToken, encryptToken } from '@/lib/crypto'
import { getValidYnabToken } from '@/lib/ynab'

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

describe('YNAB Token Auto-Refresh (YNAB-03)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getValidYnabToken returns decrypted access token when token is not expired', async () => {
    const futureExpiry = BigInt(Date.now() + 30 * 60 * 1000) // 30 min in the future

    mockPrisma.user.findUnique.mockResolvedValue({
      oauthToken: 'encrypted-token',
      oauthRefreshToken: 'encrypted-refresh-token',
      oauthExpiresAt: futureExpiry,
      lastRefreshAttemptAt: null,
    })

    const token = await getValidYnabToken('user-123')

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: {
        oauthToken: true,
        oauthRefreshToken: true,
        oauthExpiresAt: true,
        lastRefreshAttemptAt: true,
      },
    })
    expect(decryptToken).toHaveBeenCalledWith('encrypted-token')
    expect(token).toBe('plaintext:encrypted-token')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('getValidYnabToken refreshes token when oauthExpiresAt is within 5 minutes', async () => {
    const nearExpiryAt = BigInt(Date.now() + 2 * 60 * 1000) // 2 min in the future (within 5-min buffer)

    mockPrisma.user.findUnique.mockResolvedValue({
      oauthToken: 'encrypted-token',
      oauthRefreshToken: 'encrypted-refresh-token',
      oauthExpiresAt: nearExpiryAt,
      lastRefreshAttemptAt: null,
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
      }),
    })

    mockPrisma.user.update.mockResolvedValue({})

    const token = await getValidYnabToken('user-123')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://app.ynab.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('grant_type=refresh_token'),
      }),
    )
    expect(token).toBe('new-access-token')
    expect(encryptToken).toHaveBeenCalledWith('new-access-token')
    expect(encryptToken).toHaveBeenCalledWith('new-refresh-token')
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          lastRefreshAttemptAt: expect.any(Date),
        }),
      }),
    )
  })

  it('getValidYnabToken refreshes token when oauthExpiresAt has passed', async () => {
    const expiredAt = BigInt(Date.now() - 10 * 60 * 1000) // 10 min in the past

    mockPrisma.user.findUnique.mockResolvedValue({
      oauthToken: 'expired-token',
      oauthRefreshToken: 'encrypted-refresh-token',
      oauthExpiresAt: expiredAt,
      lastRefreshAttemptAt: null,
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token-2',
        refresh_token: 'new-refresh-token-2',
        expires_in: 7200,
      }),
    })

    mockPrisma.user.update.mockResolvedValue({})

    const token = await getValidYnabToken('user-123')

    expect(mockFetch).toHaveBeenCalled()
    expect(token).toBe('new-access-token-2')
  })

  it('getValidYnabToken throws if user has no connected YNAB account (oauthToken is null)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      oauthToken: null,
      oauthRefreshToken: null,
      oauthExpiresAt: null,
      lastRefreshAttemptAt: null,
    })

    await expect(getValidYnabToken('user-no-ynab')).rejects.toThrow(
      'User has not connected YNAB account',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('getValidYnabToken uses lastRefreshAttemptAt mutex: second concurrent request reads refreshed token from DB instead of calling YNAB refresh endpoint again', async () => {
    const expiredAt = BigInt(Date.now() - 5 * 60 * 1000) // expired 5 min ago
    const recentRefreshAttempt = new Date(Date.now() - 5000) // attempted 5 seconds ago (within 30s mutex)
    const futureExpiry = BigInt(Date.now() + 30 * 60 * 1000) // 30 min from now

    // First call: token is expired, mutex is recent (another call is refreshing)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        oauthToken: 'old-encrypted-token',
        oauthRefreshToken: 'encrypted-refresh-token',
        oauthExpiresAt: expiredAt,
        lastRefreshAttemptAt: recentRefreshAttempt,
      })
      // Second call (re-read from DB): token was refreshed by the concurrent call
      .mockResolvedValueOnce({
        oauthToken: 'new-encrypted-token',
        oauthRefreshToken: 'new-encrypted-refresh-token',
        oauthExpiresAt: futureExpiry,
        lastRefreshAttemptAt: recentRefreshAttempt,
      })

    const token = await getValidYnabToken('user-123')

    // Should NOT call fetch — should use the DB-refreshed token instead
    expect(mockFetch).not.toHaveBeenCalled()
    expect(token).toBe('plaintext:new-encrypted-token')
    // Should have called findUnique twice (initial + re-read)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('Token refresh updates oauthToken, oauthRefreshToken, oauthExpiresAt, and lastRefreshAttemptAt atomically', async () => {
    const expiredAt = BigInt(Date.now() - 10 * 60 * 1000)

    mockPrisma.user.findUnique.mockResolvedValue({
      oauthToken: 'old-token',
      oauthRefreshToken: 'old-refresh-token',
      oauthExpiresAt: expiredAt,
      lastRefreshAttemptAt: null,
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'fresh-access-token',
        refresh_token: 'fresh-refresh-token',
        expires_in: 7200,
      }),
    })

    mockPrisma.user.update.mockResolvedValue({})

    await getValidYnabToken('user-123')

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          oauthToken: expect.stringContaining('encrypted:'),
          oauthRefreshToken: expect.stringContaining('encrypted:'),
          oauthExpiresAt: expect.any(BigInt),
          lastRefreshAttemptAt: expect.any(Date),
        }),
      }),
    )
  })
})
