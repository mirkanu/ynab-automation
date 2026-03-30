import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getValidYnabToken } from '@/lib/ynab'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let token: string
  try {
    token = await getValidYnabToken(session.user.id)
  } catch {
    return NextResponse.json({ error: 'YNAB account not connected' }, { status: 400 })
  }

  const response = await fetch('https://api.youneedabudget.com/v1/budgets', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json() as {
    data: {
      budgets: Array<{ id: string; name: string; last_modified_on: string }>
    }
  }

  return NextResponse.json({
    budgets: data.data.budgets.map((b) => ({ id: b.id, name: b.name })),
  })
}
