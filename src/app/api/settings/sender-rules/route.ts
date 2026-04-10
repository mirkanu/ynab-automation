import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { prisma } from '@/lib/db'

interface SenderRule {
  email: string;
  name: string;
  accountId: string;
  accountName: string;
  budgetId: string;
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const setting = await prisma.setting.findUnique({
    where: { key: 'SENDER_RULES' },
  })

  if (!setting) {
    return NextResponse.json({ rules: [] })
  }

  try {
    const rules = JSON.parse(setting.value) as SenderRule[]
    return NextResponse.json({ rules })
  } catch {
    return NextResponse.json({ rules: [] })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rules } = body as { rules: unknown }

  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: 'Invalid rules' }, { status: 400 })
  }

  for (const rule of rules) {
    if (
      typeof rule !== 'object' || rule === null ||
      typeof (rule as SenderRule).email !== 'string' || !(rule as SenderRule).email.trim() ||
      typeof (rule as SenderRule).accountId !== 'string' || !(rule as SenderRule).accountId.trim()
    ) {
      return NextResponse.json({ error: 'Invalid rules' }, { status: 400 })
    }
  }

  await prisma.setting.upsert({
    where: { key: 'SENDER_RULES' },
    update: { value: JSON.stringify(rules) },
    create: { key: 'SENDER_RULES', value: JSON.stringify(rules) },
  })

  return NextResponse.json({ ok: true })
}
