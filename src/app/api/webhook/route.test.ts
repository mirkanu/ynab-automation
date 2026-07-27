import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockWriteActivityLog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/activity-log', () => ({
  writeActivityLog: mockWriteActivityLog,
}));

const mockFindUnique = vi.fn().mockResolvedValue(null);
const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
const mockActivityLogFindFirst = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/db', () => ({
  prisma: {
    processedEmail: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
    activityLog: {
      findFirst: mockActivityLogFindFirst,
    },
  },
}));

const mockExtractMessageId = vi.fn().mockReturnValue('msg-123');
const mockExtractOriginalSender = vi.fn().mockReturnValue('alice@example.com');
const mockExtractOriginalRecipient = vi.fn().mockReturnValue(null);
const mockExtractCategoryHint = vi.fn().mockReturnValue(null);
const mockExtractOrderNumber = vi.fn().mockReturnValue(null);
const mockIsNonPricedTrackingSubject = vi.fn().mockReturnValue(false);
const mockExtractHtmlFromRawMime = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/email', () => ({
  extractMessageId: mockExtractMessageId,
  extractOriginalSender: mockExtractOriginalSender,
  extractOriginalRecipient: mockExtractOriginalRecipient,
  extractCategoryHint: mockExtractCategoryHint,
  extractOrderNumber: mockExtractOrderNumber,
  isNonPricedTrackingSubject: mockIsNonPricedTrackingSubject,
  extractHtmlFromRawMime: mockExtractHtmlFromRawMime,
}));

const mockParseOrderEmail = vi.fn().mockResolvedValue({
  retailer: 'Amazon',
  amount: 12.99,
  date: '2024-03-15',
  currency: 'GBP',
  description: 'AirPods case',
});
vi.mock('@/lib/claude', () => ({
  parseOrderEmail: mockParseOrderEmail,
}));

const mockCreateYnabTransaction = vi.fn().mockResolvedValue('txn-456');
vi.mock('@/lib/ynab', () => ({
  createYnabTransaction: mockCreateYnabTransaction,
  getCategories: vi.fn().mockResolvedValue([]),
  findCategory: vi.fn().mockReturnValue(null),
  getAccountName: vi.fn().mockResolvedValue('UK Current'),
  formatMemo: (senderName: string, description: string, customNote?: string) =>
    `${senderName}: ${description} - ${customNote?.trim() || 'Automatically added from email'}`,
}));

vi.mock('@/lib/notify', () => ({
  sendErrorNotification: vi.fn().mockResolvedValue(undefined),
}));

const mockSenderInfo = { email: 'alice@example.com', name: 'Alice', accountId: 'acct-789' };
const mockGetSenderByEmail = vi.fn().mockReturnValue(mockSenderInfo);
const mockGetSetting = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/settings', () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
}));

