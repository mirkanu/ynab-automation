import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockFindFirst = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  },
}));

const mockParseOrderEmail = vi.fn();
vi.mock('@/lib/claude', () => ({
  parseOrderEmail: mockParseOrderEmail,
}));

const mockExtractCategoryHint = vi.fn().mockReturnValue(null);
const mockExtractOrderNumber = vi.fn().mockReturnValue(null);
vi.mock('@/lib/email', () => ({
  extractCategoryHint: mockExtractCategoryHint,
  extractOrderNumber: mockExtractOrderNumber,
}));

const mockCreateYnabTransaction = vi.fn().mockResolvedValue('txn-retry');
vi.mock('@/lib/ynab', () => ({
  createYnabTransaction: mockCreateYnabTransaction,
  getAccountName: vi.fn().mockResolvedValue('Wise (GBP)'),
  formatMemo: (senderName: string, description: string, customNote?: string) =>
    `${senderName}: ${description} - ${customNote?.trim() || 'Automatically added from email'}`,
}));

vi.mock('@/lib/config', () => ({
  loadConfig: vi.fn().mockReturnValue({
    senders: [{ email: 'emily@example.com', name: 'Emily-Kate', accountId: 'acct-owner' }],
    adminEmail: 'admin@test.com',
    currencyAccounts: {},
  }),
}));

const mockGetSetting = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/settings', () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
}));

const mockSendErrorNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notify', () => ({
  sendErrorNotification: mockSendErrorNotification,
}));

const mockUpdateActivityLog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/activity-log', () => ({
  updateActivityLog: mockUpdateActivityLog,
}));

// The shared helpers are mocked so the test controls account/category
// resolution deterministically.
vi.mock('@/lib/order-processing', () => ({
  SUBSEQUENT_RETRY_DELAY_MS: 24 * 60 * 60 * 1000,
  loadCurrencyRules: vi.fn().mockResolvedValue([]),
  resolveAccountId: vi.fn((_config: unknown, _rules: unknown, ownerAccountId: string) => ownerAccountId),
  resolveCategory: vi.fn().mockResolvedValue({}),
}));

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/parse-retries', {
    method: 'POST',
    headers,
  });
}

const dueRow = {
  id: 339,
  messageId: 'msg-339',
  subject: "Ordered: 'Southern Comfort Original'",
  rawBody: '<html>order body</html>',
  orderNumber: '202-9090378-7968332',
  ownerName: 'Emily-Kate',
  ownerAccountId: 'acct-owner',
  retryCount: 0,
  retryAt: new Date(Date.now() - 1000),
};

const parsedOrder = {
  retailer: 'Amazon',
  amount: 16.5,
  date: '2026-11-10',
  currency: 'GBP',
  description: 'Southern Comfort Original',
};

describe('POST /api/cron/parse-retries - auth gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    mockFindMany.mockResolvedValue([]);
  });

  it('returns 401 when the x-cron-secret header is missing', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 when the x-cron-secret header is wrong', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'nope' }));

    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is not set in the environment', async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('never echoes the secret or email content in the 401 body', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'wrong-secret' }));
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain('test-secret');
    expect(body).not.toContain('wrong-secret');
    expect(body).not.toContain('order body');
  });
});

