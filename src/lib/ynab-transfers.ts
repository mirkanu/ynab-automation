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
  eurMemo: string | null; // memo of the raw EUR row, captured before it is deleted
}

export interface FixResult {
  eurTxnId: string;
  gbpTxnId: string;
  eurAmountMilliunits: number;
  gbpAmountMilliunits: number;
  date: string;
  success: boolean;
  error?: string;
  memo?: string;          // conversion memo written to both sides of the pair
}

interface YnabTxn {
  id: string;
  date: string;
  amount: number;
  payee_name: string | null;
  memo: string | null;
  transfer_account_id: string | null;
  deleted: boolean;
  transfer_transaction_id?: string | null;
}

// ---------------------------------------------------------------------------
// Conversion memo
//
// Every EUR→GBP pair we fix gets a memo explaining the conversion. The memo
// carries three machine-readable markers, all of them deliberate:
//
//   "-2,487.55 EUR (FX rate: 0.85515)"
//       Same shape as the marker the third-party converter writes, so it is
//       recognised as "already converted" and never converted a second time.
//       The amount is negative because it is an outflow from the EUR balance —
//       that is the sign the EUR reconciliation reads out of memos.
//
//   "Converted 2,487.55 EUR to 2,127.23 GBP"
//       The human-readable explanation.
//
//   "(skipped)"
//       The marker the third-party converter appends to every transaction the
//       user skips there. Writing it ourselves means that converter skips the
//       transaction on its own, so it no longer has to be skipped by hand.
// ---------------------------------------------------------------------------

const MEMO_TOOL_TAG = 'GSDlabs';
const MEMO_SKIP_MARKER = '(skipped)';

