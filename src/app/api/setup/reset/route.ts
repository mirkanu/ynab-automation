import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/setup/reset
 *
 * Clears ADMIN_PASSWORD and WIZARD_COMPLETE from the Setting table, then
 * redirects to /setup/1 so the user can choose a new admin password.
 *
 * Only runs when RESET_PASSWORD=true is set in the environment.
 * Returns 403 otherwise.
 *
 * Usage: set RESET_PASSWORD=true in Railway Variables → redeploy/restart →
 * visit the app → reset completes → remove RESET_PASSWORD → redeploy again.
 */
export async function GET(request: NextRequest) {
  if (process.env.RESET_PASSWORD !== 'true') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  await prisma.setting.deleteMany({
    where: { key: { in: ['ADMIN_PASSWORD', 'WIZARD_COMPLETE'] } },
  })

  return NextResponse.redirect(new URL('/setup/1', request.url))
}