vi.mock('@/lib/config', () => ({
  loadConfig: vi.fn().mockReturnValue({ senders: [mockSenderInfo], adminEmail: 'admin@test.com', currencyAccounts: {} }),
  getSenderByEmail: mockGetSenderByEmail,
  getAccountForCurrency: vi.fn().mockImplementation((_config: unknown, senderAccountId: string) => senderAccountId),
  notificationSuffix: vi.fn().mockReturnValue(''),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const webhookBody = {
  trigger: {
    event: {
      headers: { 'message-id': 'msg-123', subject: 'Your Amazon order', from: { text: 'alice@example.com' } },
      body: { html: '<html>order details</html>' },
    },
  },
};

const truncatedHtml = 'a'.repeat(100000);
const fullHtml = `<html>full order details...TOTAL £44.96...${'b'.repeat(100000)}</html>`;

const webhookBodyTruncated = {
  trigger: {
    event: {
      headers: { 'message-id': 'msg-123', subject: 'Your Amazon order', from: { text: 'alice@example.com' } },
      body: { html: truncatedHtml, htmlUrl: 'https://s3.example.com/full-email.html' },
    },
  },
};

describe('POST /api/webhook - activity logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mockExtractMessageId.mockReturnValue('msg-123');
    mockExtractOriginalSender.mockReturnValue('alice@example.com');
    mockFindUnique.mockResolvedValue(null);
    mockActivityLogFindFirst.mockResolvedValue(null);
    mockExtractOrderNumber.mockReturnValue(null);
    mockIsNonPricedTrackingSubject.mockReturnValue(false);
    mockParseOrderEmail.mockResolvedValue({
      retailer: 'Amazon', amount: 12.99, date: '2024-03-15', currency: 'GBP', description: 'AirPods case',
    });
    mockCreateYnabTransaction.mockResolvedValue('txn-456');
    mockGetSenderByEmail.mockReturnValue(mockSenderInfo);
  });

  it('logs success with parseResult and ynabResult', async () => {
    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('success');
    expect(entry.messageId).toBe('msg-123');
    expect(entry.parseResult).toEqual({
      retailer: 'Amazon', amount: 12.99, date: '2024-03-15', currency: 'GBP', description: 'AirPods case',
    });
    expect(entry.ynabResult).toMatchObject({
      transactionId: 'txn-456',
      accountId: 'acct-789',
    });
  });

  it('logs unknown_sender when sender not configured', async () => {
    mockGetSenderByEmail.mockReturnValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('unknown_sender');
    expect(entry.errorType).toBe('unknown_sender');
  });

  it('logs parse_error when Claude fails', async () => {
    mockParseOrderEmail.mockResolvedValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('parse_error');
    expect(entry.errorType).toBe('parse_failed');
  });

  it('logs ynab_error when YNAB API fails', async () => {
    mockCreateYnabTransaction.mockRejectedValue(new Error('YNAB 401'));

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('ynab_error');
    expect(entry.errorType).toBe('ynab_api_error');
    expect(entry.errorMessage).toBe('YNAB 401');
    expect(entry.parseResult).toBeDefined();
  });

  it('logs duplicate when email already processed', async () => {
    mockFindUnique.mockResolvedValue({ id: 1, messageId: 'msg-123' });

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('duplicate');
    expect(entry.messageId).toBe('msg-123');
  });

  it('logs no_message_id when message ID is missing', async () => {
    mockExtractMessageId.mockReturnValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('no_message_id');
  });

  it('logs duplicate_order and skips transaction creation when a prior success row shares the order number', async () => {
    mockExtractOrderNumber.mockReturnValue('204-6619432-1614766');
    mockActivityLogFindFirst.mockResolvedValue({ id: 152, orderNumber: '204-6619432-1614766', status: 'success' });

    const { POST } = await import('./route');
    const { sendErrorNotification } = await import('@/lib/notify');
    await POST(makeRequest(webhookBody));

    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();
    expect(sendErrorNotification).not.toHaveBeenCalled();
    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('duplicate_order');
    expect(entry.orderNumber).toBe('204-6619432-1614766');
  });

  it('proceeds to create the transaction normally when no order number is extracted', async () => {
    mockExtractOrderNumber.mockReturnValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockActivityLogFindFirst).not.toHaveBeenCalled();
    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('success');
    expect(entry.orderNumber).toBeUndefined();
  });

  it('proceeds to create the transaction when an order number is extracted but no prior success row matches', async () => {
    mockExtractOrderNumber.mockReturnValue('204-6619432-1614766');
    mockActivityLogFindFirst.mockResolvedValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockActivityLogFindFirst).toHaveBeenCalledOnce();
    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('success');
    expect(entry.orderNumber).toBe('204-6619432-1614766');
  });

  it('skips parsing and logs no_price_expected for a non-priced tracking subject', async () => {
    mockIsNonPricedTrackingSubject.mockReturnValue(true);
    mockExtractOrderNumber.mockReturnValue('204-6619432-1614766');
    const { sendErrorNotification } = await import('@/lib/notify');

    const { POST } = await import('./route');
    const res = await POST(makeRequest({
      trigger: {
        event: {
          headers: { 'message-id': 'msg-123', subject: 'Out for delivery: "Anker USB-C Cable"', from: { text: 'shipment-tracking@amazon.co.uk' } },
          body: { html: '<html>out for delivery details</html>' },
        },
      },
    }));

    expect(res.status).toBe(200);
    expect(mockParseOrderEmail).not.toHaveBeenCalled();
    expect(sendErrorNotification).not.toHaveBeenCalled();
    expect(mockWriteActivityLog).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('no_price_expected');
    expect(entry.messageId).toBe('msg-123');
    expect(entry.subject).toBe('Out for delivery: "Anker USB-C Cable"');
    expect(entry.orderNumber).toBe('204-6619432-1614766');
  });

  it('proceeds through Claude parsing unaffected for a Dispatched: subject (isNonPricedTrackingSubject false)', async () => {
    mockIsNonPricedTrackingSubject.mockReturnValue(false);
    mockExtractOrderNumber.mockReturnValue('204-6619432-1614766');
    mockActivityLogFindFirst.mockResolvedValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest({
      trigger: {
        event: {
          headers: { 'message-id': 'msg-123', subject: 'Dispatched: "Anker USB-C Cable"', from: { text: 'shipment-tracking@amazon.co.uk' } },
          body: { html: '<html>dispatched details</html>' },
        },
      },
    }));

    expect(mockParseOrderEmail).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('success');
  });

  it('proceeds through Claude parsing unaffected for a normal order confirmation subject', async () => {
    mockIsNonPricedTrackingSubject.mockReturnValue(false);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockParseOrderEmail).toHaveBeenCalledOnce();
    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('success');
  });
});

