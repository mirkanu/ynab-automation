import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { backfillUserId } from '@/lib/migrations/backfill-user-id'

const TEST_EMAIL = 'manuel-test@example.com'

describe('DATA-02: Backfill migration idempotency and correctness', () => {
  beforeAll(async () => {
    // Clean up test user and cascading records if exists from a previous run
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  })

  afterAll(async () => {
    // Clean up test data after all tests
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
    await prisma.$disconnect()
  })

  it('upserts the initial user and returns their id', async () => {
    const result = await backfillUserId(TEST_EMAIL)
    expect(result.userId).toBeTruthy()
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
    expect(user).not.toBeNull()
    expect(user!.email).toBe(TEST_EMAIL)
  })

  it('is idempotent — running twice does not fail or duplicate', async () => {
    const first = await backfillUserId(TEST_EMAIL)
    const second = await backfillUserId(TEST_EMAIL)
    expect(first.userId).toBe(second.userId)
  })

  it('no ActivityLog rows have NULL userId after backfill', async () => {
    await backfillUserId(TEST_EMAIL)
    // Using raw SQL because TypeScript enforces non-null after schema migration
    const nullCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "ActivityLog" WHERE "userId" IS NULL
    `
    expect(Number(nullCount[0].count)).toBe(0)
  })

  it('no Setting rows have NULL userId after backfill', async () => {
    await backfillUserId(TEST_EMAIL)
    const nullCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Setting" WHERE "userId" IS NULL
    `
    expect(Number(nullCount[0].count)).toBe(0)
  })

  it('no ProcessedEmail rows have NULL userId after backfill', async () => {
    await backfillUserId(TEST_EMAIL)
    const nullCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "ProcessedEmail" WHERE "userId" IS NULL
    `
    expect(Number(nullCount[0].count)).toBe(0)
  })

  it('Manuel user exists in User table after backfill', async () => {
    const result = await backfillUserId(TEST_EMAIL)
    const user = await prisma.user.findUnique({ where: { id: result.userId } })
    expect(user).not.toBeNull()
    expect(user!.emailVerified).not.toBeNull() // Pre-verified
  })
})
