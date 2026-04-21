// YNAB REST API client for creating budget transactions.
// Uses native fetch — no YNAB SDK needed for a simple POST.
// Phase 22 note: token is now read from the YNAB_ACCESS_TOKEN DB Setting (PAT-based).

import { getSetting } from '@/lib/settings';

export interface YnabCategory {
  id: string;
  name: string;
}

export interface YnabTransactionParams {
  budgetId: string;
  accountId: string;
  amount: number;        // in pounds/dollars (e.g. 12.99) — NOT milliunits
  description: string;
  senderName: string;    // e.g. "Alice" or "Bob"
  payeeName: string;     // e.g. "Amazon", "Costco", "Apple" — dynamic, not hardcoded
  date: string;          // YYYY-MM-DD order date from the email
  categoryId?: string;   // YNAB category UUID — omit or undefined for uncategorized
  customNote?: string;   // Optional free-text note typed at top of forwarded email — replaces default memo suffix
}

/**
 * Formats the YNAB memo string from sender, description, and optional custom note.
 *
 * With customNote: "{sender}: {description} - {customNote}"
 * Without:        "{sender}: {description} - Automatically added from email"
 */
export function formatMemo(
  senderName: string,
  description: string,
  customNote?: string,
): string {
  const suffix = customNote && customNote.trim()
    ? customNote.trim()
    : 'Automatically added from email';
  return `${senderName}: ${description} - ${suffix}`;
}

/**
 * Retrieves a valid YNAB Personal Access Token from the YNAB_ACCESS_TOKEN DB setting.
 * Phase 22 will expose a settings UI to set this value.
 *
 * @throws Error('YNAB_ACCESS_TOKEN not configured in settings') if not set
 */
async function getValidYnabToken(): Promise<string> {
  const token = await getSetting('YNAB_ACCESS_TOKEN');
  if (!token) throw new Error('YNAB_ACCESS_TOKEN not configured in settings');
  return token;
}

/**
 * Fetches all non-deleted categories for a budget, flattened from category groups.
 *
 * @returns Flat array of {id, name} for every non-deleted category.
 * @throws Error with the HTTP status if YNAB returns a non-2xx response.
 */
export async function getCategories(budgetId: string): Promise<YnabCategory[]> {
  const token = await getValidYnabToken();
  const url = `https://api.youneedabudget.com/v1/budgets/${budgetId}/categories`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`YNAB API error: ${res.status}`);
  }

  const data = await res.json() as {
    data: {
      category_groups: Array<{
        id: string;
        name: string;
        deleted: boolean;
        categories: Array<{ id: string; name: string; deleted: boolean }>;
      }>;
    };
  };

  const categories: YnabCategory[] = [];
  for (const group of data.data.category_groups) {
    for (const cat of group.categories) {
      if (!cat.deleted) {
        categories.push({ id: cat.id, name: cat.name });
      }
    }
  }
  return categories;
}

/**
 * Finds the first category whose name contains the hint (case-insensitive).
 * Returns null if no match is found.
 */
export function findCategory(categories: YnabCategory[], hint: string): YnabCategory | null {
  const lower = hint.toLowerCase();
  return categories.find((c) => c.name.toLowerCase().includes(lower)) ?? null;
}

/**
 * Looks up an account name by ID. Returns the ID if lookup fails.
 */
export async function getAccountName(budgetId: string, accountId: string): Promise<string> {
  try {
    const token = await getValidYnabToken();
    const res = await fetch(`https://api.youneedabudget.com/v1/budgets/${budgetId}/accounts/${accountId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return accountId;
    const data = await res.json() as { data: { account: { name: string } } };
    return data.data.account.name;
  } catch {
    return accountId;
  }
}

/**
 * Creates a YNAB transaction via the YNAB REST API.
 *
 * Amount is converted to milliunits and negated (outflow).
 * Memo is formatted as "{senderName}: {description} - Automatically added from email".
 * Payee is set to the provided payeeName parameter. Category is unset (null).
 * Date is the order date from the email.
 *
 * @returns The YNAB transaction ID string on success.
 * @throws Error with the HTTP status code if YNAB returns a non-2xx response.
 */
export async function createYnabTransaction(
  params: YnabTransactionParams,
): Promise<string> {
  const { budgetId, accountId, amount, description, senderName, payeeName, date, categoryId, customNote } = params;

  const token = await getValidYnabToken();

  // Convert to milliunits, negate for outflow
  const milliunits = Math.round(amount * 1000) * -1;

  const memo = formatMemo(senderName, description, customNote);

  const url = `https://api.youneedabudget.com/v1/budgets/${budgetId}/transactions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: {
        account_id: accountId,
        date,
        amount: milliunits,
        payee_name: payeeName,
        memo,
        cleared: 'uncleared',
        approved: false,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`YNAB API error: ${res.status}`);
  }

  const data = await res.json() as { data: { transaction: { id: string } } };
  return data.data.transaction.id;
}
