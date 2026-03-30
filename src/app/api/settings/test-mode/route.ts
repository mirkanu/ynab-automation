import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { enabled?: boolean }
  const enabled = !!body.enabled

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: { testMode: enabled },
  })

  return NextResponse.json({ testMode: updatedUser.testMode })
}
