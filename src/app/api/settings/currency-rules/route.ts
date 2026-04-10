import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { prisma } from '@/lib/db'

interface CurrencyRule {
  currency: string;
  accountId: string;
  accountName: string;
}

export async function GET() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const setting = await prisma.setting.findUnique({
    where: { key: 'CURRENCY_RULES' },
  })

  if (!setting?.value) {
    return NextResponse.json({ rules: [] })
  }

  try {
    const rules = JSON.parse(setting.value) as CurrencyRule[]
    return NextResponse.json({ rules })
  } catch {
    return NextResponse.json({ rules: [] })
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { rules: CurrencyRule[] }
  if (!Array.isArray(body.rules)) {
    return NextResponse.json({ error: 'Invalid rules' }, { status: 400 })
  }

  for (const rule of body.rules) {
    if (!rule.currency?.trim() || !rule.accountId?.trim()) {
      return NextResponse.json({ error: 'Each rule must have currency and accountId' }, { status: 400 })
    }
  }

  await prisma.setting.upsert({
    where: { key: 'CURRENCY_RULES' },
    update: { value: JSON.stringify(body.rules) },
    create: { key: 'CURRENCY_RULES', value: JSON.stringify(body.rules) },
  })

  return NextResponse.json({ ok: true })
}
