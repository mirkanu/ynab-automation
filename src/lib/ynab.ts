// YNAB REST API client for creating budget transactions.
// Uses native fetch — no YNAB SDK needed for a simple POST.

export interface YnabCategory {
  id: string;
  name: string;
}

export interface YnabTransactionParams {
  budgetId: string;
  accountId: string;
  amount: number;        // in pounds/dollars (e.g. 12.99) — NOT milliunits
  description: string;
  senderName: string;    // e.g. "Manuel" or "Emily-Kate"
  payeeName: string;     // e.g. "Amazon", "Costco", "Apple" — dynamic, not hardcoded
  date: string;          // YYYY-MM-DD order date from the email
  categoryId?: string;   // YNAB category UUID — omit or undefined for uncategorized
}

/**
 * Creates a YNAB transaction via the YNAB REST API.
 *
 * Amount is converted to milliunits and negated (outflow).
 * Memo is formatted as "{senderName} — {description}" (em dash).
 * Payee is set to the provided payeeName parameter. Category is unset (null).
 * Date is today (processing date, not the order date).
 *
 * @returns The YNAB transaction ID string on success.
 * @throws Error with the HTTP status code if YNAB returns a non-2xx response.
 */
/**
 * Fetches all non-deleted categories for a budget, flattened from category groups.
 *
 * @returns Flat array of {id, name} for every non-deleted category.
 * @throws Error with the HTTP status if YNAB returns a non-2xx response.
 */
export async function getCategories(budgetId: string): Promise<YnabCategory[]> {
  const url = `https://api.youneedabudget.com/v1/budgets/${budgetId}/categories`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.YNAB_PERSONAL_ACCESS_TOKEN}`,
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

export async function createYnabTransaction(
  params: YnabTransactionParams,
): Promise<string> {
  const { budgetId, accountId, amount, description, senderName, payeeName, date, categoryId } = params;

  // Convert to milliunits, negate for outflow
  const milliunits = Math.round(amount * 1000) * -1;

  const memo = `${senderName}: ${description} - Automatically added from email`;

  const url = `https://api.youneedabudget.com/v1/budgets/${budgetId}/transactions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.YNAB_PERSONAL_ACCESS_TOKEN}`,
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
