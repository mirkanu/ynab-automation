import { getSetting } from '@/lib/settings';

const EUR_ACCOUNT_ID      = 'f53855ba-ce7a-46bd-beae-cb8c1035a9e5';
const WISE_INTEREST_PAYEE = '790f0d8a-8975-4e1a-8f6a-28e548ae0e52';
const WISE_PROFILE_ID     = '289679';

export interface ReconciliationStatus {
  wiseEurBalance:           number;   // EUR
  eurGbpRate:               number;
  wiseGbpEquivalent:        number;   // wiseEurBalance × rate
  ynabClearedBalance:       number;   // GBP
  gap:                      number;   // wiseGbpEquivalent − ynabClearedBalance; negative = problem
  lastReconciliationDate:   string | null;  // ISO date of last reconciliation adj
  daysSinceLastRecon:       number | null;
  clearedCount:             number;   // transactions that will be marked reconciled
  historicalRate:           number | null;  // Wise EUR->GBP rate on lastReconciliationDate, if lookup succeeded
  historicalRateDate:       string | null;  // actual timestamp Wise returned for the historical rate
  fxImpactGbp:              number | null;  // wiseEurBalance * (eurGbpRate - historicalRate), null if historicalRate unavailable
}

export interface ReconciliationResult {
  adjustmentGbp:           number;
  interestGbp:             number;
  interestSharePct:        number;   // % of gap explained by interest at given rate
  transactionsReconciled:  number;
  memo:                    string;
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
  const cl = res.headers.get('content-length');
  if (res.status === 204 || cl === '0') return null;
  return res.json();
}

export function computeInterestGbp(
  wiseEurBalance: number,
  interestRatePct: number,
  days: number,
  eurGbpRate: number,
): number {
  const interestEur = wiseEurBalance * (interestRatePct / 100) * (days / 365);
  return Math.round(interestEur * eurGbpRate * 100) / 100;
}

export function computeFxImpactGbp(
  wiseEurBalance: number,
  currentRate: number,
  historicalRate: number | null,
): number | null {
  if (historicalRate === null) return null;
  return wiseEurBalance * (currentRate - historicalRate);
}

export function computeExplainedPct(
  interestGbp: number,
  fxImpactGbp: number | null,
  gap: number,
): number {
  // Divide by the SIGNED gap, not its magnitude. interestGbp is always >= 0;
  // fxImpactGbp carries the sign of the underlying rate move (negative when
  // the rate dropped). For a negative gap, only a combination that is itself
  // negative and close in magnitude to gap actually explains it — dividing by
  // Math.abs(gap) here would flip the sign and silently invert the result.
  return ((interestGbp + (fxImpactGbp ?? 0)) / gap) * 100;
}

export function isWithinReconcileBand(explainedPct: number): boolean {
  return explainedPct >= 85 && explainedPct <= 115;
}

