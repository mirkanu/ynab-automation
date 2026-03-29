import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPrismaForUser } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = getPrismaForUser(session.user.id)
  try {
    const settings = await db.setting.findMany({
      where: { userId: session.user.id },
    })
    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to load settings: ${(e as Error).message}` },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = getPrismaForUser(session.user.id)
  try {
    const body = (await req.json()) as { settings: Record<string, string> }
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 })
    }
    // Upsert each setting scoped to the current user
    const updates = await Promise.all(
      Object.entries(body.settings).map(([key, value]) =>
        db.setting.upsert({
          where: { userId_key: { userId: session.user.id, key } },
          update: { value },
          create: { userId: session.user.id, key, value },
        }),
      ),
    )
    return NextResponse.json({ success: true, count: updates.length })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save settings: ${(e as Error).message}` },
      { status: 500 },
    )
  }
}
