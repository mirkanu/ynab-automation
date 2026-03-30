import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getValidYnabToken } from '@/lib/ynab'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { budgetId } = await params

  let token: string
  try {
    token = await getValidYnabToken(session.user.id)
  } catch {
    return NextResponse.json({ error: 'YNAB account not connected' }, { status: 400 })
  }

  const response = await fetch(
    `https://api.youneedabudget.com/v1/budgets/${budgetId}/accounts`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  const data = await response.json() as {
    data: {
      accounts: Array<{ id: string; name: string; deleted: boolean; closed: boolean }>
    }
  }

  const accounts = data.data.accounts
    .filter((a) => !a.deleted && !a.closed)
    .map((a) => ({ id: a.id, name: a.name }))

  return NextResponse.json({ accounts })
}
