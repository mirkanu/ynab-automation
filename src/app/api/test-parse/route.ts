import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { parseOrderEmail } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { html, senderName } = (await req.json()) as {
    html: string
    senderName: string
  }

  if (!html?.trim()) {
    return NextResponse.json(
      { error: 'Email HTML content is required' },
      { status: 400 },
    )
  }

  const result = await parseOrderEmail(html, senderName || 'Test')
  if (!result) {
    return NextResponse.json(
      { error: 'Could not parse the email. Claude returned no result.' },
      { status: 422 },
    )
  }

  return NextResponse.json({ result })
}
