import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Auth.js
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST } from '@/app/api/ynab/disconnect/route'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  user: {
    update: ReturnType<typeof vi.fn>
  }
}

describe('YNAB Disconnect (YNAB-04)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /api/ynab/disconnect clears oauthToken, oauthRefreshToken, oauthExpiresAt, selectedBudgetId, selectedAccountId, lastRefreshAttemptAt for the user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    mockPrisma.user.update.mockResolvedValue({})

    await POST()

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {
        oauthToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        selectedBudgetId: null,
        selectedAccountId: null,
        lastRefreshAttemptAt: null,
      },
    })
  })

  it('POST /api/ynab/disconnect returns { status: "disconnected" }', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    mockPrisma.user.update.mockResolvedValue({})

    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json() as { status: string }
    expect(body.status).toBe('disconnected')
  })

  it('POST /api/ynab/disconnect returns 401 if user not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST()

    expect(response.status).toBe(401)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('After disconnect, GET /api/ynab/status returns { connected: false }', async () => {
    // This test verifies the contract — the actual status route behavior is tested in oauth.test.ts
    // Here we verify that disconnect sets all fields to null which the status route checks
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    mockPrisma.user.update.mockResolvedValue({})

    await POST()

    // Verify the update call nulls all the fields that the status route checks
    const updateCall = mockPrisma.user.update.mock.calls[0][0] as {
      data: {
        oauthToken: null
        selectedBudgetId: null
        selectedAccountId: null
      }
    }
    expect(updateCall.data.oauthToken).toBeNull()
    expect(updateCall.data.selectedBudgetId).toBeNull()
    expect(updateCall.data.selectedAccountId).toBeNull()
  })
})