export interface ConversionMemoInput {
  /** Raw EUR row amount in milliunits (negative) as detected before the fix */
  eurAmountMilliunits: number;
  /** Raw EUR row memo as detected before the fix (may be null) */
  eurMemo: string | null;
  /** GBP inflow amount in milliunits (positive) */
  gbpAmountMilliunits: number;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatAmount(value: number): string {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Works out how many EUR were converted into the GBP inflow.
 *
 * The €Wise Euro account holds GBP values, so the EUR input is not always
 * available directly. Three sources, best first:
 *
 *  1. The converter's own description, e.g. "Converted 5,000.00 EUR to
 *     4,260.31 GBP" — an exact record of the original amount.
 *  2. Its FX marker, e.g. "-2,127.23 EUR (FX rate: 0.85453)". That marker
 *     sometimes carries the GBP output instead of the EUR input; when the
 *     number matches the GBP amount the input is recovered from the rate.
 *  3. The raw EUR row amount itself, which is still the EUR value as long as
 *     the row was never converted.
 */
export function deriveEurInputAmount(input: ConversionMemoInput): number | null {
  const gbp = Math.abs(input.gbpAmountMilliunits) / 1000;
  const eurRaw = Math.abs(input.eurAmountMilliunits) / 1000;
  const memo = input.eurMemo ?? '';

  const described = memo.match(
    /Converted\s+([\d,]+(?:\.\d+)?)\s*EUR\s+to\s+([\d,]+(?:\.\d+)?)\s*GBP/i,
  );
  if (described) {
    const eur = parseAmount(described[1]);
    if (eur !== null) return eur;
  }

  const marked = memo.match(/(-?[\d,]+(?:\.\d+)?)\s*EUR\s*\(FX rate:\s*([\d.]+)\)/i);
  if (marked) {
    const figure = parseAmount(marked[1]);
    const rate = parseAmount(marked[2]);
    if (figure !== null && rate) {
      if (gbp > 0 && Math.abs(Math.abs(figure) - gbp) / gbp <= 0.01) {
        // The marker holds the GBP output — recover the EUR input from the rate.
        return Math.round((gbp / rate) * 100) / 100;
      }
      return Math.abs(figure);
    }
  }

  if (gbp > 0 && Math.abs(eurRaw - gbp) / gbp > 0.01) {
    // Row was never converted — its amount is still the EUR input.
    return Math.round(eurRaw * 100) / 100;
  }

  return null;
}

export function buildConversionMemo(input: ConversionMemoInput): string {
  const gbp = Math.abs(input.gbpAmountMilliunits) / 1000;
  const eur = deriveEurInputAmount(input);
  const gbpText = formatAmount(gbp);

  if (eur === null) {
    // EUR input unknown — still explain the conversion and still mark it as
    // skipped so the third-party converter leaves it alone.
    return `Converted to ${gbpText} GBP using ${MEMO_TOOL_TAG} ${MEMO_SKIP_MARKER}`;
  }

  const eurText = formatAmount(eur);
  const rate = (gbp / eur).toFixed(5);
  return `-${eurText} EUR (FX rate: ${rate}) · Converted ${eurText} EUR to ${gbpText} GBP using ${MEMO_TOOL_TAG} ${MEMO_SKIP_MARKER}`;
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

// Fees and interest are never the EUR side of a conversion, and a fee or
// interest credit on the GBP side is never the other half of one.
const FEE_OR_INTEREST_PATTERNS = ['fee', 'interest'];

export function isFeeOrInterest(payeeName: string | null): boolean {
  const payee = (payeeName ?? '').toLowerCase();
  return FEE_OR_INTEREST_PATTERNS.some(p => payee.includes(p));
}

// Smallest conversion worth pairing, in milliunits (£50). The smallest real
// conversion on record is £860.
const CONVERSION_MIN_MILLIUNITS = 50_000;

// A EUR→GBP conversion moves money at the EUR→GBP rate, so the EUR side is
// either the unconverted EUR amount (≈1.17× the GBP side) or an already
// converted GBP amount (≈1.0×).
const CONVERSION_RATIO_MIN = 0.9;
const CONVERSION_RATIO_MAX = 1.35;

export function isPlausibleConversionAmount(
  eurMilliunits: number,
  gbpMilliunits: number,
): boolean {
  const gbp = Math.abs(gbpMilliunits);
  const eur = Math.abs(eurMilliunits);
  if (gbp < CONVERSION_MIN_MILLIUNITS) return false;
  const ratio = eur / gbp;
  return ratio >= CONVERSION_RATIO_MIN && ratio <= CONVERSION_RATIO_MAX;
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
    !isFeeOrInterest(t.payee_name)
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
  ].filter(t => !t.deleted && t.amount > 0 && t.transfer_account_id === null && !isFeeOrInterest(t.payee_name));

  const pairs: TransferPair[] = [];
  const usedGbpIds = new Set<string>();

  for (const eur of eurOutgoing) {
    const matchingGbp = gbpTxns.find(g => g.date === eur.date && !usedGbpIds.has(g.id));
    if (!matchingGbp) continue;

    // Guard against pairing two unrelated transactions that happen to share a
    // date. A EUR→GBP conversion always moves money at the EUR→GBP rate, so
    // the EUR side is either the unconverted EUR amount (≈1.17× the GBP side)
    // or an already converted GBP amount (≈1.0×). Anything outside that band
    // is not a conversion — e.g. a €6.72 grocery spend next to a £3.11
    // interest payment. Fixing such a pair would delete a real transaction.
    if (!isPlausibleConversionAmount(eur.amount, matchingGbp.amount)) continue;

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
      eurMemo: eur.memo ?? null,
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
      // The memo is built before the raw EUR row is deleted — the EUR input
      // amount often only exists on that row.
      const memo = buildConversionMemo({
        eurAmountMilliunits: pair.eurAmountMilliunits,
        eurMemo: pair.eurMemo ?? null,
        gbpAmountMilliunits: pair.gbpAmountMilliunits,
      });

      // Step 1: Delete raw EUR outgoing txn
      await ynabFetch(token, `/budgets/${budgetId}/transactions/${pair.eurTxnId}`, { method: 'DELETE' });
      eurDeleted = true;

      // Step 2: Update GBP incoming txn payee to "Transfer : €Wise Euro" and
      // write the conversion memo. YNAB copies the memo onto the counterpart
      // it creates, but it is set explicitly on both sides below so neither
      // side depends on that behaviour.
      await ynabFetch(token, `/budgets/${budgetId}/transactions/${pair.gbpTxnId}`, {
        method: 'PUT',
        body: JSON.stringify({ transaction: { payee_id: TRANSFER_PAYEE_ID, memo } }),
      });

      // Step 3: Fetch the updated GBP txn to get transfer_transaction_id (the auto-created counterpart)
      const updatedGbp = await ynabFetch(token, `/budgets/${budgetId}/transactions/${pair.gbpTxnId}`);
      const counterpartId = updatedGbp?.data?.transaction?.transfer_transaction_id as string | null | undefined;

      if (counterpartId) {
        await ynabFetch(token, `/budgets/${budgetId}/transactions/${counterpartId}`, {
          method: 'PUT',
          body: JSON.stringify({ transaction: { cleared: 'cleared', approved: true, memo } }),
        });
      }

      results.push({
        eurTxnId: pair.eurTxnId,
        gbpTxnId: pair.gbpTxnId,
        eurAmountMilliunits: pair.eurAmountMilliunits,
        gbpAmountMilliunits: pair.gbpAmountMilliunits,
        date: pair.date,
        success: true,
        memo,
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
