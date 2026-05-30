import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { getReconciliationStatus, applyReconciliation } from '@/lib/ynab-eur-reconciliation';
import { saveSettings } from '@/lib/settings';

// GET → fetch current balances and gap (no mutations)
export async function GET(_req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = await getReconciliationStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// POST { interestRate: number } → apply reconciliation
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let interestRate: number;
  try {
    const body = await req.json() as { interestRate?: unknown };
    if (typeof body.interestRate !== 'number' || body.interestRate < 0 || body.interestRate > 100) {
      return NextResponse.json({ error: 'interestRate must be a number between 0 and 100' }, { status: 400 });
    }
    interestRate = body.interestRate;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const result = await applyReconciliation(interestRate);

    await saveSettings({
      LAST_RUN_RECONCILIATION: JSON.stringify({
        runAt: new Date().toISOString(),
        gapAmount: result.adjustmentGbp,
        status: 'success',
      }),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // persist failure so dashboard reflects the error rather than last success
    await saveSettings({
      LAST_RUN_RECONCILIATION: JSON.stringify({
        runAt: new Date().toISOString(),
        status: 'error',
        gapAmount: null,
      }),
    }).catch(() => {});   // best-effort — don't mask original error
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
