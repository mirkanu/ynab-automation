import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/ynab/disconnect
 *
 * Disconnects the authenticated user's YNAB account by clearing all OAuth
 * token fields. YNAB does not provide a public token revocation endpoint,
 * so clearing from the DB is sufficient.
 *
 * Returns: { status: 'disconnected' }
 * Errors: 401 if unauthenticated, 500 on DB error
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        oauthToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        selectedBudgetId: null,
        selectedAccountId: null,
        lastRefreshAttemptAt: null,
      },
    });

    return NextResponse.json({ status: 'disconnected' });
  } catch (err) {
    console.error('YNAB disconnect error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