describe('POST /api/webhook - DB rules override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractMessageId.mockReturnValue('msg-db-rules');
    mockExtractOriginalSender.mockReturnValue('emily@example.com');
    mockFindUnique.mockResolvedValue(null);
    mockParseOrderEmail.mockResolvedValue({
      retailer: 'ASOS', amount: 25.00, date: '2024-04-01', currency: 'GBP', description: 'Dress',
    });
    mockCreateYnabTransaction.mockResolvedValue('txn-emily');
    // Env-var config has Emily with wrong name and wrong account
    mockGetSenderByEmail.mockReturnValue({ email: 'emily@example.com', name: 'Manuel', accountId: 'acct-manuel' });
    // Default: no DB rules
    mockGetSetting.mockResolvedValue(undefined);
  });

  it('uses DB sender rule name and accountId over env-var when rule matches', async () => {
    const dbSenderRules = JSON.stringify([
      { email: 'emily@example.com', name: 'Emily-Kate', accountId: 'acct-emily' },
    ]);
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === 'SENDER_RULES') return dbSenderRules;
      return undefined;
    });

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const call = mockCreateYnabTransaction.mock.calls[0][0];
    expect(call.accountId).toBe('acct-emily');
    expect(call.senderName).toBe('Emily-Kate');
  });

  it('falls back to env-var name when DB sender rule name is empty', async () => {
    // DB rule has correct accountId but blank name
    const dbSenderRules = JSON.stringify([
      { email: 'emily@example.com', name: '', accountId: 'acct-emily' },
    ]);
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === 'SENDER_RULES') return dbSenderRules;
      return undefined;
    });
    // Env-var has the correct name
    mockGetSenderByEmail.mockReturnValue({ email: 'emily@example.com', name: 'Emily-Kate', accountId: 'acct-manuel' });

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const call = mockCreateYnabTransaction.mock.calls[0][0];
    expect(call.accountId).toBe('acct-emily');   // DB account wins
    expect(call.senderName).toBe('Emily-Kate');   // env-var name fills in
  });

  it('uses DB currency rule accountId when currency matches', async () => {
    mockGetSenderByEmail.mockReturnValue({ email: 'emily@example.com', name: 'Emily-Kate', accountId: 'acct-gbp' });
    mockParseOrderEmail.mockResolvedValue({
      retailer: 'Zalando', amount: 30.00, date: '2024-04-01', currency: 'EUR', description: 'Jacket',
    });
    const dbCurrencyRules = JSON.stringify([
      { currency: 'EUR', accountId: 'acct-eur' },
    ]);
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === 'CURRENCY_RULES') return dbCurrencyRules;
      return undefined;
    });

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockCreateYnabTransaction).toHaveBeenCalledOnce();
    const call = mockCreateYnabTransaction.mock.calls[0][0];
    expect(call.accountId).toBe('acct-eur');
  });

  it('treats as unknown_sender when no DB rule and env-var returns null', async () => {
    mockGetSenderByEmail.mockReturnValue(null);

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(mockCreateYnabTransaction).not.toHaveBeenCalled();
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.status).toBe('unknown_sender');
  });
});

