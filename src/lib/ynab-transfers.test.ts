import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetSetting } = vi.hoisted(() => ({ mockGetSetting: vi.fn() }));

vi.mock('@/lib/settings', () => ({ getSetting: mockGetSetting }));

import {
  buildConversionMemo,
  deriveEurInputAmount,
  applyTransferFix,
  isPlausibleConversionAmount,
  isFeeOrInterest,
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
