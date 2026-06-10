import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockWriteActivityLog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/activity-log', () => ({
  writeActivityLog: mockWriteActivityLog,
}));

const mockFindUnique = vi.fn().mockResolvedValue(null);
const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
vi.mock('@/lib/db', () => ({
  prisma: {
    processedEmail: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

const mockExtractMessageId = vi.fn().mockReturnValue('msg-123');
const mockExtractOriginalSender = vi.fn().mockReturnValue('alice@example.com');
const mockExtractOriginalRecipient = vi.fn().mockReturnValue(null);
const mockExtractCategoryHint = vi.fn().mockReturnValue(null);
vi.mock('@/lib/email', () => ({
  extractMessageId: mockExtractMessageId,
  extractOriginalSender: mockExtractOriginalSender,
  extractOriginalRecipient: mockExtractOriginalRecipient,
  extractCategoryHint: mockExtractCategoryHint,
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

describe('POST /api/webhook - activity logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mockExtractMessageId.mockReturnValue('msg-123');
    mockExtractOriginalSender.mockReturnValue('alice@example.com');
    mockFindUnique.mockResolvedValue(null);
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
