import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  getPrismaForUser: vi.fn(),
}))

import { getPrismaForUser } from '@/lib/db'
import { getDashboardStats } from '@/lib/activity-log-queries'

const mockGetPrismaForUser = getPrismaForUser as ReturnType<typeof vi.fn>

describe('DASH-02: Dashboard stats per-user scoping', () => {
  const mockFindMany = vi.fn()
  const mockFindFirst = vi.fn()
  const mockDb = {
    activityLog: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPrismaForUser.mockReturnValue(mockDb)
  })

  it('getDashboardStats returns only current user stats', async () => {
    mockFindMany.mockResolvedValue([
      { status: 'success' },
      { status: 'success' },
      { status: 'parse_error' },
    ])
    mockFindFirst.mockResolvedValue({
      parseResult: { retailer: 'Amazon', amount: 29.99, date: '2024-01-15' },
      receivedAt: new Date('2024-01-15T10:00:00Z'),
    })

    const result = await getDashboardStats('user-123')

    expect(mockGetPrismaForUser).toHaveBeenCalledWith('user-123')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-123' }),
      }),
    )
    expect(result.thisWeek.total).toBe(3)
    expect(result.thisWeek.successes).toBe(2)
  })

  it('getDashboardStats this-week window is calculated correctly', async () => {
    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)

    await getDashboardStats('user-123')

    const findManyCall = mockFindMany.mock.calls[0][0] as {
      where: { receivedAt: { gte: Date } }
    }
    const gteDate = findManyCall.where.receivedAt.gte

    // Should be a Date and within the past 7 days (start of week)
    expect(gteDate).toBeInstanceOf(Date)
    const now = new Date()
    const daysSince = (now.getTime() - gteDate.getTime()) / (1000 * 60 * 60 * 24)
    expect(daysSince).toBeGreaterThanOrEqual(0)
    expect(daysSince).toBeLessThanOrEqual(7)
  })

  it('getDashboardStats success rate is 0 when no logs exist', async () => {
    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)

    const result = await getDashboardStats('user-123')

    expect(result.thisWeek.total).toBe(0)
    expect(result.thisWeek.successes).toBe(0)
    expect(result.thisWeek.rate).toBe(0)
  })

  it('getDashboardStats lastTransaction is null when no logs exist', async () => {
    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)

    const result = await getDashboardStats('user-123')

    expect(result.lastTransaction).toBeNull()
  })
})
