import { prisma } from '@/lib/db'

export const PAGE_SIZE = 20

export interface DashboardStats {
  thisWeek: { total: number; successes: number; rate: number }
  lastTransaction: {
    retailer: string
    amount: number
    date: string
    receivedAt: Date
  } | null
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const [weekLogs, lastSuccess] = await Promise.all([
    prisma.activityLog.findMany({
      where: { receivedAt: { gte: startOfWeek } },
      select: { status: true },
    }),
    prisma.activityLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
      select: { parseResult: true, receivedAt: true },
    }),
  ])

  const total = weekLogs.length
  const successes = weekLogs.filter(e => e.status === 'success').length
  const rate = total > 0 ? Math.round((successes / total) * 100) : 0

  let lastTransaction: DashboardStats['lastTransaction'] = null
  if (lastSuccess?.parseResult && typeof lastSuccess.parseResult === 'object') {
    const pr = lastSuccess.parseResult as Record<string, unknown>
    lastTransaction = {
      retailer: String(pr.retailer ?? ''),
      amount: Number(pr.amount ?? 0),
      date: String(pr.date ?? ''),
      receivedAt: lastSuccess.receivedAt,
    }
  }

  return { thisWeek: { total, successes, rate }, lastTransaction }
}

export async function getActivityLogs(params: {
  status?: string
  from?: string
  to?: string
  page?: number
}) {
  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.from || params.to) {
    const receivedAt: Record<string, Date> = {}
    if (params.from) receivedAt.gte = new Date(params.from)
    if (params.to) receivedAt.lte = new Date(params.to + 'T23:59:59')
    where.receivedAt = receivedAt
  }

  const page = params.page ?? 1
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ])

  return { logs, total, pageSize: PAGE_SIZE }
}
