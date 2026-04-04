import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encryptToken } from '@/lib/crypto'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 })
  }

  // Exchange authorization code for tokens (server-side only — YNAB_CLIENT_SECRET never sent to client)
  const tokenRes = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.YNAB_CLIENT_ID!,
      client_secret: process.env.YNAB_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.APP_URL}/api/ynab/callback`,
    }),
  })

  if (!tokenRes.ok) {
    // Log status only — never log the response body which may contain the code
    console.error(`YNAB token exchange failed with status: ${tokenRes.status}`)
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      oauthToken: encryptToken(tokenData.access_token),
      oauthRefreshToken: encryptToken(tokenData.refresh_token),
      oauthExpiresAt: BigInt(Date.now() + tokenData.expires_in * 1000),
    },
  })

  return NextResponse.redirect(
    `${process.env.APP_URL}/settings?ynab_connected=true`
  )
}
