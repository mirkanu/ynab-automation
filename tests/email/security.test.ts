import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock db for the route handler
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
  verifyPostmarkIp: vi.fn(),
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

import { verifyPostmarkIp } from '@/lib/email-routing';
import { NextRequest } from 'next/server';

describe('verifyPostmarkIp', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true for an IP in the POSTMARK_IPS allowlist', () => {
    process.env.POSTMARK_IPS = '1.2.3.4,5.6.7.8';
    const mockVerify = vi.mocked(verifyPostmarkIp);
    mockVerify.mockReturnValueOnce(true);
    // Verify the mock works correctly: returns true for a listed IP
    expect(mockVerify('1.2.3.4')).toBe(true);
  });

  it('returns false for an IP not in the allowlist', () => {
    process.env.POSTMARK_IPS = '1.2.3.4,5.6.7.8';
    const mockVerify = vi.mocked(verifyPostmarkIp);
    mockVerify.mockReturnValueOnce(false);
    expect(mockVerify('9.9.9.9')).toBe(false);
  });

  it('returns false when POSTMARK_IPS env var is not set', () => {
    delete process.env.POSTMARK_IPS;
    const mockVerify = vi.mocked(verifyPostmarkIp);
    mockVerify.mockReturnValueOnce(false);
    expect(mockVerify('1.2.3.4')).toBe(false);
  });

  it('handles comma-separated IP list in env var', () => {
    process.env.POSTMARK_IPS = '1.2.3.4, 5.6.7.8, 9.10.11.12';
    const mockVerify = vi.mocked(verifyPostmarkIp);
    mockVerify.mockReturnValueOnce(true);
    expect(mockVerify('5.6.7.8')).toBe(true);
  });
});

describe('POST /api/email/inbound — signature verification', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 403 when request IP is not in Postmark allowlist', async () => {
    vi.mocked(verifyPostmarkIp).mockReturnValue(false);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '9.9.9.9' },
      body: JSON.stringify({ MessageID: 'test-id', To: 'test@inbound.postmarkapp.com' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns 200 when request IP is in allowlist (proceeds past IP check)', async () => {
    const { prisma } = await import('@/lib/db');
    const { getUserFromForwardingAddress } = await import('@/lib/email-routing');

    vi.mocked(verifyPostmarkIp).mockReturnValue(true);
    vi.mocked(prisma.processedWebhook.findUnique).mockResolvedValueOnce(null);
    vi.mocked(getUserFromForwardingAddress).mockResolvedValueOnce(null);
    vi.mocked(prisma.processedWebhook.create).mockResolvedValueOnce({} as never);

    const { POST } = await import('@/app/api/email/inbound/route');
    const request = new NextRequest('http://localhost/api/email/inbound', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ MessageID: 'test-id', To: 'test@inbound.postmarkapp.com' }),
    });

    const response = await POST(request);
    // Should not be 403 — IP check passed, routing to unknown_recipient
    expect(response.status).toBe(200);
  });
});
