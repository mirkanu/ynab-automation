import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfig,
  getSenderByEmail,
  getAccountForCurrency,
  notificationSuffix,
  type SenderConfig,
  type AppConfig,
} from './config';

const VALID_SENDERS = JSON.stringify([
  {
    email: 'alice@example.com',
    name: 'Alice',
    accountId: 'ynab-alice-account-uuid',
    notificationLabel: 'Alice',
  },
  {
    email: 'bob@example.com',
    name: 'Bob',
    accountId: 'ynab-bob-account-uuid',
  },
]);

const VALID_CURRENCY_ACCOUNTS = JSON.stringify({ EUR: 'ynab-euro-account-uuid' });

describe('loadConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.SENDERS;
    delete process.env.ADMIN_EMAIL;
    delete process.env.CURRENCY_ACCOUNTS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a valid AppConfig when all required env vars are set', () => {
    process.env.SENDERS = VALID_SENDERS;
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const config = loadConfig();

    expect(config.senders).toHaveLength(2);
    expect(config.adminEmail).toBe('admin@example.com');
    expect(config.currencyAccounts).toEqual({});
  });

  it('includes CURRENCY_ACCOUNTS when set', () => {
    process.env.SENDERS = VALID_SENDERS;
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.CURRENCY_ACCOUNTS = VALID_CURRENCY_ACCOUNTS;

    const config = loadConfig();

    expect(config.currencyAccounts).toEqual({ EUR: 'ynab-euro-account-uuid' });
  });

  it('defaults currencyAccounts to {} when CURRENCY_ACCOUNTS is absent', () => {
    process.env.SENDERS = VALID_SENDERS;
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const config = loadConfig();

    expect(config.currencyAccounts).toEqual({});
  });

  it('throws if SENDERS is missing', () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';

    expect(() => loadConfig()).toThrow('SENDERS env var is required');
  });

  it('throws if SENDERS is not valid JSON', () => {
    process.env.SENDERS = 'not-valid-json';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    expect(() => loadConfig()).toThrow('SENDERS env var is not valid JSON');
  });

  it('throws if SENDERS is an empty array', () => {
    process.env.SENDERS = '[]';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    expect(() => loadConfig()).toThrow('SENDERS must be a non-empty JSON array');
  });

  it('throws if SENDERS is not an array', () => {
    process.env.SENDERS = '{"email":"a@b.com"}';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    expect(() => loadConfig()).toThrow('SENDERS must be a non-empty JSON array');
  });

  it('throws if a sender is missing required fields', () => {
    process.env.SENDERS = JSON.stringify([{ email: 'alice@example.com', name: 'Alice' }]); // missing accountId
    process.env.ADMIN_EMAIL = 'admin@example.com';

    expect(() => loadConfig()).toThrow('email, name, and accountId');
  });

  it('throws if ADMIN_EMAIL is missing', () => {
    process.env.SENDERS = VALID_SENDERS;

    expect(() => loadConfig()).toThrow('ADMIN_EMAIL env var is required');
  });

  it('throws if CURRENCY_ACCOUNTS is not valid JSON', () => {
    process.env.SENDERS = VALID_SENDERS;
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.CURRENCY_ACCOUNTS = 'invalid';

    expect(() => loadConfig()).toThrow('CURRENCY_ACCOUNTS env var is not valid JSON');
  });

  it('parses sender fields including optional notificationLabel', () => {
    process.env.SENDERS = VALID_SENDERS;
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const config = loadConfig();

    expect(config.senders[0].email).toBe('alice@example.com');
    expect(config.senders[0].name).toBe('Alice');
    expect(config.senders[0].accountId).toBe('ynab-alice-account-uuid');
    expect(config.senders[0].notificationLabel).toBe('Alice');
    expect(config.senders[1].notificationLabel).toBeUndefined();
  });
});

describe('getSenderByEmail', () => {
  const config: AppConfig = {
    senders: [
      { email: 'alice@example.com', name: 'Alice', accountId: 'acc-alice' },
      { email: 'bob@example.com', name: 'Bob', accountId: 'acc-bob', notificationLabel: 'Bob' },
    ],
    adminEmail: 'admin@example.com',
    currencyAccounts: {},
  };

  it('returns matching SenderConfig for a known email', () => {
    const result = getSenderByEmail(config, 'alice@example.com');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Alice');
  });

  it('matches case-insensitively', () => {
    const result = getSenderByEmail(config, 'ALICE@EXAMPLE.COM');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Alice');
  });

  it('returns null for an unrecognised email', () => {
    const result = getSenderByEmail(config, 'unknown@example.com');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', () => {
    const result = getSenderByEmail(config, '');
    expect(result).toBeNull();
  });
});

describe('getAccountForCurrency', () => {
  const config: AppConfig = {
    senders: [],
    adminEmail: 'admin@example.com',
    currencyAccounts: { EUR: 'ynab-euro-account-uuid' },
  };

  it('returns the currency override account ID when currency is in currencyAccounts', () => {
    const result = getAccountForCurrency(config, 'ynab-alice-account-uuid', 'EUR');
    expect(result).toBe('ynab-euro-account-uuid');
  });

  it('returns senderAccountId when currency is NOT in currencyAccounts', () => {
    const result = getAccountForCurrency(config, 'ynab-alice-account-uuid', 'GBP');
    expect(result).toBe('ynab-alice-account-uuid');
  });

  it('returns senderAccountId when currencyAccounts is empty', () => {
    const emptyConfig: AppConfig = { ...config, currencyAccounts: {} };
    const result = getAccountForCurrency(emptyConfig, 'ynab-alice-account-uuid', 'EUR');
    expect(result).toBe('ynab-alice-account-uuid');
  });
});

describe('notificationSuffix', () => {
  it('returns " (label)" when notificationLabel is set', () => {
    const sender: SenderConfig = {
      email: 'alice@example.com',
      name: 'Alice',
      accountId: 'acc-alice',
      notificationLabel: 'Alice',
    };
    expect(notificationSuffix(sender)).toBe(' (Alice)');
  });

  it('returns "" when notificationLabel is not set', () => {
    const sender: SenderConfig = {
      email: 'bob@example.com',
      name: 'Bob',
      accountId: 'acc-bob',
    };
    expect(notificationSuffix(sender)).toBe('');
  });
});
