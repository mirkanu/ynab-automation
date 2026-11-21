import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetSetting } = vi.hoisted(() => ({ mockGetSetting: vi.fn() }));

vi.mock('@/lib/settings', () => ({ getSetting: mockGetSetting }));

import {
  buildConversionMemo,
  deriveEurInputAmount,
  applyTransferFix,
  detectTransferPairs,
  isPlausibleConversionAmount,
  isFeeOrInterest,
  isConversionPayee,
  TransferPair,
} from './ynab-transfers';

const pair = (over: Partial<TransferPair> = {}): TransferPair => ({
  eurTxnId: 'eur-1',
  gbpTxnId: 'gbp-1',
  eurAmountMilliunits: -5_000_000,   // -5,000.00 — still the EUR value
  gbpAmountMilliunits: 4_260_310,   //  +4,260.31 GBP
  eurAccountId: 'acc-eur',
  gbpAccountId: 'acc-gbp',
  date: '2026-07-30',
  confidence: 95,
  eurMemo: '(skipped)',
  ...over,
});

describe('deriveEurInputAmount', () => {
  it('uses the raw EUR row amount when the row was never converted', () => {
    const eur = deriveEurInputAmount({
      eurAmountMilliunits: -5_000_000,
      eurMemo: '(skipped)',
      gbpAmountMilliunits: 4_260_310,
    });
    expect(eur).toBe(5_000);
  });

  it('uses the exact EUR figure from a "Converted X EUR to Y GBP" description', () => {
    const eur = deriveEurInputAmount({
      eurAmountMilliunits: -4_260_310,
      eurMemo: '-4,260.31 EUR (FX rate: 0.85453) · Converted 5,000.00 EUR to 4,260.31 GBP',
      gbpAmountMilliunits: 4_260_310,
    });
    expect(eur).toBe(5_000);
  });

  it('uses the EUR figure from an FX marker that holds the real input', () => {
    const eur = deriveEurInputAmount({
      eurAmountMilliunits: -2_127_230,
      eurMemo: '-2,487.55 EUR (FX rate: 0.85515)',
      gbpAmountMilliunits: 2_127_230,
    });
    expect(eur).toBe(2_487.55);
  });

  it('recovers the EUR input from the rate when the marker holds the GBP output', () => {
    const eur = deriveEurInputAmount({
      eurAmountMilliunits: -2_127_230,
      eurMemo: '-2,127.23 EUR (FX rate: 0.85453)',
      gbpAmountMilliunits: 2_127_230,
    });
    expect(eur).toBeCloseTo(2_127.23 / 0.85453, 2);
  });

  it('returns null when the EUR input cannot be determined', () => {
    const eur = deriveEurInputAmount({
      eurAmountMilliunits: -2_127_230,
      eurMemo: null,
      gbpAmountMilliunits: 2_127_230,
    });
    expect(eur).toBeNull();
  });
});

describe('buildConversionMemo', () => {
  it('explains the conversion and marks it as skipped', () => {
    const memo = buildConversionMemo({
      eurAmountMilliunits: -5_000_000,
      eurMemo: '(skipped)',
      gbpAmountMilliunits: 4_260_310,
    });
    expect(memo).toBe(
      '-5,000.00 EUR (FX rate: 0.85206) · Converted 5,000.00 EUR to 4,260.31 GBP using GSDlabs (skipped)',
    );
  });

  it('ends with the skip marker so the third-party converter leaves it alone', () => {
    const memo = buildConversionMemo({
      eurAmountMilliunits: -5_000_000,
      eurMemo: '(skipped)',
      gbpAmountMilliunits: 4_260_310,
    });
    expect(memo.endsWith('(skipped)')).toBe(true);
  });

  it('states the EUR amount as an outflow so the EUR reconciliation sums it correctly', () => {
    const memo = buildConversionMemo({
      eurAmountMilliunits: -5_000_000,
      eurMemo: '(skipped)',
      gbpAmountMilliunits: 4_260_310,
    });
    const first = memo.match(/([-\d,]+\.?\d*)\s+EUR/);
    expect(first).not.toBeNull();
    expect(Number(first![1].replace(/,/g, ''))).toBeLessThan(0);
  });

  it('carries the FX marker the third-party converter recognises', () => {
    const memo = buildConversionMemo({
      eurAmountMilliunits: -5_000_000,
      eurMemo: '(skipped)',
      gbpAmountMilliunits: 4_260_310,
    });
    expect(memo).toMatch(/-5,000\.00 EUR \(FX rate: 0\.85206\)/);
  });

  it('falls back to a GBP-only explanation when the EUR input is unknown', () => {
    const memo = buildConversionMemo({
      eurAmountMilliunits: -2_127_230,
      eurMemo: null,
      gbpAmountMilliunits: 2_127_230,
    });
    expect(memo).toBe('Converted to 2,127.23 GBP using GSDlabs (skipped)');
  });

  it('never writes a memo that could be re-converted: the EUR figure equals the EUR input', () => {
    const memo = buildConversionMemo({
      eurAmountMilliunits: -2_127_230,
      eurMemo: '-2,127.23 EUR (FX rate: 0.85453)',
      gbpAmountMilliunits: 2_127_230,
    });
    const eurFigure = memo.match(/^-([\d,.]+) EUR/);
    expect(eurFigure).not.toBeNull();
    const rate = Number(memo.match(/FX rate: ([\d.]+)/)![1]);
    const input = Number(eurFigure![1].replace(/,/g, ''));
    // Re-applying the recorded rate must reproduce the GBP amount exactly.
    expect(Math.round(input * rate * 100) / 100).toBe(2_127.23);
  });
});

