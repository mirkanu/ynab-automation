import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import {
  detectTransferPairs,
  applyTransferFix,
  buildConversionMemo,
  TransferPair,
} from '@/lib/ynab-transfers';
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
    // Show the memo that would be written, so the outcome is visible before
    // anything is changed.
    const pairsWithMemo = pairs.map(pair => ({
      ...pair,
      memo: buildConversionMemo({
        eurAmountMilliunits: pair.eurAmountMilliunits,
        eurMemo: pair.eurMemo ?? null,
        gbpAmountMilliunits: pair.gbpAmountMilliunits,
      }),
    }));
    return NextResponse.json({ pairs: pairsWithMemo });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The body carries ONLY the selected eurTxnIds. Amounts, dates and gbpTxnIds
  // are never read from the request — they always come from the server-detected
  // pairs below, so a client cannot make this endpoint touch an arbitrary txn.
  let requestedIds: string[] = [];
  try {
    const body = await req.json();
    const raw = (body as { eurTxnIds?: unknown } | null)?.eurTxnIds;
    if (Array.isArray(raw)) {
      requestedIds = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
  } catch {
    // No body / empty body / non-JSON body → treated as "no selection supplied".
    // This keeps the original no-body POST working.
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

    let selected: TransferPair[];
    if (requestedIds.length === 0) {
      if (pairs.length > 1) {
        return NextResponse.json(
          { error: 'Multiple transfer pairs detected. Select which transfers to fix before running.' },
          { status: 400 },
        );
      }
      selected = pairs; // exactly one pair → original behaviour
    } else {
      const requested = new Set(requestedIds);
      selected = pairs.filter(p => requested.has(p.eurTxnId));
      if (selected.length === 0) {
        return NextResponse.json(
          { error: 'None of the selected transactions are a detected EUR→GBP transfer pair.' },
          { status: 400 },
        );
      }
    }

    const results = await applyTransferFix(selected);
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
    // persist failure so dashboard reflects the error rather than last success
    await saveSettings({
      LAST_RUN_TRANSFER_FIX: JSON.stringify({
        runAt: new Date().toISOString(),
        status: 'error',
        pairsFixed: 0,
      }),
    }).catch(() => {});   // best-effort — don't mask original error
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
