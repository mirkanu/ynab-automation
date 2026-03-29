import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Returns a Prisma client that sets the PostgreSQL app.user_id session variable
 * before each query. This activates RLS policies so the database enforces
 * tenant isolation as a backstop to application-layer filtering.
 *
 * Usage in API routes:
 *   const db = getPrismaForUser(userId)
 *   const logs = await db.activityLog.findMany({ where: { userId } })
 *
 * The RLS policy provides an additional safety net even if the WHERE clause
 * is accidentally omitted.
 */
export function getPrismaForUser(userId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Set the PostgreSQL session variable for RLS before every query
          await prisma.$executeRawUnsafe(
            `SELECT set_config('app.user_id', $1, TRUE)`,
            userId,
          )
          return query(args)
        },
      },
    },
  })
}