describe('pairing guards', () => {
  it('rejects a grocery spend paired with an interest payment', () => {
    // €6.72 Spar on 2026-11-02 vs £3.11 interest on the same day.
    expect(isPlausibleConversionAmount(-6_720, 3_110)).toBe(false);
  });

  it('rejects amounts below the smallest sensible conversion', () => {
    expect(isPlausibleConversionAmount(-120_00, 100_00)).toBe(false);
  });

  it('accepts an unconverted EUR amount (≈1.17× the GBP side)', () => {
    expect(isPlausibleConversionAmount(-5_000_000, 4_260_310)).toBe(true);
  });

  it('accepts an already converted EUR amount (≈1.0× the GBP side)', () => {
    expect(isPlausibleConversionAmount(-2_127_230, 2_127_230)).toBe(true);
  });

  it('recognises fees and interest as never being part of a conversion', () => {
    expect(isFeeOrInterest('Wise Fee')).toBe(true);
    expect(isFeeOrInterest('Assets Service Fee')).toBe(true);
    expect(isFeeOrInterest('Interest payment')).toBe(true);
    expect(isFeeOrInterest('Transfer : Wise (GBP)')).toBe(false);
    expect(isFeeOrInterest(null)).toBe(false);
  });

  it('treats a payee whose only "fee" sits in a trailing qualifier as a conversion, not a fee', () => {
    expect(isFeeOrInterest('Converted Eur Gbp (fee Eur)')).toBe(false);
    expect(isFeeOrInterest('Sent Money To Manuel Kuhs (fee Eur)')).toBe(false);
  });

  it('does not treat a word that merely contains "fee" as a fee', () => {
    expect(isFeeOrInterest('Coffee')).toBe(false);
    expect(isFeeOrInterest('')).toBe(false);
  });

  it('still recognises interest behind a trailing qualifier', () => {
    expect(isFeeOrInterest('Wise Interest (Reconciliation)')).toBe(true);
  });
});

describe('conversion payee guard', () => {
  it('accepts payees that read as a conversion or a money-out', () => {
    expect(isConversionPayee('Converted Eur Gbp (fee Eur)')).toBe(true);
    expect(isConversionPayee('Sent Money To Manuel Kuhs (fee Eur)')).toBe(true);
    expect(isConversionPayee('Transfer : UK Current')).toBe(true);
    expect(isConversionPayee('Converted 1,000.00 EUR to 829.62 GBP')).toBe(true);
  });

  it('rejects ordinary spends so a real transaction can never be deleted', () => {
    expect(isConversionPayee('Amazon')).toBe(false);
    expect(isConversionPayee('Coffee')).toBe(false);
    expect(isConversionPayee('Irish Rail Pearse')).toBe(false);
    expect(isConversionPayee(null)).toBe(false);
  });
});

