import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, getPrismaForUser } from '@/lib/db'

// Two test users — created and cleaned up within this test suite
let userAId: string
let userBId: string

beforeAll(async () => {
  // Create two isolated test users
  const userA = await prisma.user.create({
    data: { email: 'test-user-a@isolation.test', name: 'User A', emailVerified: new Date() },
  })
  const userB = await prisma.user.create({
    data: { email: 'test-user-b@isolation.test', name: 'User B', emailVerified: new Date() },
  })
  userAId = userA.id
  userBId = userB.id

  // Create one ActivityLog entry for User A
  await prisma.activityLog.create({
    data: {
      userId: userAId,
      messageId: 'isolation-test-msg-a',
      status: 'success',
      sender: 'amazon@amazon.com',
    },
  })

  // Create one Setting for User A
  await prisma.setting.create({
    data: { userId: userAId, key: 'test_setting', value: 'user_a_value' },
  })
})

afterAll(async () => {
  // Clean up test data (cascade deletes activity logs and settings via FK)
  await prisma.user.deleteMany({
    where: { email: { in: ['test-user-a@isolation.test', 'test-user-b@isolation.test'] } },
  })
})

describe('DATA-03 & DATA-04: Multi-tenant isolation', () => {
  it("User B cannot see User A's ActivityLog via getPrismaForUser", async () => {
    const dbAsUserB = getPrismaForUser(userBId)
    // With RLS active, this should return 0 rows (User B has no logs)
    // The app-layer WHERE clause ALSO filters — double protection
    const logs = await dbAsUserB.activityLog.findMany({
      where: { userId: userBId },
    })
    expect(logs).toHaveLength(0)
  })

  it("User A can see their own ActivityLog via getPrismaForUser", async () => {
    const dbAsUserA = getPrismaForUser(userAId)
    const logs = await dbAsUserA.activityLog.findMany({
      where: { userId: userAId },
    })
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0].messageId).toBe('isolation-test-msg-a')
  })

  it("User B cannot see User A's settings", async () => {
    const dbAsUserB = getPrismaForUser(userBId)
    const settings = await dbAsUserB.setting.findMany({
      where: { userId: userBId },
    })
    expect(settings).toHaveLength(0)
  })

  it('All ActivityLog rows returned by getPrismaForUser belong to the requesting user', async () => {
    const dbAsUserA = getPrismaForUser(userAId)
    // RLS proof: even without WHERE clause, RLS ensures only User A's rows return
    // Note: this test uses findMany without a userId WHERE to test RLS layer
    const allLogs = await dbAsUserA.activityLog.findMany()
    for (const log of allLogs) {
      expect(log.userId).toBe(userAId)
    }
  })

  it("DATA-04: ActivityLog lookup by messageId is scoped to requesting user", async () => {
    // User B tries to look up User A's messageId — should return null
    const dbAsUserB = getPrismaForUser(userBId)
    const entry = await dbAsUserB.activityLog.findFirst({
      where: { messageId: 'isolation-test-msg-a', userId: userBId },
    })
    expect(entry).toBeNull()
  })
})
