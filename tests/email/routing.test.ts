import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    emailForwardingAddress: {
      findUnique: vi.fn(),
    },
  },
  getPrismaForUser: vi.fn(),
}));

import { prisma } from '@/lib/db';

describe('getUserFromForwardingAddress', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns userId when mailboxHash matches a known forwarding address', async () => {
    const mockFindUnique = vi.mocked(prisma.emailForwardingAddress.findUnique);
    mockFindUnique.mockResolvedValueOnce({ userId: 'user-123' } as never);

    const { getUserFromForwardingAddress } = await import('@/lib/email-routing');
    const result = await getUserFromForwardingAddress('user_abc123@inbound.postmarkapp.com');

    expect(result).toBe('user-123');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { mailboxHash: 'user_abc123' },
      select: { userId: true },
    });
  });

  it('returns null for unknown mailboxHash', async () => {
    const mockFindUnique = vi.mocked(prisma.emailForwardingAddress.findUnique);
    mockFindUnique.mockResolvedValueOnce(null);

    const { getUserFromForwardingAddress } = await import('@/lib/email-routing');
    const result = await getUserFromForwardingAddress('unknown_hash@inbound.postmarkapp.com');

    expect(result).toBeNull();
  });

  it('returns null for empty To address', async () => {
    const { getUserFromForwardingAddress } = await import('@/lib/email-routing');
    const result = await getUserFromForwardingAddress('');
    expect(result).toBeNull();
  });

  it('returns null for malformed To address (no @ sign)', async () => {
    const { getUserFromForwardingAddress } = await import('@/lib/email-routing');
    const result = await getUserFromForwardingAddress('noemail');
    expect(result).toBeNull();
  });

  it('extracts mailboxHash from full email address (local part before @)', async () => {
    const mockFindUnique = vi.mocked(prisma.emailForwardingAddress.findUnique);
    mockFindUnique.mockResolvedValueOnce({ userId: 'user-456' } as never);

    const { getUserFromForwardingAddress } = await import('@/lib/email-routing');
    await getUserFromForwardingAddress('user_xyz789@inbound.postmarkapp.com');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { mailboxHash: 'user_xyz789' },
      select: { userId: true },
    });
  });
});