describe('POST /api/webhook - htmlUrl truncation fallback', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mockExtractMessageId.mockReturnValue('msg-123');
    mockExtractOriginalSender.mockReturnValue('alice@example.com');
    mockFindUnique.mockResolvedValue(null);
    mockActivityLogFindFirst.mockResolvedValue(null);
    mockExtractOrderNumber.mockReturnValue(null);
    mockParseOrderEmail.mockResolvedValue({
      retailer: 'Amazon', amount: 12.99, date: '2024-03-15', currency: 'GBP', description: 'AirPods case',
    });
    mockCreateYnabTransaction.mockResolvedValue('txn-456');
    mockGetSenderByEmail.mockReturnValue(mockSenderInfo);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not fetch htmlUrl and uses the original inline html when under the truncation threshold', async () => {
    const { POST } = await import('./route');
    await POST(makeRequest(webhookBody));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockParseOrderEmail).toHaveBeenCalledWith('<html>order details</html>', 'Alice');
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.rawBody).toBe('<html>order details</html>');
  });

  it('fetches the full html from htmlUrl when the inline html is truncated and uses it for parsing and rawBody', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => fullHtml });

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBodyTruncated));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://s3.example.com/full-email.html');
    expect(mockParseOrderEmail).toHaveBeenCalledWith(fullHtml, 'Alice');
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.rawBody).toBe(fullHtml);
  });

  it('falls back to the truncated inline html and logs a warning when the htmlUrl fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { POST } = await import('./route');
    const res = await POST(makeRequest(webhookBodyTruncated));

    expect(res.status).toBe(200);
    expect(mockParseOrderEmail).toHaveBeenCalledWith(truncatedHtml, 'Alice');
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.rawBody).toBe(truncatedHtml);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('falls back to the truncated inline html and logs a warning when the htmlUrl fetch returns non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { POST } = await import('./route');
    const res = await POST(makeRequest(webhookBodyTruncated));

    expect(res.status).toBe(200);
    expect(mockParseOrderEmail).toHaveBeenCalledWith(truncatedHtml, 'Alice');
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.rawBody).toBe(truncatedHtml);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

const webhookBodyTruncatedNoHtmlUrl = {
  trigger: {
    event: {
      headers: { 'message-id': 'msg-123', subject: 'Your Amazon order', from: { text: 'alice@example.com' } },
      body: { html: truncatedHtml },
      rawUrl: 'https://s3.example.com/raw-email.eml',
    },
  },
};

