import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Single delete — Prisma onDelete: Cascade handles all related rows:
  // Setting, ActivityLog, ProcessedEmail, ProcessedWebhook,
  // EmailForwardingAddress, Account, Session
  await prisma.user.delete({ where: { id: userId } })

  // Sign out the deleted user (session is now invalid)
  await signOut({ redirectTo: '/auth/signin' })

  return NextResponse.json({ deleted: true })
}
