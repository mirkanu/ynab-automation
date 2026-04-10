import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { getSetting } from '@/lib/settings';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [token, budgetId, accountId] = await Promise.all([
      getSetting('YNAB_ACCESS_TOKEN'),
      getSetting('YNAB_BUDGET_ID'),
      getSetting('YNAB_ACCOUNT_ID'),
    ]);

    return NextResponse.json({
      connected: !!token,
      budgetId: budgetId ?? null,
      accountId: accountId ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
