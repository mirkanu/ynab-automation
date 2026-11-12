import { describe, it, expect, vi, beforeEach } from 'vitest';

// `vi.mock` factories are hoisted above the module imports, so the mock
// functions have to be created with `vi.hoisted` to exist by then.
const { mockGetSetting, mockGetCategories, mockFindCategory } = vi.hoisted(() => ({
  mockGetSetting: vi.fn<(key: string) => Promise<string | undefined>>(),
  mockGetCategories: vi.fn(),
  mockFindCategory: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
  getSetting: (key: string) => mockGetSetting(key),
}));

vi.mock('@/lib/ynab', () => ({
  getCategories: mockGetCategories,
  findCategory: mockFindCategory,
}));

// The DB module is mocked so no real database is touched by this unit test.
vi.mock('@/lib/db', () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    activityLog: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import {
  loadCurrencyRules,
  resolveAccountId,
  resolveCategory,
  FIRST_RETRY_DELAY_MS,
  SUBSEQUENT_RETRY_DELAY_MS,
} from './order-processing';

const config = {
  senders: [{ email: 'alice@example.com', name: 'Alice', accountId: 'acct-owner' }],
  adminEmail: 'admin@test.com',
  currencyAccounts: { EUR: 'acct-eur-env' },
};

describe('loadCurrencyRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty list when the setting is missing', async () => {
    mockGetSetting.mockResolvedValue(undefined);

    expect(await loadCurrencyRules()).toEqual([]);
  });

  it('returns the parsed rules when the setting is present', async () => {
    mockGetSetting.mockResolvedValue(
      JSON.stringify([{ currency: 'EUR', accountId: 'acct-eur-db' }]),
    );

    expect(await loadCurrencyRules()).toEqual([
      { currency: 'EUR', accountId: 'acct-eur-db' },
    ]);
  });

  it('returns an empty list when the setting is not valid JSON', async () => {
    mockGetSetting.mockResolvedValue('{not json');

    expect(await loadCurrencyRules()).toEqual([]);
  });

  it('returns an empty list when the setting is not an array', async () => {
    mockGetSetting.mockResolvedValue('{"currency":"EUR"}');

    expect(await loadCurrencyRules()).toEqual([]);
  });
});

describe('resolveAccountId', () => {
  it('prefers the DB currency rule', () => {
    const accountId = resolveAccountId(
      config,
      [{ currency: 'EUR', accountId: 'acct-eur-db' }],
      'acct-owner',
      'EUR',
    );

    expect(accountId).toBe('acct-eur-db');
  });

  it('matches the currency rule case-insensitively', () => {
    const accountId = resolveAccountId(
      config,
      [{ currency: 'eur', accountId: 'acct-eur-db' }],
      'acct-owner',
      'EUR',
    );

    expect(accountId).toBe('acct-eur-db');
  });

  it('falls back to the env-var currency accounts when no rule matches', () => {
    const accountId = resolveAccountId(
      config,
      [{ currency: 'USD', accountId: 'acct-usd-db' }],
      'acct-owner',
      'EUR',
    );

    expect(accountId).toBe('acct-eur-env');
  });

  it("falls back to the owner's own account when the currency is unknown everywhere", () => {
    const accountId = resolveAccountId(config, [], 'acct-owner', 'GBP');

    expect(accountId).toBe('acct-owner');
  });
});

describe('resolveCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty object when there is no hint', async () => {
    expect(await resolveCategory('budget-1', null)).toEqual({});
    expect(mockGetCategories).not.toHaveBeenCalled();
  });

  it('returns the matched category id and name', async () => {
    mockGetCategories.mockResolvedValue([{ id: 'cat-1', name: 'Groceries' }]);
    mockFindCategory.mockReturnValue({ id: 'cat-1', name: 'Groceries' });

    expect(await resolveCategory('budget-1', 'grocery')).toEqual({
      categoryId: 'cat-1',
      categoryName: 'Groceries',
    });
  });

  it('returns an empty object when the category lookup throws', async () => {
    mockGetCategories.mockRejectedValue(new Error('YNAB API error: 500'));

    expect(await resolveCategory('budget-1', 'grocery')).toEqual({});
  });
});

describe('retry delay constants', () => {
  it('schedules the first retry 6 hours out and later retries 24 hours out', () => {
    expect(FIRST_RETRY_DELAY_MS).toBe(6 * 60 * 60 * 1000);
    expect(SUBSEQUENT_RETRY_DELAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});
