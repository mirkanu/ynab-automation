import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivityLogEntry } from './activity-log';

const mockCreate = vi.fn().mockResolvedValue({ id: 1 });

vi.mock('@/lib/db', () => ({
  prisma: {
    activityLog: {
      create: mockCreate,
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

  it('does not throw on database errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB connection lost'));
    const { writeActivityLog } = await import('./activity-log');

    await expect(
      writeActivityLog({ messageId: 'msg-fail', status: 'success' }),
    ).resolves.not.toThrow();
  });
});
