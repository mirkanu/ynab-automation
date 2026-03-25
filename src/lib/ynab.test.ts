import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We will stub global fetch for all tests
import {
  createYnabTransaction,
  getCategories,
  findCategory,
  type YnabTransactionParams,
  type YnabCategory,
} from './ynab';

const BASE_PARAMS: YnabTransactionParams = {
  budgetId: 'bud-456',
  accountId: 'acc-123',
  amount: 12.99,
  description: 'AirPods case',
  senderName: 'Manuel',
  payeeName: 'Amazon',
  date: '2024-03-15',
};

// Mock fetch response factory
function makeOkResponse(transactionId: string) {
  return {
    ok: true,
    status: 201,
    json: async () => ({
      data: {
        transaction: { id: transactionId },
      },
    }),
  };
}

describe('createYnabTransaction', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Set required env var
    process.env.YNAB_PERSONAL_ACCESS_TOKEN = 'test-token-abc';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YNAB_PERSONAL_ACCESS_TOKEN;
  });

  it('POSTs to the correct YNAB endpoint for the given budgetId', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-001'));

    await createYnabTransaction(BASE_PARAMS);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.youneedabudget.com/v1/budgets/bud-456/transactions');
  });

  it('sends correct Authorization header using YNAB_PERSONAL_ACCESS_TOKEN', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-002'));

    await createYnabTransaction(BASE_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token-abc');
  });

  it('converts amount to negative milliunits: 12.99 → -12990', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-003'));

    await createYnabTransaction(BASE_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { amount: number } };
    expect(body.transaction.amount).toBe(-12990);
  });

  it('converts amount: 5.00 → -5000', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-004'));

    await createYnabTransaction({ ...BASE_PARAMS, amount: 5.0 });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { amount: number } };
    expect(body.transaction.amount).toBe(-5000);
  });

  it('converts amount: 100.00 → -100000', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-005'));

    await createYnabTransaction({ ...BASE_PARAMS, amount: 100.0 });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { amount: number } };
    expect(body.transaction.amount).toBe(-100000);
  });

  it('sets payee_name to the provided payeeName (Amazon)', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-006'));

    await createYnabTransaction(BASE_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { payee_name: string } };
    expect(body.transaction.payee_name).toBe('Amazon');
  });

  it('sets payee_name to Costco when payeeName is Costco', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-012'));

    await createYnabTransaction({ ...BASE_PARAMS, payeeName: 'Costco' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { payee_name: string } };
    expect(body.transaction.payee_name).toBe('Costco');
  });

  it('formats memo as "Manuel: AirPods case - Automatically added from email"', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-007'));

    await createYnabTransaction(BASE_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { memo: string } };
    expect(body.transaction.memo).toBe('Manuel: AirPods case - Automatically added from email');
  });

  it('omits category_id from the request body to prevent YNAB auto-assign', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-008'));

    await createYnabTransaction(BASE_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: Record<string, unknown> };
    expect(body.transaction.category_id).toBeUndefined();
  });

  it('sets account_id from params.accountId', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-009'));

    await createYnabTransaction(BASE_PARAMS);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { account_id: string } };
    expect(body.transaction.account_id).toBe('acc-123');
  });

  it('returns the transaction ID from the YNAB response', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-010'));

    const transactionId = await createYnabTransaction(BASE_PARAMS);

    expect(transactionId).toBe('txn-uuid-010');
  });

  it('throws an Error with the status code when fetch returns non-201 status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: { detail: 'Invalid transaction' } }),
    });

    await expect(createYnabTransaction(BASE_PARAMS)).rejects.toThrow('422');
  });

  it('uses the provided date in the YNAB transaction', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-011'));

    await createYnabTransaction({ ...BASE_PARAMS, date: '2024-03-15' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { date: string } };
    expect(body.transaction.date).toBe('2024-03-15');
  });

  it('includes category_id in the POST body when categoryId is provided', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-013'));

    await createYnabTransaction({ ...BASE_PARAMS, categoryId: 'cat-uuid-001' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: { category_id?: string } };
    expect(body.transaction.category_id).toBe('cat-uuid-001');
  });

  it('omits category_id from the POST body when categoryId is undefined', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('txn-uuid-014'));

    await createYnabTransaction({ ...BASE_PARAMS, categoryId: undefined });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string) as { transaction: Record<string, unknown> };
    expect(body.transaction.category_id).toBeUndefined();
  });
});

// Sample category groups response from YNAB
const MOCK_CATEGORY_GROUPS_RESPONSE = {
  data: {
    category_groups: [
      {
        id: 'grp-1',
        name: 'Everyday Expenses',
        deleted: false,
        categories: [
          { id: 'cat-1', name: 'Groceries & Dining', deleted: false },
          { id: 'cat-2', name: 'Transport', deleted: false },
          { id: 'cat-deleted', name: 'Old Category', deleted: true },
        ],
      },
      {
        id: 'grp-2',
        name: 'Personal',
        deleted: false,
        categories: [
          { id: 'cat-3', name: 'Clothing', deleted: false },
        ],
      },
    ],
  },
};

describe('getCategories', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.YNAB_PERSONAL_ACCESS_TOKEN = 'test-token-abc';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YNAB_PERSONAL_ACCESS_TOKEN;
  });

  it('GETs the correct YNAB categories endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_CATEGORY_GROUPS_RESPONSE,
    });

    await getCategories('bud-456');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.youneedabudget.com/v1/budgets/bud-456/categories');
  });

  it('returns a flat list of non-deleted categories from all groups', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_CATEGORY_GROUPS_RESPONSE,
    });

    const result = await getCategories('bud-456');

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(['cat-1', 'cat-2', 'cat-3']);
  });

  it('excludes deleted categories', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_CATEGORY_GROUPS_RESPONSE,
    });

    const result = await getCategories('bud-456');
    expect(result.find((c) => c.id === 'cat-deleted')).toBeUndefined();
  });

  it('throws when YNAB returns a non-2xx status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(getCategories('bud-456')).rejects.toThrow('401');
  });
});

describe('findCategory', () => {
  const categories: YnabCategory[] = [
    { id: 'cat-1', name: 'Groceries & Dining' },
    { id: 'cat-2', name: 'Transport' },
    { id: 'cat-3', name: 'Clothing' },
  ];

  it('matches case-insensitively (lowercase hint)', () => {
    expect(findCategory(categories, 'groceries')?.id).toBe('cat-1');
  });

  it('matches case-insensitively (exact case)', () => {
    expect(findCategory(categories, 'Groceries')?.id).toBe('cat-1');
  });

  it('matches by partial name (substring)', () => {
    expect(findCategory(categories, 'Dining')?.id).toBe('cat-1');
  });

  it('returns null when no category matches the hint', () => {
    expect(findCategory(categories, 'xyz-no-match')).toBeNull();
  });

  it('returns null for an empty categories array', () => {
    expect(findCategory([], 'Groceries')).toBeNull();
  });
});
