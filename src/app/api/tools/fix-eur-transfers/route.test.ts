import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const {
  mockGetAdminSession,
  mockDetectTransferPairs,
  mockApplyTransferFix,
  mockBuildConversionMemo,
  mockSaveSettings,
} = vi.hoisted(() => ({
  mockGetAdminSession: vi.fn(),
  mockDetectTransferPairs: vi.fn(),
  mockApplyTransferFix: vi.fn(),
  mockBuildConversionMemo: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

vi.mock('@/lib/admin-session', () => ({ getAdminSession: mockGetAdminSession }));

vi.mock('@/lib/ynab-transfers', () => ({
  detectTransferPairs: mockDetectTransferPairs,
  applyTransferFix: mockApplyTransferFix,
  buildConversionMemo: mockBuildConversionMemo,
}));

vi.mock('@/lib/settings', () => ({ saveSettings: mockSaveSettings }));

import { POST, GET } from './route';

// --- Fixtures ---

const pairA = {
  eurTxnId: 'eur-a',
  gbpTxnId: 'gbp-a',
  eurAmountMilliunits: -100000,
  gbpAmountMilliunits: 85000,
  eurAccountId: 'acc-eur',
  gbpAccountId: 'acc-gbp',
  date: '2026-11-01',
  confidence: 95,
  eurMemo: null,
};

const pairB = {
  eurTxnId: 'eur-b',
  gbpTxnId: 'gbp-b',
  eurAmountMilliunits: -200000,
  gbpAmountMilliunits: 170000,
  eurAccountId: 'acc-eur',
  gbpAccountId: 'acc-gbp',
  date: '2026-11-03',
  confidence: 80,
  eurMemo: null,
};

function postReq(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/tools/fix-eur-transfers', {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminSession.mockResolvedValue({ isLoggedIn: true });
  mockDetectTransferPairs.mockResolvedValue([pairA]);
  mockApplyTransferFix.mockResolvedValue([]);
  mockBuildConversionMemo.mockReturnValue('-100.00 EUR (FX rate: 0.85000) · Converted 100.00 EUR to 85.00 GBP using GSDlabs (skipped)');
  mockSaveSettings.mockResolvedValue(undefined);
});

describe('GET /api/tools/fix-eur-transfers — dry run', () => {
  it('returns the detected pairs with the memo that would be written', async () => {
    const res = await GET(new NextRequest('http://localhost/api/tools/fix-eur-transfers?dry=true'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pairs).toHaveLength(1);
    expect(data.pairs[0].memo).toContain('using GSDlabs');
    expect(mockBuildConversionMemo).toHaveBeenCalledWith({
      eurAmountMilliunits: pairA.eurAmountMilliunits,
      eurMemo: pairA.eurMemo ?? null,
      gbpAmountMilliunits: pairA.gbpAmountMilliunits,
    });
  });

  it('changes nothing', async () => {
    await GET(new NextRequest('http://localhost/api/tools/fix-eur-transfers?dry=true'));
    expect(mockApplyTransferFix).not.toHaveBeenCalled();
  });

  it('returns 401 when the caller is not logged in', async () => {
    mockGetAdminSession.mockResolvedValue({ isLoggedIn: false });
    const res = await GET(new NextRequest('http://localhost/api/tools/fix-eur-transfers?dry=true'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tools/fix-eur-transfers — selection handling', () => {
  it('fixes the single detected pair when POSTed with no body (backwards compatible)', async () => {
    const res = await POST(postReq());

    expect(res.status).toBe(200);
    expect(mockApplyTransferFix).toHaveBeenCalledTimes(1);
    expect(mockApplyTransferFix.mock.calls[0][0]).toEqual([pairA]);
  });

  it('returns 400 and does not fix anything when no body is sent and multiple pairs are detected', async () => {
    mockDetectTransferPairs.mockResolvedValue([pairA, pairB]);

    const res = await POST(postReq());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/select/i);
    expect(mockApplyTransferFix).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('fixes only the selected pair when a single id is supplied out of two detected pairs', async () => {
    mockDetectTransferPairs.mockResolvedValue([pairA, pairB]);

    const res = await POST(postReq({ eurTxnIds: [pairA.eurTxnId] }));

    expect(res.status).toBe(200);
    expect(mockApplyTransferFix).toHaveBeenCalledTimes(1);
    expect(mockApplyTransferFix.mock.calls[0][0]).toEqual([pairA]);
  });

  it('fixes both selected pairs when both ids are supplied', async () => {
    mockDetectTransferPairs.mockResolvedValue([pairA, pairB]);

    const res = await POST(postReq({ eurTxnIds: [pairA.eurTxnId, pairB.eurTxnId] }));

    expect(res.status).toBe(200);
    expect(mockApplyTransferFix).toHaveBeenCalledTimes(1);
    expect(mockApplyTransferFix.mock.calls[0][0]).toEqual([pairA, pairB]);
  });

  it('returns 400 and does not fix anything when only unknown ids are supplied', async () => {
    mockDetectTransferPairs.mockResolvedValue([pairA, pairB]);

    const res = await POST(postReq({ eurTxnIds: ['not-a-real-id'] }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(mockApplyTransferFix).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('drops unknown ids and fixes only the known selected pair', async () => {
    mockDetectTransferPairs.mockResolvedValue([pairA, pairB]);

    const res = await POST(postReq({ eurTxnIds: [pairA.eurTxnId, 'not-a-real-id'] }));

    expect(res.status).toBe(200);
    expect(mockApplyTransferFix).toHaveBeenCalledTimes(1);
    expect(mockApplyTransferFix.mock.calls[0][0]).toEqual([pairA]);
  });

  it('returns an empty result set and does not fix anything when no pairs are detected', async () => {
    mockDetectTransferPairs.mockResolvedValue([]);

    const res = await POST(postReq({ eurTxnIds: [pairA.eurTxnId] }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ fixed: 0, pairs: [], results: [] });
    expect(mockApplyTransferFix).not.toHaveBeenCalled();
  });

  it('returns 401 and does not fix anything when the caller is not logged in', async () => {
    mockGetAdminSession.mockResolvedValue({ isLoggedIn: false });

    const res = await POST(postReq({ eurTxnIds: [pairA.eurTxnId] }));

    expect(res.status).toBe(401);
    expect(mockApplyTransferFix).not.toHaveBeenCalled();
  });

  it('never trusts client-supplied amounts — the server-detected pair objects are used', async () => {
    mockDetectTransferPairs.mockResolvedValue([pairA, pairB]);

    const res = await POST(
      postReq({
        eurTxnIds: [pairA.eurTxnId],
        eurAmountMilliunits: -999999,
        gbpAmountMilliunits: 888888,
        gbpTxnId: 'forged-gbp',
        date: '1999-01-01',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockApplyTransferFix.mock.calls[0][0]).toEqual([pairA]);
  });
});
