import { prisma } from '@/lib/db'

/**
 * Backfills userId on all existing ActivityLog, Setting, and ProcessedEmail rows
 * to the initial user (Manuel). Idempotent — safe to run multiple times.
 *
 * Run with: INITIAL_USER_EMAIL=manuelkuhs@gmail.com npx tsx src/lib/migrations/backfill-user-id.ts
 */
export async function backfillUserId(manuelEmail: string) {
  // Upsert the initial user — creates if not exists, returns existing if already created by Auth.js
  const manuel = await prisma.user.upsert({
    where: { email: manuelEmail },
    update: {},
    create: {
      email: manuelEmail,
      name: 'Manuel',
      emailVerified: new Date(), // Pre-verify so login works immediately
    },
  })

  console.log(`Initial user: ${manuel.id} (${manuel.email})`)

  // Backfill ActivityLog rows with no userId (using raw SQL since userId is now NOT NULL in TypeScript)
  const logsResult = await prisma.$executeRaw`
    UPDATE "ActivityLog" SET "userId" = ${manuel.id} WHERE "userId" IS NULL
  `

  // Backfill ProcessedEmail rows with no userId
  const emailsResult = await prisma.$executeRaw`
    UPDATE "ProcessedEmail" SET "userId" = ${manuel.id} WHERE "userId" IS NULL
  `

  // Backfill Setting rows with no userId
  const settingsResult = await prisma.$executeRaw`
    UPDATE "Setting" SET "userId" = ${manuel.id} WHERE "userId" IS NULL
  `

  console.log(
    `Backfilled: ${logsResult} activity logs, ${emailsResult} processed emails, ${settingsResult} settings`
  )

  return {
    logs: Number(logsResult),
    emails: Number(emailsResult),
    settings: Number(settingsResult),
    userId: manuel.id,
  }
}

// Script entrypoint
const isMain =
  typeof require !== 'undefined'
    ? require.main === module
    : process.argv[1]?.includes('backfill-user-id')

if (isMain) {
  const email = process.env.INITIAL_USER_EMAIL
  if (!email) {
    console.error('Set INITIAL_USER_EMAIL env var to the admin email address')
    process.exit(1)
  }
  backfillUserId(email)
    .then(() => {
      console.log('Backfill complete')
      process.exit(0)
    })
    .catch((e) => {
      console.error('Backfill failed:', e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
