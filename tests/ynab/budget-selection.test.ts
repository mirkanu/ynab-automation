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

// Mock ynab lib
vi.mock('@/lib/ynab', () => ({
  getValidYnabToken: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getValidYnabToken } from '@/lib/ynab'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockGetValidYnabToken = getValidYnabToken as ReturnType<typeof vi.fn>
const mockPrisma = prisma as unknown as {
  user: {
    update: ReturnType<typeof vi.fn>
  }
}

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('YNAB Budget & Account Selection (YNAB-05)', () => {
  it('smoke: test file loads without error', () => {
    expect(true).toBe(true)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/ynab/budgets', () => {
    it('returns 401 if user not authenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const { GET } = await import('@/app/api/ynab/budgets/route')
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('returns 400 if user has no connected YNAB account', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
      mockGetValidYnabToken.mockRejectedValue(new Error('User has not connected YNAB account'))
      const { GET } = await import('@/app/api/ynab/budgets/route')
      const response = await GET()
      expect(response.status).toBe(400)
      const body = await response.json() as { error: string }
      expect(body.error).toBe('YNAB account not connected')
    })

    it('GET /api/ynab/budgets returns list of budgets for connected user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
      mockGetValidYnabToken.mockResolvedValue('valid-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            budgets: [
              { id: 'budget-1', name: 'My Budget', last_modified_on: '2024-01-01' },
              { id: 'budget-2', name: 'Other Budget', last_modified_on: '2024-01-02' },
            ],
          },
        }),
      })

      const { GET } = await import('@/app/api/ynab/budgets/route')
      const response = await GET()
      expect(response.status).toBe(200)
      const body = await response.json() as { budgets: Array<{ id: string; name: string }> }
      expect(body.budgets).toEqual([
        { id: 'budget-1', name: 'My Budget' },
        { id: 'budget-2', name: 'Other Budget' },
      ])
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.youneedabudget.com/v1/budgets',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      )
    })
  })

  describe('GET /api/ynab/budgets/:budgetId/accounts', () => {
    it('returns 401 if user not authenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const { GET } = await import('@/app/api/ynab/budgets/[budgetId]/accounts/route')
      const response = await GET(
        new Request('http://localhost/api/ynab/budgets/budget-1/accounts'),
        { params: Promise.resolve({ budgetId: 'budget-1' }) }
      )
      expect(response.status).toBe(401)
    })

    it('returns 400 if user has no connected YNAB account', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
      mockGetValidYnabToken.mockRejectedValue(new Error('User has not connected YNAB account'))
      const { GET } = await import('@/app/api/ynab/budgets/[budgetId]/accounts/route')
      const response = await GET(
        new Request('http://localhost/api/ynab/budgets/budget-1/accounts'),
        { params: Promise.resolve({ budgetId: 'budget-1' }) }
      )
      expect(response.status).toBe(400)
    })

    it('returns list of accounts for given budget, filtering deleted and closed', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
      mockGetValidYnabToken.mockResolvedValue('valid-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            accounts: [
              { id: 'acc-1', name: 'Checking', deleted: false, closed: false },
              { id: 'acc-2', name: 'Savings', deleted: false, closed: false },
              { id: 'acc-3', name: 'Old Account', deleted: true, closed: false },
              { id: 'acc-4', name: 'Closed Account', deleted: false, closed: true },
            ],
          },
        }),
      })

      const { GET } = await import('@/app/api/ynab/budgets/[budgetId]/accounts/route')
      const response = await GET(
        new Request('http://localhost/api/ynab/budgets/budget-1/accounts'),
        { params: Promise.resolve({ budgetId: 'budget-1' }) }
      )
      expect(response.status).toBe(200)
      const body = await response.json() as { accounts: Array<{ id: string; name: string }> }
      expect(body.accounts).toEqual([
        { id: 'acc-1', name: 'Checking' },
        { id: 'acc-2', name: 'Savings' },
      ])
    })
  })

  describe('PUT /api/ynab/selection', () => {
    it('returns 401 if user not authenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const { PUT } = await import('@/app/api/ynab/selection/route')
      const request = new Request('http://localhost/api/ynab/selection', {
        method: 'PUT',
        body: JSON.stringify({ budgetId: 'budget-1', accountId: 'acc-1' }),
      })
      const response = await PUT(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 if budgetId or accountId missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
      const { PUT } = await import('@/app/api/ynab/selection/route')
      const request = new Request('http://localhost/api/ynab/selection', {
        method: 'PUT',
        body: JSON.stringify({ budgetId: 'budget-1' }),
      })
      const response = await PUT(request)
      expect(response.status).toBe(400)
    })

    it('PUT /api/ynab/selection persists selectedBudgetId and selectedAccountId on User row', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrisma.user.update.mockResolvedValue({})
      const { PUT } = await import('@/app/api/ynab/selection/route')
      const request = new Request('http://localhost/api/ynab/selection', {
        method: 'PUT',
        body: JSON.stringify({ budgetId: 'budget-1', accountId: 'acc-1' }),
      })
      const response = await PUT(request)
      expect(response.status).toBe(200)
      const body = await response.json() as { ok: boolean }
      expect(body.ok).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          selectedBudgetId: 'budget-1',
          selectedAccountId: 'acc-1',
        },
      })
    })
  })
})