describe('POST /api/webhook - rawUrl MIME fallback', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mockExtractMessageId.mockReturnValue('msg-123');
    mockExtractOriginalSender.mockReturnValue('alice@example.com');
    mockFindUnique.mockResolvedValue(null);
    mockActivityLogFindFirst.mockResolvedValue(null);
    mockExtractOrderNumber.mockReturnValue(null);
    mockExtractHtmlFromRawMime.mockResolvedValue(null);
    mockParseOrderEmail.mockResolvedValue({
      retailer: 'Amazon', amount: 12.99, date: '2024-03-15', currency: 'GBP', description: 'AirPods case',
    });
    mockCreateYnabTransaction.mockResolvedValue('txn-456');
    mockGetSenderByEmail.mockReturnValue(mockSenderInfo);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not attempt the rawUrl fallback when htmlUrl succeeds', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => fullHtml });

    const { POST } = await import('./route');
    await POST(makeRequest(webhookBodyTruncated));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mockExtractHtmlFromRawMime).not.toHaveBeenCalled();
    expect(mockParseOrderEmail).toHaveBeenCalledWith(fullHtml, 'Alice');
  });

  it('uses the rawUrl-parsed html when htmlUrl is missing and rawUrl fetch + parse succeeds', async () => {
    const rawMime = 'raw mime email text';
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => rawMime });
    mockExtractHtmlFromRawMime.mockResolvedValue(fullHtml);

    const { POST } = await import('./route');
    const res = await POST(makeRequest(webhookBodyTruncatedNoHtmlUrl));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://s3.example.com/raw-email.eml');
    expect(mockExtractHtmlFromRawMime).toHaveBeenCalledWith(rawMime);
    expect(mockParseOrderEmail).toHaveBeenCalledWith(fullHtml, 'Alice');
    const entry = mockWriteActivityLog.mock.calls[0][0];
    expect(entry.rawBody).toBe(fullHtml);
  });

  it('falls back to the truncated inline html when htmlUrl and rawUrl are both missing/absent', async () => {
    const webhookBodyTruncatedNoUrls = {
      trigger: {
        event: {
          headers: { 'message-id': 'msg-123', subject: 'Your Amazon order', from: { text: 'alice@example.com' } },
          body: { html: truncatedHtml },
        },
      },
    };

    const { POST } = await import('./route');
    const res = await POST(makeRequest(webhookBodyTruncatedNoUrls));

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockExtractHtmlFromRawMime).not.toHaveBeenCalled();
    expect(mockParseOrderEmail).toHaveBeenCalledWith(truncatedHtml, 'Alice');
  });

  it('uses the rawUrl-parsed html when the htmlUrl fetch fails and rawUrl fetch + parse succeeds', async () => {
    const rawMime = 'raw mime email text';
    fetchMock.mockRejectedValueOnce(new Error('htmlUrl network error'));
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => rawMime });
    mockExtractHtmlFromRawMime.mockResolvedValue(fullHtml);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const webhookBodyBothUrls = {
      trigger: {
        event: {
          headers: { 'message-id': 'msg-123', subject: 'Your Amazon order', from: { text: 'alice@example.com' } },
          body: { html: truncatedHtml, htmlUrl: 'https://s3.example.com/full-email.html' },
          rawUrl: 'https://s3.example.com/raw-email.eml',
        },
      },
    };

    const { POST } = await import('./route');
    const res = await POST(makeRequest(webhookBodyBothUrls));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://s3.example.com/raw-email.eml');
    expect(mockParseOrderEmail).toHaveBeenCalledWith(fullHtml, 'Alice');

    warnSpy.mockRestore();
  });

  it('falls back to the truncated inline html when both htmlUrl and rawUrl fail', async () => {
    fetchMock.mockRejectedValueOnce(new Error('htmlUrl network error'));
    fetchMock.mockRejectedValueOnce(new Error('rawUrl network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const webhookBodyBothUrls = {
      trigger: {
        event: {
          headers: { 'message-id': 'msg-123', subject: 'Your Amazon order', from: { text: 'alice@example.com' } },
          body: { html: truncatedHtml, htmlUrl: 'https://s3.example.com/full-email.html' },
          rawUrl: 'https://s3.example.com/raw-email.eml',
        },
      },
    };

    const { POST } = await import('./route');
    const res = await POST(makeRequest(webhookBodyBothUrls));

    expect(res.status).toBe(200);
    expect(mockParseOrderEmail).toHaveBeenCalledWith(truncatedHtml, 'Alice');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
