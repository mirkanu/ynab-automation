import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { detectTransferPairs, applyTransferFix, TransferPair } from '@/lib/ynab-transfers';
import { saveSettings } from '@/lib/settings';

// GET ?dry=true  → detect pairs, no mutations
// POST           → detect pairs then apply fixes
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isDry = req.nextUrl.searchParams.get('dry') === 'true';

  if (!isDry) {
    return NextResponse.json({ error: 'Use ?dry=true for detection' }, { status: 400 });
  }

  try {
    const pairs = await detectTransferPairs();
    return NextResponse.json({ pairs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pairs: TransferPair[] = await detectTransferPairs();

    if (pairs.length === 0) {
      await saveSettings({
        LAST_RUN_TRANSFER_FIX: JSON.stringify({
          runAt: new Date().toISOString(),
          pairsFixed: 0,
          status: 'success',
        }),
      });
      return NextResponse.json({ fixed: 0, pairs: [], results: [] });
    }

    const results = await applyTransferFix(pairs);
    const succeeded = results.filter(r => r.success);
    const failed    = results.filter(r => !r.success);

    await saveSettings({
      LAST_RUN_TRANSFER_FIX: JSON.stringify({
        runAt: new Date().toISOString(),
        pairsFixed: succeeded.length,
        status: failed.length === 0 ? 'success' : 'partial',
      }),
    });

    return NextResponse.json({
      fixed: succeeded.length,
      failed: failed.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
