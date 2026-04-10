import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const settings = await prisma.setting.findMany()
    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: `Failed to load settings: ${(e as Error).message}` }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as { settings: Record<string, string> }
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 })
    }
    const updates = await Promise.all(
      Object.entries(body.settings).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    )
    return NextResponse.json({ success: true, count: updates.length })
  } catch (e) {
    return NextResponse.json({ error: `Failed to save settings: ${(e as Error).message}` }, { status: 500 })
  }
}
