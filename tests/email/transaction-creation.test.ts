import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    processedWebhook: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    emailForwardingAddress: {
      findUnique: vi.fn(),
    },
  },
  getPrismaForUser: vi.fn(),
}));

vi.mock('@/lib/email-routing', () => ({
  verifyPostmarkIp: vi.fn(() => true),
  getUserFromForwardingAddress: vi.fn(),
}));

vi.mock('@/lib/ynab', () => ({
  createYnabTransaction: vi.fn(),
  getCategories: vi.fn(),
  findCategory: vi.fn(),
  getAccountName: vi.fn(() => Promise.resolve('Checking')),
}));

vi.mock('@/lib/claude', () => ({
  parseOrderEmail: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  extractOriginalSender: vi.fn(),
  extractCategoryHint: vi.fn(() => null),
  extractMessageId: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
  loadDbSettings: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  loadConfig: vi.fn(() => ({
    senders: [
      { email: 'orders@amazon.co.uk', name: 'Amazon', accountId: 'acct-1', notificationLabel: 'Amazon' },
    ],
    adminEmail: 'admin@example.com',
    currencyAccounts: {},
  })),
  getSenderByEmail: vi.fn(),
  getAccountForCurrency: vi.fn(() => 'acct-1'),
}));

vi.mock('@/lib/activity-log', () => ({
  writeActivityLog: vi.fn(),
}));

import { prisma, getPrismaForUser } from '@/lib/db';
import { getUserFromForwardingAddress, verifyPostmarkIp } from '@/lib/email-routing';
import { createYnabTransaction } from '@/lib/ynab';
import { parseOrderEmail } from '@/lib/claude';
import { getSenderByEmail } from '@/lib/config';
import { NextRequest } from 'next/server';

const VALID_PAYLOAD = {
  MessageID: 'msg-success-123',
  To: 'user_abc@inbound.postmarkapp.com',
  From: 'orders@amazon.co.uk',
  Subject: 'Your Amazon order',
  HtmlBody: '<html>Order confirmed</html>',
  TextBody: 'Order confirmed',
};

const PARSED_ORDER = {
  retailer: 'Amazon',
  amount: 29.99,
  date: '2026-03-30',
  currency: 'GBP',
  description: 'Book: TypeScript in Depth',
};

describe('POST /api/email/inbound — YNAB transaction creation', () => {
  let userPrismaCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Re-apply IP allowlist mock (reset cleared it)
    vi.mocked(verifyPostmarkIp).mockReturnValue(true);

    // Setup user-scoped prisma mock
    userPrismaCreate = vi.fn().mockResolvedValue({});
    vi.mocked(getPrismaForUser).mockReturnValue({
      processedWebhook: { create: userPrismaCreate },
    } as never);
  });

  it('creates YNAB transaction with correct userId when email forwarded to known address', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce('user-real-1');
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      oauthToken: 'enc:token',
      selectedBudgetId: 'budget-1',
      selectedAccountId: 'acct-1',
    } as never);
    vi.mocked(getSenderByEmail).mockReturnValueOnce({
      email: 'orders@amazon.co.uk',
      name: 'Amazon',
      accountId: 'acct-1',
    });
    vi.mocked(parseOrderEmail).mockResolvedValueOnce(PARSED_ORDER);
    vi.mocked(createYnabTransaction).mockResolvedValueOnce('ynab-txn-id-123');

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify(VALID_PAYLOAD),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.transactionId).toBe('ynab-txn-id-123');
    expect(createYnabTransaction).toHaveBeenCalledWith('user-real-1', expect.objectContaining({
      budgetId: 'budget-1',
      accountId: 'acct-1',
      amount: 29.99,
    }));
  });

  it('returns unknown_recipient when mailboxHash not found', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce(null);
    vi.mocked(prisma.processedWebhook.create).mockResolvedValueOnce({} as never);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ ...VALID_PAYLOAD, MessageID: 'unknown-recipient-test' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('unknown_recipient');
    expect(createYnabTransaction).not.toHaveBeenCalled();
  });

  it('returns no_ynab_account when user has no connected YNAB account', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce('user-no-ynab');
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      oauthToken: null,
      selectedBudgetId: null,
      selectedAccountId: null,
    } as never);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ ...VALID_PAYLOAD, MessageID: 'no-ynab-test' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('no_ynab_account');
    expect(createYnabTransaction).not.toHaveBeenCalled();
    // ProcessedWebhook should still be recorded (before returning)
    expect(userPrismaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: 'postmark',
        userId: 'user-no-ynab',
        status: 'skipped',
      }),
    }));
  });

  it('records ProcessedWebhook with status=success after YNAB transaction created', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce('user-real-2');
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      oauthToken: 'enc:token',
      selectedBudgetId: 'budget-1',
      selectedAccountId: 'acct-1',
    } as never);
    vi.mocked(getSenderByEmail).mockReturnValueOnce({
      email: 'orders@amazon.co.uk',
      name: 'Amazon',
      accountId: 'acct-1',
    });
    vi.mocked(parseOrderEmail).mockResolvedValueOnce(PARSED_ORDER);
    vi.mocked(createYnabTransaction).mockResolvedValueOnce('ynab-txn-id-456');

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ ...VALID_PAYLOAD, MessageID: 'success-record-test' }),
    });

    await POST(request);

    // ProcessedWebhook should be created with status=success AFTER YNAB call
    expect(userPrismaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: 'postmark',
        userId: 'user-real-2',
        status: 'success',
      }),
    }));

    // YNAB must have been called before the processedWebhook create
    const ynabCallOrder = vi.mocked(createYnabTransaction).mock.invocationCallOrder[0];
    const webhookCreateOrder = userPrismaCreate.mock.invocationCallOrder[0];
    expect(ynabCallOrder).toBeLessThan(webhookCreateOrder);
  });

  it('records ProcessedWebhook with status=skipped when user has no YNAB token', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce('user-no-token');
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      oauthToken: null,
      selectedBudgetId: null,
      selectedAccountId: null,
    } as never);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ ...VALID_PAYLOAD, MessageID: 'no-token-test' }),
    });

    await POST(request);

    expect(userPrismaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'skipped',
        userId: 'user-no-token',
      }),
    }));
  });
});
