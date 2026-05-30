import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { getReconciliationStatus, applyReconciliation } from '@/lib/ynab-eur-reconciliation';

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
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
