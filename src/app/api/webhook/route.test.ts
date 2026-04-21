import { describe, it, expect, vi, beforeEach } from 'vitest';
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
const mockExtractCategoryHint = vi.fn().mockReturnValue(null);
vi.mock('@/lib/email', () => ({
  extractMessageId: mockExtractMessageId,
  extractOriginalSender: mockExtractOriginalSender,
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
vi.mock('@/lib/settings', () => ({
  getSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/config', () => ({
  loadConfig: vi.fn().mockReturnValue({ senders: [mockSenderInfo], adminEmail: 'admin@test.com', currencyAccounts: {} }),
  getSenderByEmail: mockGetSenderByEmail,
  getAccountForCurrency: vi.fn().mockReturnValue('acct-789'),
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
