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
  getPrismaForUser: vi.fn(() => ({
    processedWebhook: {
      create: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/email-routing', () => ({
  verifyPostmarkIp: vi.fn(() => true),
  getUserFromForwardingAddress: vi.fn(),
}));

vi.mock('@/lib/ynab', () => ({
  createYnabTransaction: vi.fn(),
  getCategories: vi.fn(),
  findCategory: vi.fn(),
  getAccountName: vi.fn(),
}));

vi.mock('@/lib/claude', () => ({
  parseOrderEmail: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  extractOriginalSender: vi.fn(),
  extractCategoryHint: vi.fn(),
  extractMessageId: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
  loadDbSettings: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  loadConfig: vi.fn(() => ({
    senders: [],
    adminEmail: 'admin@example.com',
    currencyAccounts: {},
  })),
  getSenderByEmail: vi.fn(),
  getAccountForCurrency: vi.fn(),
}));

vi.mock('@/lib/activity-log', () => ({
  writeActivityLog: vi.fn(),
}));

import { prisma } from '@/lib/db';
import { getUserFromForwardingAddress, verifyPostmarkIp } from '@/lib/email-routing';
import { createYnabTransaction } from '@/lib/ynab';
import { NextRequest } from 'next/server';

describe('ProcessedWebhook deduplication', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(verifyPostmarkIp).mockReturnValue(true);
  });

  it('returns skipped status when MessageID already in ProcessedWebhook table', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce({
      id: 1,
      provider: 'postmark',
      providerId: 'dup-message-id',
      userId: 'user-1',
      status: 'success',
      createdAt: new Date(),
    });

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({
        MessageID: 'dup-message-id',
        To: 'user_abc@inbound.postmarkapp.com',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('skipped');
    expect(body.reason).toBe('already_processed');
  });

  it('processes and records webhook when MessageID is new', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce(null);
    vi.mocked(prisma.processedWebhook.create).mockResolvedValueOnce({} as never);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({
        MessageID: 'new-message-id',
        To: 'unknown_hash@inbound.postmarkapp.com',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // No duplicate — proceeds to routing (unknown_recipient in this case)
    expect(body.status).not.toBe('skipped');
  });

  it('second call with same MessageID does not call YNAB API', async () => {
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce({
      id: 2,
      provider: 'postmark',
      providerId: 'already-done',
      userId: 'user-1',
      status: 'success',
      createdAt: new Date(),
    });

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({
        MessageID: 'already-done',
        To: 'user_abc@inbound.postmarkapp.com',
      }),
    });

    await POST(request);

    // YNAB should not have been called
    expect(createYnabTransaction).not.toHaveBeenCalled();
  });

  it('concurrent duplicate webhooks (race condition) — P2002 returns 200 gracefully', async () => {
    // Simulate race condition: findUnique returns null (not yet processed)
    // but create throws P2002 (concurrent insert)
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce(null);

    const p2002Error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    vi.mocked(prisma.processedWebhook.create).mockRejectedValueOnce(p2002Error);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({
        MessageID: 'race-condition-id',
        To: 'unknown@inbound.postmarkapp.com',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
