import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authUrl = new URL('https://app.ynab.com/oauth/authorize')
  authUrl.searchParams.set('client_id', process.env.YNAB_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/ynab/callback`)
  authUrl.searchParams.set('response_type', 'code')

  return NextResponse.redirect(authUrl)
}