describe('applyTransferFix — conversion memo', () => {
  let calls: { method: string; url: string; body: unknown }[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSetting.mockImplementation(async (key: string) =>
      key === 'YNAB_ACCESS_TOKEN' ? 'test-token' : 'test-budget',
    );
    calls = [];
    vi.stubGlobal('fetch', async (url: string, opts: RequestInit = {}) => {
      const body = opts.body ? JSON.parse(opts.body as string) : undefined;
      calls.push({ method: opts.method ?? 'GET', url, body });
      const json = (payload: unknown) => ({
        ok: true,
        status: 200,
        headers: { get: () => '2' },
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });
      if (url.endsWith('/transactions/gbp-1') && (opts.method ?? 'GET') === 'GET') {
        return json({ data: { transaction: { id: 'gbp-1', transfer_transaction_id: 'counterpart-1' } } });
      }
      return json({ data: { transaction: { id: 'x' } } });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the same conversion memo to the GBP transaction and the counterpart', async () => {
    const results = await applyTransferFix([pair()]);

    expect(results[0].success).toBe(true);
    const expected =
      '-5,000.00 EUR (FX rate: 0.85206) · Converted 5,000.00 EUR to 4,260.31 GBP using GSDlabs (skipped)';
    expect(results[0].memo).toBe(expected);

    const gbpPut = calls.find(c => c.method === 'PUT' && c.url.endsWith('/transactions/gbp-1'));
    const counterpartPut = calls.find(c => c.method === 'PUT' && c.url.endsWith('/transactions/counterpart-1'));
    expect(gbpPut).toBeDefined();
    expect(counterpartPut).toBeDefined();
    expect((gbpPut!.body as { transaction: { memo: string } }).transaction.memo).toBe(expected);
    expect((counterpartPut!.body as { transaction: { memo: string } }).transaction.memo).toBe(expected);
  });

  it('still sets the transfer payee and marks the counterpart cleared', async () => {
    await applyTransferFix([pair()]);

    const gbpPut = calls.find(c => c.method === 'PUT' && c.url.endsWith('/transactions/gbp-1'));
    const gbpTxn = (gbpPut!.body as { transaction: Record<string, unknown> }).transaction;
    expect(gbpTxn.payee_id).toBe('cef18ed9-e100-4dc5-b742-62b2d780da9b');

    const counterpartPut = calls.find(c => c.method === 'PUT' && c.url.endsWith('/transactions/counterpart-1'));
    const counterpart = (counterpartPut!.body as { transaction: Record<string, unknown> }).transaction;
    expect(counterpart.cleared).toBe('cleared');
    expect(counterpart.approved).toBe(true);
  });
});

const EUR_ACCOUNT_ID = 'f53855ba-ce7a-46bd-beae-cb8c1035a9e5';
const UK_CURRENT_ID = '5bfba3fe-b8d4-41e1-8acb-c10459c99534';
const GBP_WISE_ID   = '6f470dd5-67e4-4580-82ee-74154cd26f3c';

const eurRows = [
  // The two raw Wise conversion legs on 2026-11-18.
  { id: 'eur-a-raw', date: '2026-11-18', amount: -995_220,   payee_name: 'Converted Eur Gbp (fee Eur)',          memo: null, transfer_account_id: null, deleted: false },
  { id: 'eur-b-raw', date: '2026-11-18', amount: -1_989_920, payee_name: 'Sent Money To Manuel Kuhs (fee Eur)', memo: null, transfer_account_id: null, deleted: false },
  // The other half of an EXISTING YNAB transfer pair — must never be a EUR candidate.
  { id: 'eur-existing-transfer-out', date: '2026-11-18', amount: -1_658_700, payee_name: 'Transfer : UK Current', memo: null, transfer_account_id: UK_CURRENT_ID, deleted: false },
  // The two Wise fees — they stay in the budget.
  { id: 'eur-fee-a', date: '2026-11-18', amount: -10_080, payee_name: 'Wise Fee', memo: null, transfer_account_id: null, deleted: false },
  { id: 'eur-fee-b', date: '2026-11-18', amount: -4_780,  payee_name: 'Wise Fee', memo: null, transfer_account_id: null, deleted: false },
];

const ukRows = [
  // A same-date GBP inflow that is NOT a conversion. It comes first in
  // the list, so a detector that grabs "the first same-date candidate"
  // loses both real pairs — this is the R3 regression case.
  { id: 'uk-noise', date: '2026-11-18', amount: 3_000_000, payee_name: 'Refund', memo: null, transfer_account_id: null, deleted: false },
  // Pair B's GBP leg: already a transfer OUT of the €Wise Euro account.
  { id: 'uk-b-leg', date: '2026-11-18', amount: 1_658_700, payee_name: 'Transfer : €Wise Euro', memo: null, transfer_account_id: EUR_ACCOUNT_ID, deleted: false },
];

const gbpWiseRows = [
  // Pair A's GBP leg.
  { id: 'gbp-a-leg', date: '2026-11-18', amount: 829_620, payee_name: 'Converted 1,000.00 EUR to 829.62 GBP', memo: null, transfer_account_id: null, deleted: false },
];

function stubYnabTransactions(accounts: Record<string, unknown[]>) {
  vi.stubGlobal('fetch', async (url: string) => {
    const match = url.match(/\/accounts\/([^/]+)\/transactions/);
    const transactions = accounts[match ? match[1] : ''] ?? [];
    const payload = { data: { transactions } };
    return {
      ok: true,
      status: 200,
      headers: { get: () => '2' },
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  });
}

describe('detectTransferPairs', () => {
  let savedCurrencyAccounts: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSetting.mockImplementation(async (key: string) =>
      key === 'YNAB_ACCESS_TOKEN' ? 'test-token' : 'test-budget',
    );
    savedCurrencyAccounts = process.env.CURRENCY_ACCOUNTS;
    process.env.CURRENCY_ACCOUNTS = JSON.stringify({ EUR: EUR_ACCOUNT_ID });
    stubYnabTransactions({
      [EUR_ACCOUNT_ID]: eurRows,
      [UK_CURRENT_ID]: ukRows,
      [GBP_WISE_ID]: gbpWiseRows,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedCurrencyAccounts === undefined) delete process.env.CURRENCY_ACCOUNTS;
    else process.env.CURRENCY_ACCOUNTS = savedCurrencyAccounts;
  });

  it('finds both 2026-11-18 Wise conversions', async () => {
    const pairs = await detectTransferPairs();
    expect(pairs).toHaveLength(2);

    const pairA = pairs.find(p => p.eurTxnId === 'eur-a-raw');
    const pairB = pairs.find(p => p.eurTxnId === 'eur-b-raw');
    expect(pairA).toBeDefined();
    expect(pairB).toBeDefined();

    expect(pairA!.gbpTxnId).toBe('gbp-a-leg');
    expect(pairA!.eurAmountMilliunits).toBe(-995_220);
    expect(pairA!.gbpAmountMilliunits).toBe(829_620);
    expect(pairA!.gbpAccountId).toBe(GBP_WISE_ID);
    expect(pairA!.confidence).toBe(95);

    expect(pairB!.gbpTxnId).toBe('uk-b-leg');
    expect(pairB!.eurAmountMilliunits).toBe(-1_989_920);
    expect(pairB!.gbpAmountMilliunits).toBe(1_658_700);
    expect(pairB!.gbpAccountId).toBe(UK_CURRENT_ID);
    expect(pairB!.confidence).toBe(80);
  });

  it('writes a memo that uses the raw EUR row amount and does not fold in the Wise fees', async () => {
    const pairs = await detectTransferPairs();
    const pairA = pairs.find(p => p.eurTxnId === 'eur-a-raw')!;
    const pairB = pairs.find(p => p.eurTxnId === 'eur-b-raw')!;

    expect(pairA.eurMemo).toBeNull();
    expect(pairB.eurMemo).toBeNull();

    const memoA = buildConversionMemo({
      eurAmountMilliunits: pairA.eurAmountMilliunits,
      eurMemo: pairA.eurMemo,
      gbpAmountMilliunits: pairA.gbpAmountMilliunits,
    });
    const memoB = buildConversionMemo({
      eurAmountMilliunits: pairB.eurAmountMilliunits,
      eurMemo: pairB.eurMemo,
      gbpAmountMilliunits: pairB.gbpAmountMilliunits,
    });

    expect(memoA).toMatch(
      /^-995\.22 EUR \(FX rate: 0\.8336\d\) · Converted 995\.22 EUR to 829\.62 GBP using GSDlabs \(skipped\)$/,
    );
    expect(memoB).toBe(
      '-1,989.92 EUR (FX rate: 0.83355) · Converted 1,989.92 EUR to 1,658.70 GBP using GSDlabs (skipped)',
    );

    // The recorded rate must reproduce the GBP amount exactly.
    const rate = Number(memoA.match(/FX rate: ([\d.]+)/)![1]);
    expect(Math.round(995.22 * rate * 100) / 100).toBe(829.62);
  });

  it('never pairs an ordinary spend with a same-date GBP inflow', async () => {
    stubYnabTransactions({
      [EUR_ACCOUNT_ID]: [
        { id: 'eur-spend', date: '2026-11-18', amount: -2_300_000, payee_name: 'Amazon', memo: null, transfer_account_id: null, deleted: false },
      ],
      [UK_CURRENT_ID]: [
        { id: 'uk-inflow', date: '2026-11-18', amount: 2_076_780, payee_name: 'Refund', memo: null, transfer_account_id: null, deleted: false },
      ],
      [GBP_WISE_ID]: [],
    });
    const pairs = await detectTransferPairs();
    expect(pairs).toEqual([]);
  });
});
