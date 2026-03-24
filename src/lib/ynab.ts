// YNAB REST API client for creating budget transactions.
// Uses native fetch — no YNAB SDK needed for a simple POST.

export interface YnabTransactionParams {
  budgetId: string;
  accountId: string;
  amount: number;        // in pounds/dollars (e.g. 12.99) — NOT milliunits
  description: string;
  senderName: string;    // e.g. "Manuel" or "Emily-Kate"
}

/**
 * Creates a YNAB transaction via the YNAB REST API.
 *
 * Amount is converted to milliunits and negated (outflow).
 * Memo is formatted as "{senderName} — {description}" (em dash).
 * Payee is hardcoded to "Amazon". Category is unset (null).
 * Date is today (processing date, not the order date).
 *
 * @returns The YNAB transaction ID string on success.
 * @throws Error with the HTTP status code if YNAB returns a non-2xx response.
 */
export async function createYnabTransaction(
  params: YnabTransactionParams,
): Promise<string> {
  const { budgetId, accountId, amount, description, senderName } = params;

  // Convert to milliunits, negate for outflow
  const milliunits = Math.round(amount * 1000) * -1;

  // Today's date in YYYY-MM-DD format
  const date = new Date().toISOString().split('T')[0];

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
        payee_name: 'Amazon',
        memo,
        cleared: 'cleared',
        approved: false,
        category_id: null,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`YNAB API error: ${res.status}`);
  }

  const data = await res.json() as { data: { transaction: { id: string } } };
  return data.data.transaction.id;
}
