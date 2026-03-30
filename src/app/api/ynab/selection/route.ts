import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { budgetId?: string; accountId?: string }
  const { budgetId, accountId } = body

  if (!budgetId || !accountId) {
    return NextResponse.json({ error: 'budgetId and accountId are required' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      selectedBudgetId: budgetId,
      selectedAccountId: accountId,
    },
  })

  return NextResponse.json({ ok: true })
}
