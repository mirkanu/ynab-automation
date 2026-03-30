import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  getPrismaForUser: vi.fn(),
}))

import { getPrismaForUser } from '@/lib/db'
import { getActivityLogs } from '@/lib/activity-log-queries'

const mockGetPrismaForUser = getPrismaForUser as ReturnType<typeof vi.fn>

describe('DASH-01: Activity log per-user filtering', () => {
  const mockFindMany = vi.fn()
  const mockCount = vi.fn()
  const mockDb = {
    activityLog: {
      findMany: mockFindMany,
      count: mockCount,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPrismaForUser.mockReturnValue(mockDb)
  })

  it('getActivityLogs filters by userId — no cross-user entries returned', async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, userId: 'user-123', status: 'success', messageId: 'msg-1', sender: null, subject: null, receivedAt: new Date(), rawBody: null, parseResult: null, ynabResult: null, errorType: null, errorMessage: null, createdAt: new Date() },
    ])
    mockCount.mockResolvedValue(1)

    const result = await getActivityLogs('user-123', {})

    expect(mockGetPrismaForUser).toHaveBeenCalledWith('user-123')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-123' }),
      }),
    )
    expect(result.logs).toHaveLength(1)
  })

  it('getActivityLogs respects status filter', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getActivityLogs('user-123', { status: 'parse_error' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-123', status: 'parse_error' }),
      }),
    )
  })

  it('getActivityLogs respects date range filter', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getActivityLogs('user-123', { from: '2024-01-01', to: '2024-01-31' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
          receivedAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    )
  })

  it('getActivityLogs returns empty array for user with no logs', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const result = await getActivityLogs('user-with-no-logs', {})

    expect(result.logs).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
