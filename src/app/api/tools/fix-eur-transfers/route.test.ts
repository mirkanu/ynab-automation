import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const {
  mockGetAdminSession,
  mockDetectTransferPairs,
  mockApplyTransferFix,
  mockSaveSettings,
} = vi.hoisted(() => ({
  mockGetAdminSession: vi.fn(),
  mockDetectTransferPairs: vi.fn(),
  mockApplyTransferFix: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

vi.mock('@/lib/admin-session', () => ({ getAdminSession: mockGetAdminSession }));

vi.mock('@/lib/ynab-transfers', () => ({
  detectTransferPairs: mockDetectTransferPairs,
  applyTransferFix: mockApplyTransferFix,
}));

vi.mock('@/lib/settings', () => ({ saveSettings: mockSaveSettings }));

import { POST } from './route';

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
  mockSaveSettings.mockResolvedValue(undefined);
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