async function wiseFetch(wiseToken: string, path: string) {
  const res = await fetch(`https://api.wise.com${path}`, {
    headers: { 'Authorization': `Bearer ${wiseToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Wise GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchHistoricalRate(
  wiseToken: string,
  lastReconciliationDate: string | null,
): Promise<{ rate: number; time: string } | null> {
  if (lastReconciliationDate === null) return null;
  try {
    const ratesRaw = await wiseFetch(
      wiseToken,
      `/v1/rates?source=EUR&target=GBP&time=${lastReconciliationDate}T12:00:00Z`,
    );
    const rateObj = (ratesRaw as Array<{ rate: number; time: string }>)[0];
    if (!rateObj) return null;
    return { rate: rateObj.rate, time: rateObj.time };
  } catch {
    return null;
  }
}

export async function getReconciliationStatus(): Promise<ReconciliationStatus> {
  const ynabToken = await getSetting('YNAB_ACCESS_TOKEN');
  if (!ynabToken) throw new Error('YNAB_ACCESS_TOKEN not configured');
  const budgetId = await getSetting('YNAB_BUDGET_ID');
  if (!budgetId) throw new Error('YNAB_BUDGET_ID not configured');
  const wiseToken = process.env.WISE_API_TOKEN;
  if (!wiseToken) throw new Error('WISE_API_TOKEN env var not set');

  const [balancesRaw, ratesRaw, accountRaw, txnsRaw] = await Promise.all([
    wiseFetch(wiseToken, `/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`),
    wiseFetch(wiseToken, `/v1/rates?source=EUR&target=GBP`),
    ynabFetch(ynabToken, `/budgets/${budgetId}/accounts/${EUR_ACCOUNT_ID}`),
    ynabFetch(ynabToken, `/budgets/${budgetId}/accounts/${EUR_ACCOUNT_ID}/transactions`),
  ]);

  // Wise EUR balance
  const eurBalance = (balancesRaw as Array<{ currency: string; amount: { value: number } }>)
    .find(b => b.currency === 'EUR');
  if (!eurBalance) throw new Error('EUR balance not found in Wise response');
  const wiseEurBalance = eurBalance.amount.value;

  // EUR→GBP rate
  const rateObj = (ratesRaw as Array<{ rate: number }>)[0];
  if (!rateObj) throw new Error('EUR→GBP rate not returned by Wise');
  const eurGbpRate = rateObj.rate;

  const wiseGbpEquivalent = Math.round(wiseEurBalance * eurGbpRate * 1000) / 1000;

  // YNAB cleared balance (in GBP milliunits → convert to decimal)
  const ynabAccount = (accountRaw as { data: { account: { cleared_balance: number } } }).data.account;
  const ynabClearedBalance = ynabAccount.cleared_balance / 1000;

  const gap = Math.round((wiseGbpEquivalent - ynabClearedBalance) * 100) / 100;

  // Last reconciliation date + cleared-not-reconciled count
  interface Txn { id: string; date: string; cleared: string; deleted: boolean; payee_name: string | null }
  const txns = (txnsRaw as { data: { transactions: Txn[] } }).data.transactions
    .filter(t => !t.deleted);

  const reconciliationPayees = ['wise interest (reconciliation)', 'reconciliation balance adjustment'];
  const reconTxns = txns
    .filter(t => t.cleared === 'reconciled' && reconciliationPayees.includes((t.payee_name ?? '').toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastReconciliationDate = reconTxns[0]?.date ?? null;
  const daysSinceLastRecon = lastReconciliationDate
    ? Math.floor((Date.now() - new Date(lastReconciliationDate).getTime()) / 86_400_000)
    : null;

  const clearedCount = txns.filter(t => t.cleared === 'cleared').length;

  const historicalRateResult = await fetchHistoricalRate(wiseToken, lastReconciliationDate);
  const historicalRate = historicalRateResult?.rate ?? null;
  const historicalRateDate = historicalRateResult?.time ?? null;
  const fxImpactGbp = computeFxImpactGbp(wiseEurBalance, eurGbpRate, historicalRate);

  return {
    wiseEurBalance,
    eurGbpRate,
    wiseGbpEquivalent,
    ynabClearedBalance,
    gap,
    lastReconciliationDate,
    daysSinceLastRecon,
    clearedCount,
    historicalRate,
    historicalRateDate,
    fxImpactGbp,
  };
}

export async function applyReconciliation(
  interestRatePct: number,
): Promise<ReconciliationResult> {
  const ynabToken = await getSetting('YNAB_ACCESS_TOKEN');
  if (!ynabToken) throw new Error('YNAB_ACCESS_TOKEN not configured');
  const budgetId = await getSetting('YNAB_BUDGET_ID');
  if (!budgetId) throw new Error('YNAB_BUDGET_ID not configured');

  const status = await getReconciliationStatus();

  // days since last reconciliation, hoisted so both gap branches can use it
  const days = status.daysSinceLastRecon ?? 30;
  const interestGbp = computeInterestGbp(status.wiseEurBalance, interestRatePct, days, status.eurGbpRate);

  if (status.gap < 0) {
    const explainedPct = status.fxImpactGbp !== null
      ? computeExplainedPct(interestGbp, status.fxImpactGbp, status.gap)
      : null;
    if (explainedPct === null || !isWithinReconcileBand(explainedPct)) {
      throw new Error(
        `Wise GBP equivalent (£${status.wiseGbpEquivalent.toFixed(2)}) is LOWER than YNAB cleared balance (£${status.ynabClearedBalance.toFixed(2)}). Manual review required before reconciling.`,
      );
    }
    // explainedPct is non-null and in [85,115] here -- fall through to the shared
    // adjustment-creation + reconciliation-marking logic below, same as the positive-gap path.
  }

  if (status.gap === 0) {
    throw new Error('No gap to reconcile — YNAB already matches Wise.');
  }

  const interestSharePct = Math.round((interestGbp / status.gap) * 100);

  const adjustmentMilliunits = Math.round(status.gap * 1000);

  const wiseEurFmt  = status.wiseEurBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wiseGbpFmt  = status.wiseGbpEquivalent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let memo = `EUR${wiseEurFmt} to GBP${wiseGbpFmt}, interest ${interestRatePct}%`;
  if (status.gap < 0 && status.fxImpactGbp !== null && status.historicalRate !== null) {
    memo = `${memo}, FX impact £${status.fxImpactGbp.toFixed(2)} (rate ${status.historicalRate.toFixed(4)}->${status.eurGbpRate.toFixed(4)})`;
  }

  // Create reconciliation transaction
  await ynabFetch(ynabToken, `/budgets/${budgetId}/transactions`, {
    method: 'POST',
    body: JSON.stringify({
      transaction: {
        account_id: EUR_ACCOUNT_ID,
        date: new Date().toISOString().slice(0, 10),
        amount: adjustmentMilliunits,
        payee_id: WISE_INTEREST_PAYEE,
        memo,
        cleared: 'reconciled',
        approved: true,
      },
    }),
  });

  // Mark all cleared transactions as reconciled
  interface Txn { id: string; cleared: string; deleted: boolean }
  const txnsRaw = await ynabFetch(ynabToken, `/budgets/${budgetId}/accounts/${EUR_ACCOUNT_ID}/transactions`);
  const clearedIds = (txnsRaw as { data: { transactions: Txn[] } }).data.transactions
    .filter(t => !t.deleted && t.cleared === 'cleared')
    .map(t => t.id);

  let transactionsReconciled = 0;
  if (clearedIds.length > 0) {
    await ynabFetch(ynabToken, `/budgets/${budgetId}/transactions`, {
      method: 'PATCH',
      body: JSON.stringify({
        transactions: clearedIds.map(id => ({ id, cleared: 'reconciled' })),
      }),
    });
    transactionsReconciled = clearedIds.length;
  }

  return {
    adjustmentGbp: status.gap,
    interestGbp,
    interestSharePct,
    transactionsReconciled,
    memo,
  };
}
