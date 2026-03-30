import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module under test
vi.mock('@/lib/db', () => ({
  prisma: {
    emailForwardingAddress: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { generateMailboxHash, assignForwardingAddress } from '@/lib/email-forwarding';
import { prisma } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as unknown as {
  emailForwardingAddress: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('generateMailboxHash', () => {
  it('returns a string with user_ prefix', () => {
    const hash = generateMailboxHash('test-user-id-12345');
    expect(hash).toMatch(/^user_/);
  });

  it('returns different hashes for different userIds', () => {
    const hash1 = generateMailboxHash('user-id-aaaa');
    const hash2 = generateMailboxHash('user-id-bbbb');
    expect(hash1).not.toBe(hash2);
  });

  it('same userId always produces same hash (deterministic)', () => {
    const userId = 'some-user-id-xyz';
    const hash1 = generateMailboxHash(userId);
    const hash2 = generateMailboxHash(userId);
    expect(hash1).toBe(hash2);
  });

  it('hash does not contain plaintext userId', () => {
    const userId = 'plaintext-user-id-should-not-appear';
    const hash = generateMailboxHash(userId);
    // The full userId should not be present in the hash
    expect(hash).not.toContain(userId);
  });
});

describe('assignForwardingAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates and stores forwardingEmail on User row', async () => {
    mockPrisma.emailForwardingAddress.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const userId = 'test-user-001';
    const result = await assignForwardingAddress(userId);

    expect(result).toMatch(/^user_/);
    expect(result).toContain('@');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Verify user.update was called within the transaction args
    const transactionArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArgs).toHaveLength(2);
  });

  it('creates EmailForwardingAddress record with matching mailboxHash', async () => {
    mockPrisma.emailForwardingAddress.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const userId = 'test-user-002';
    const mailboxHash = generateMailboxHash(userId);
    await assignForwardingAddress(userId);

    // The create call args should have the matching mailboxHash
    const transactionArgs = mockPrisma.$transaction.mock.calls[0][0];
    // transactionArgs is an array of prisma calls — we verify by checking $transaction was called
    // with items that represent create and update operations (2 items)
    expect(transactionArgs).toHaveLength(2);
    // Verify emailForwardingAddress.create was set up with correct data
    expect(mockPrisma.emailForwardingAddress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        mailboxHash,
      }),
    });
  });

  it('idempotent: calling twice for same user does not create duplicate', async () => {
    const userId = 'test-user-003';
    const existingEmail = `user_test-use_abcdef0123456789@inbound.postmarkapp.com`;

    // First call: no existing record
    mockPrisma.emailForwardingAddress.findFirst.mockResolvedValueOnce(null);
    mockPrisma.$transaction.mockResolvedValueOnce([{}, {}]);

    await assignForwardingAddress(userId);

    // Second call: record already exists
    mockPrisma.emailForwardingAddress.findFirst.mockResolvedValueOnce({ email: existingEmail });

    const result = await assignForwardingAddress(userId);

    // On the second call, $transaction should NOT be called again
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // Result should be the existing email
    expect(result).toBe(existingEmail);
  });
});
