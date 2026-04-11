import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { getSetting } from '@/lib/settings';

export async function GET(
  _request: Request,
  { params }: { params: { budgetId: string } },
) {
  try {
    const session = await getAdminSession();
    const wizardComplete = await getSetting('WIZARD_COMPLETE');
    if (!session.isLoggedIn && wizardComplete === 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getSetting('YNAB_ACCESS_TOKEN');
    if (!token) {
      return NextResponse.json({ error: 'YNAB_ACCESS_TOKEN not configured' }, { status: 400 });
    }

    const { budgetId } = params;

    const res = await fetch(
      `https://api.youneedabudget.com/v1/budgets/${budgetId}/accounts`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `YNAB API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as {
      data: {
        accounts: Array<{ id: string; name: string; deleted: boolean; closed: boolean }>;
      };
    };

    const accounts = data.data.accounts
      .filter((a) => !a.deleted && !a.closed)
      .map((a) => ({ id: a.id, name: a.name }));

    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
