import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { enabled?: boolean }
  const enabled = !!body.enabled
  await prisma.setting.upsert({
    where: { key: 'TEST_MODE' },
    update: { value: String(enabled) },
    create: { key: 'TEST_MODE', value: String(enabled) },
  })
  // Also apply immediately to current process
  process.env.TEST_MODE = String(enabled)
  return NextResponse.json({ testMode: enabled })
}
