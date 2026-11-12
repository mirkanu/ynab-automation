import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityLogEntry } from './activity-log';

const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
const mockUpdate = vi.fn().mockResolvedValue({ id: 1 });

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

describe('writeActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a success entry with all fields', async () => {
    const { writeActivityLog } = await import('./activity-log');
    const entry: ActivityLogEntry = {
      messageId: 'msg-123',
      status: 'success',
      sender: 'alice@example.com',
      subject: 'Your Amazon order',
      rawBody: '<html>...</html>',
      parseResult: {
        retailer: 'Amazon',
        amount: 12.99,
        date: '2024-03-15',
        currency: 'GBP',
        description: 'AirPods case',
      },
      ynabResult: {
        transactionId: 'txn-456',
        amount: -12990,
        accountId: 'acct-789',
        payeeName: 'Amazon',
        date: '2024-03-15',
      },
    };

    await writeActivityLog(entry);

    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.messageId).toBe('msg-123');
    expect(data.status).toBe('success');
    expect(data.sender).toBe('alice@example.com');
    expect(data.subject).toBe('Your Amazon order');
    expect(data.rawBody).toBe('<html>...</html>');
    expect(data.parseResult).toEqual(entry.parseResult);
    expect(data.ynabResult).toEqual(entry.ynabResult);
  });

  it('writes an error entry with errorType and errorMessage', async () => {
    const { writeActivityLog } = await import('./activity-log');
    const entry: ActivityLogEntry = {
      messageId: 'msg-err',
      status: 'parse_error',
      sender: 'bob@example.com',
      errorType: 'parse_failed',
      errorMessage: 'Claude returned invalid JSON',
    };

    await writeActivityLog(entry);

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.status).toBe('parse_error');
    expect(data.errorType).toBe('parse_failed');
    expect(data.errorMessage).toBe('Claude returned invalid JSON');
    expect(data.parseResult).toBeUndefined();
    expect(data.ynabResult).toBeUndefined();
  });

  it('writes a duplicate_order entry with orderNumber passed through', async () => {
    const { writeActivityLog } = await import('./activity-log');
    const entry: ActivityLogEntry = {
      messageId: 'msg-dup-order',
      status: 'duplicate_order',
      sender: 'alice@example.com',
      orderNumber: '204-6619432-1614766',
    };

    await writeActivityLog(entry);

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.status).toBe('duplicate_order');
    expect(data.orderNumber).toBe('204-6619432-1614766');
  });

  it('does not throw on database errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB connection lost'));
    const { writeActivityLog } = await import('./activity-log');

    await expect(
      writeActivityLog({ messageId: 'msg-fail', status: 'success' }),
    ).resolves.not.toThrow();
  });

  it('passes the retry state and resolved owner through', async () => {
    const { writeActivityLog } = await import('./activity-log');
    const retryAt = new Date('2026-11-12T15:00:00.000Z');

    await writeActivityLog({
      messageId: 'msg-retry',
      status: 'retry_pending',
      sender: 'auto-confirm@amazon.co.uk',
      rawBody: '<html>...</html>',
      orderNumber: '202-9090378-7968332',
      retryAt,
      retryCount: 0,
      ownerName: 'Emily-Kate',
      ownerAccountId: 'acct-789',
      errorType: 'quota_exceeded',
      errorMessage: 'Token Plan usage limit reached',
    });

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.status).toBe('retry_pending');
    expect(data.retryAt).toEqual(retryAt);
    expect(data.retryCount).toBe(0);
    expect(data.ownerName).toBe('Emily-Kate');
    expect(data.ownerAccountId).toBe('acct-789');
    expect(data.errorType).toBe('quota_exceeded');
  });
});

describe('updateActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the row in place by messageId', async () => {
    const { updateActivityLog } = await import('./activity-log');
    const retryAt = new Date('2026-11-13T15:00:00.000Z');

    await updateActivityLog('msg-123', {
      status: 'retry_pending',
      retryCount: 1,
      retryAt,
      errorType: 'quota_exceeded',
      errorMessage: 'still exhausted',
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    const call = mockUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ messageId: 'msg-123' });
    expect(call.data.status).toBe('retry_pending');
    expect(call.data.retryCount).toBe(1);
    expect(call.data.retryAt).toEqual(retryAt);
    expect(call.data.errorType).toBe('quota_exceeded');
  });

  it('leaves untouched fields undefined so Prisma keeps their value', async () => {
    const { updateActivityLog } = await import('./activity-log');

    await updateActivityLog('msg-123', { status: 'success' });

    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.errorType).toBeUndefined();
    expect(data.parseResult).toBeUndefined();
    expect(data.ynabResult).toBeUndefined();
    expect(data.retryAt).toBeUndefined();
  });

  it('clears a stale errorType when passed an explicit null', async () => {
    const { updateActivityLog } = await import('./activity-log');

    await updateActivityLog('msg-123', { status: 'success', errorType: null, errorMessage: null });

    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.errorType).toBeNull();
    expect(data.errorMessage).toBeNull();
  });

  it('does not throw when the database rejects the update', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('DB connection lost'));
    const { updateActivityLog } = await import('./activity-log');

    await expect(
      updateActivityLog('msg-fail', { status: 'success' }),
    ).resolves.not.toThrow();
  });
});
