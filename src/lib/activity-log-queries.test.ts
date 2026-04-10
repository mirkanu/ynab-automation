import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockCount = vi.fn()

const mockPrisma = {
  activityLog: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    count: mockCount,
  },
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct counts and rate for mixed logs', async () => {
    mockFindMany.mockResolvedValue([
      { status: 'success' },
      { status: 'success' },
      { status: 'parse_error' },
    ])
    mockFindFirst.mockResolvedValue(null)

    const { getDashboardStats } = await import('./activity-log-queries')
    const stats = await getDashboardStats()

    expect(stats.thisWeek.total).toBe(3)
    expect(stats.thisWeek.successes).toBe(2)
    expect(stats.thisWeek.rate).toBe(67)
  })

  it('returns null lastTransaction when no success entries', async () => {
    mockFindMany.mockResolvedValue([{ status: 'parse_error' }])
    mockFindFirst.mockResolvedValue(null)

    const { getDashboardStats } = await import('./activity-log-queries')
    const stats = await getDashboardStats()

    expect(stats.lastTransaction).toBeNull()
  })

  it('returns rate 0 when no logs this week', async () => {
    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)

    const { getDashboardStats } = await import('./activity-log-queries')
    const stats = await getDashboardStats()

    expect(stats.thisWeek.total).toBe(0)
    expect(stats.thisWeek.rate).toBe(0)
  })

  it('extracts lastTransaction from parseResult JSON', async () => {
    mockFindMany.mockResolvedValue([{ status: 'success' }])
    mockFindFirst.mockResolvedValue({
      parseResult: { retailer: 'Amazon', amount: 12.99, date: '2024-03-15', currency: 'GBP', description: 'AirPods' },
      receivedAt: new Date('2024-03-15T10:00:00Z'),
    })

    const { getDashboardStats } = await import('./activity-log-queries')
    const stats = await getDashboardStats()

    expect(stats.lastTransaction).toEqual({
      retailer: 'Amazon',
      amount: 12.99,
      date: '2024-03-15',
      receivedAt: new Date('2024-03-15T10:00:00Z'),
    })
  })
})

describe('getActivityLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it('filters by status', async () => {
    const { getActivityLogs } = await import('./activity-log-queries')
    await getActivityLogs({ status: 'success' })

    expect(mockFindMany).toHaveBeenCalledOnce()
    const args = mockFindMany.mock.calls[0][0]
    expect(args.where.status).toBe('success')
  })

  it('paginates with correct skip/take', async () => {
    const { getActivityLogs, PAGE_SIZE } = await import('./activity-log-queries')
    await getActivityLogs({ page: 3 })

    const args = mockFindMany.mock.calls[0][0]
    expect(args.skip).toBe(2 * PAGE_SIZE)
    expect(args.take).toBe(PAGE_SIZE)
  })

  it('filters by date range', async () => {
    const { getActivityLogs } = await import('./activity-log-queries')
    await getActivityLogs({ from: '2026-03-01', to: '2026-03-27' })

    const args = mockFindMany.mock.calls[0][0]
    expect(args.where.receivedAt.gte).toEqual(new Date('2026-03-01'))
    expect(args.where.receivedAt.lte).toEqual(new Date('2026-03-27T23:59:59'))
  })

  it('returns logs, total, and pageSize', async () => {
    mockFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
    mockCount.mockResolvedValue(42)

    const { getActivityLogs, PAGE_SIZE } = await import('./activity-log-queries')
    const result = await getActivityLogs({})

    expect(result.logs).toHaveLength(2)
    expect(result.total).toBe(42)
    expect(result.pageSize).toBe(PAGE_SIZE)
  })
})
