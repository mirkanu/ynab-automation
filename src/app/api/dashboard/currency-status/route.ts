import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { getLastToolRuns } from '@/lib/tool-run-queries'

export async function GET() {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const data = await getLastToolRuns()
  return NextResponse.json(data)
}
