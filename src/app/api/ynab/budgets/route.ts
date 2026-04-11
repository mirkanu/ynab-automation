import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { getSetting } from '@/lib/settings';

export async function GET() {
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

    const res = await fetch('https://api.youneedabudget.com/v1/budgets', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `YNAB API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as {
      data: {
        budgets: Array<{ id: string; name: string; last_modified_on: string }>;
      };
    };

    const budgets = data.data.budgets.map((b) => ({ id: b.id, name: b.name }));
    return NextResponse.json({ budgets });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
