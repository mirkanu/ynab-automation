import { getSetting } from '@/lib/settings'; // used for YNAB_ACCESS_TOKEN and YNAB_BUDGET_ID

// Hardcoded account IDs — prototyped and verified 2026-05-29
const UK_CURRENT_ID = '5bfba3fe-b8d4-41e1-8acb-c10459c99534';
const GBP_WISE_ID   = '6f470dd5-67e4-4580-82ee-74154cd26f3c';
const TRANSFER_PAYEE_ID = 'cef18ed9-e100-4dc5-b742-62b2d780da9b'; // "Transfer : €Wise Euro"

export interface TransferPair {
  eurTxnId: string;
  gbpTxnId: string;
  eurAmountMilliunits: number;  // negative (outflow from €Wise Euro)
  gbpAmountMilliunits: number;  // positive (inflow to GBP account)
  eurAccountId: string;
  gbpAccountId: string;
  date: string;           // YYYY-MM-DD
  confidence: number;     // 0-100
}

export interface FixResult {
  eurTxnId: string;
  gbpTxnId: string;
  eurAmountMilliunits: number;
  gbpAmountMilliunits: number;
  date: string;
  success: boolean;
  error?: string;
}

interface YnabTxn {
  id: string;
  date: string;
  amount: number;
  payee_name: string | null;
  transfer_account_id: string | null;
  deleted: boolean;
  transfer_transaction_id?: string | null;
}

async function ynabFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(`https://api.youneedabudget.com/v1${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YNAB ${opts?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  // DELETE returns 200 with a JSON body; others also return JSON
  const contentLength = res.headers.get('content-length');
  if (res.status === 204 || contentLength === '0') return null;
  return res.json();
}

// Returns ISO date string for N days ago
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function detectTransferPairs(): Promise<TransferPair[]> {
  const token = await getSetting('YNAB_ACCESS_TOKEN');
  if (!token) throw new Error('YNAB_ACCESS_TOKEN not configured in settings');
  const budgetId = await getSetting('YNAB_BUDGET_ID');
  if (!budgetId) throw new Error('YNAB_BUDGET_ID not configured in settings');
  const currencyAccountsRaw = process.env.CURRENCY_ACCOUNTS;
  if (!currencyAccountsRaw) throw new Error('CURRENCY_ACCOUNTS env var not configured');
  let currencyAccounts: Record<string, string>;
  try {
    currencyAccounts = JSON.parse(currencyAccountsRaw) as Record<string, string>;
  } catch {
    throw new Error('CURRENCY_ACCOUNTS env var is not valid JSON');
  }
  const eurAccountId = currencyAccounts['EUR'];
  if (!eurAccountId) throw new Error('EUR account not found in CURRENCY_ACCOUNTS');

  const sinceDate = daysAgo(7);

  // Fetch EUR outgoing txns
  const eurData = await ynabFetch(token, `/budgets/${budgetId}/accounts/${eurAccountId}/transactions?since_date=${sinceDate}`);
  const eurTxns = (eurData?.data?.transactions ?? []) as YnabTxn[];

  // EUR outgoing candidates: negative amount, not deleted, not already a transfer, not a fee
  const eurOutgoing = eurTxns.filter(t =>
    !t.deleted &&
    t.amount < 0 &&
    t.transfer_account_id === null &&
    !(t.payee_name ?? '').toLowerCase().includes('wise fee')
  );

  if (eurOutgoing.length === 0) return [];

  // Fetch GBP incoming txns from both GBP accounts
  const [ukData, gbpWiseData] = await Promise.all([
    ynabFetch(token, `/budgets/${budgetId}/accounts/${UK_CURRENT_ID}/transactions?since_date=${sinceDate}`),
    ynabFetch(token, `/budgets/${budgetId}/accounts/${GBP_WISE_ID}/transactions?since_date=${sinceDate}`),
  ]);

  const gbpTxns = [
    ...((ukData?.data?.transactions ?? []) as YnabTxn[]).map(t => ({ ...t, accountId: UK_CURRENT_ID })),
    ...((gbpWiseData?.data?.transactions ?? []) as YnabTxn[]).map(t => ({ ...t, accountId: GBP_WISE_ID })),
  ].filter(t => !t.deleted && t.amount > 0 && t.transfer_account_id === null);

  const pairs: TransferPair[] = [];
  const usedGbpIds = new Set<string>();

  for (const eur of eurOutgoing) {
    const matchingGbp = gbpTxns.find(g => g.date === eur.date && !usedGbpIds.has(g.id));
    if (!matchingGbp) continue;
    usedGbpIds.add(matchingGbp.id);

    const payee = (eur.payee_name ?? '').toLowerCase();
    const confidence = payee.includes('converted') ? 95 : 80;

    pairs.push({
      eurTxnId: eur.id,
      gbpTxnId: matchingGbp.id,
      eurAmountMilliunits: eur.amount,
      gbpAmountMilliunits: matchingGbp.amount,
      eurAccountId,
      gbpAccountId: matchingGbp.accountId,
      date: eur.date,
      confidence,
    });
  }

  return pairs;
}

export async function applyTransferFix(pairs: TransferPair[]): Promise<FixResult[]> {
  const token = await getSetting('YNAB_ACCESS_TOKEN');
  if (!token) throw new Error('YNAB_ACCESS_TOKEN not configured in settings');
  const budgetId = await getSetting('YNAB_BUDGET_ID');
  if (!budgetId) throw new Error('YNAB_BUDGET_ID not configured in settings');

  const results: FixResult[] = [];

  for (const pair of pairs) {
    let eurDeleted = false;
    try {
      // Step 1: Delete raw EUR outgoing txn
      await ynabFetch(token, `/budgets/${budgetId}/transactions/${pair.eurTxnId}`, { method: 'DELETE' });
      eurDeleted = true;

      // Step 2: Update GBP incoming txn payee to "Transfer : €Wise Euro"
      await ynabFetch(token, `/budgets/${budgetId}/transactions/${pair.gbpTxnId}`, {
        method: 'PUT',
        body: JSON.stringify({ transaction: { payee_id: TRANSFER_PAYEE_ID } }),
      });

      // Step 3: Fetch the updated GBP txn to get transfer_transaction_id (the auto-created counterpart)
      const updatedGbp = await ynabFetch(token, `/budgets/${budgetId}/transactions/${pair.gbpTxnId}`);
      const counterpartId = updatedGbp?.data?.transaction?.transfer_transaction_id as string | null | undefined;

      if (counterpartId) {
        await ynabFetch(token, `/budgets/${budgetId}/transactions/${counterpartId}`, {
          method: 'PUT',
          body: JSON.stringify({ transaction: { cleared: 'cleared', approved: true } }),
        });
      }

      results.push({
        eurTxnId: pair.eurTxnId,
        gbpTxnId: pair.gbpTxnId,
        eurAmountMilliunits: pair.eurAmountMilliunits,
        gbpAmountMilliunits: pair.gbpAmountMilliunits,
        date: pair.date,
        success: true,
      });
    } catch (err) {
      const baseMessage = err instanceof Error ? err.message : String(err);
      const errorMessage = eurDeleted
        ? `EUR txn deleted but GBP update failed — manual cleanup required: ${baseMessage}`
        : baseMessage;
      results.push({
        eurTxnId: pair.eurTxnId,
        gbpTxnId: pair.gbpTxnId,
        eurAmountMilliunits: pair.eurAmountMilliunits,
        gbpAmountMilliunits: pair.gbpAmountMilliunits,
        date: pair.date,
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}