describe('POST /api/cron/parse-retries - processing due rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    mockFindMany.mockResolvedValue([dueRow]);
    mockFindFirst.mockResolvedValue(null);
    mockExtractOrderNumber.mockReturnValue(null);
    mockExtractCategoryHint.mockReturnValue(null);
    mockGetSetting.mockResolvedValue(undefined);
    mockCreateYnabTransaction.mockResolvedValue('txn-retry');
    mockParseOrderEmail.mockResolvedValue({ ok: true, order: parsedOrder });
  });

  it('only picks up rows that are retry_pending and due', async () => {
    const { POST } = await import('./route');

    await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    expect(mockFindMany).toHaveBeenCalledOnce();
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('retry_pending');
    expect(where.retryAt.lte).toBeInstanceOf(Date);
    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
  });

  it('creates exactly one YNAB transaction and marks the row successful', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary.ok).toBe(true);
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);

    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const call = mockCreateYnabTransaction.mock.calls[0][0];
    expect(call.accountId).toBe('acct-owner');
    expect(call.amount).toBe(16.5);
    expect(call.payeeName).toBe('Amazon');
    expect(call.senderName).toBe('Emily-Kate');

    expect(mockUpdateActivityLog).toHaveBeenCalledOnce();
    const [messageId, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(messageId).toBe('msg-339');
    expect(patch.status).toBe('success');
    expect(patch.ynabResult.transactionId).toBe('txn-retry');
    expect(patch.ynabResult.amount).toBe(-16500);
    expect(patch.retryAt).toBeNull();
  });

  it('does not create a transaction when the order number already has a success row', async () => {
    mockExtractOrderNumber.mockReturnValue('202-9090378-7968332');
    mockFindFirst.mockResolvedValue({ id: 339, orderNumber: '202-9090378-7968332', status: 'success' });

    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    const summary = await res.json();
    expect(summary.duplicates).toBe(1);
    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();
    expect(mockUpdateActivityLog).toHaveBeenCalledOnce();
    const [, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(patch.status).toBe('duplicate_order');
    expect(patch.orderNumber).toBe('202-9090378-7968332');
  });

  it('keeps the row queued and emails the admin when the quota is still exhausted', async () => {
    mockParseOrderEmail.mockResolvedValue({ ok: false, reason: 'quota_exceeded', detail: 'Token Plan usage limit reached' });

    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    const summary = await res.json();
    expect(summary.adminEmailsSent).toBe(1);
    expect(summary.succeeded).toBe(0);

    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();

    expect(mockUpdateActivityLog).toHaveBeenCalledOnce();
    const [, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(patch.status).toBe('retry_pending');
    expect(patch.retryCount).toBe(1);
    expect(patch.errorType).toBe('quota_exceeded');

    const hoursOut = (patch.retryAt.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursOut).toBeGreaterThan(23);
    expect(hoursOut).toBeLessThan(25);

    expect(mockSendErrorNotification).toHaveBeenCalledOnce();
    const email = mockSendErrorNotification.mock.calls[0][0];
    expect(email.subject).toContain('quota still exhausted');
    expect(email.body).toContain('STILL QUEUED');
    expect(email.body).toContain('Failed attempts so far: 1');
  });

  it('falls back to parse_error plus an admin email on a non-quota failure', async () => {
    mockParseOrderEmail.mockResolvedValue({ ok: false, reason: 'api_error', detail: 'HTTP 500: boom' });

    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    const summary = await res.json();
    expect(summary.failed).toBe(1);
    expect(mockSendErrorNotification).toHaveBeenCalledOnce();
    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();

    const [, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(patch.status).toBe('parse_error');
    expect(patch.errorType).toBe('api_error');
    expect(patch.retryAt).toBeNull();
  });

  it('rejects an unusable amount without creating a transaction', async () => {
    mockParseOrderEmail.mockResolvedValue({ ok: true, order: { ...parsedOrder, amount: 0 } });

    const { POST } = await import('./route');

    const res = await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    const summary = await res.json();
    expect(summary.failed).toBe(1);
    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();
    expect(mockSendErrorNotification).toHaveBeenCalledOnce();

    const [, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(patch.status).toBe('invalid_amount');
    expect(patch.retryAt).toBeNull();
  });

  it('marks the row as a parse error when no owner account was recorded', async () => {
    mockFindMany.mockResolvedValue([{ ...dueRow, ownerAccountId: null }]);

    const { POST } = await import('./route');

    await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    expect(mockParseOrderEmail).not.toHaveBeenCalled();
    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();
    const [, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(patch.status).toBe('parse_error');
    expect(patch.errorType).toBe('missing_owner_account');
    expect(mockSendErrorNotification).toHaveBeenCalledOnce();
  });

  it('honours TEST_MODE and creates no transaction', async () => {
    mockGetSetting.mockImplementation(async (key: string) => (key === 'TEST_MODE' ? 'true' : undefined));

    const { POST } = await import('./route');

    await POST(makeRequest({ 'x-cron-secret': 'test-secret' }));

    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();
    const [, patch] = mockUpdateActivityLog.mock.calls[0];
    expect(patch.status).toBe('test');
    expect(patch.ynabResult.transactionId).toBe('(test — not created)');
  });
});
