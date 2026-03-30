// YNAB REST API client for creating budget transactions.
// Uses native fetch — no YNAB SDK needed for a simple POST.

import { prisma } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/crypto';

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
}

/**
 * Retrieves a valid YNAB access token for the given user.
 *
 * Strategy:
 * - If the token is fresh (not within 5-min expiry window) → decrypt and return
 * - If another refresh was attempted within 30s (concurrent mutex) → re-read from DB and return
 * - Otherwise → refresh via YNAB OAuth token endpoint, store encrypted result, return plaintext token
 *
 * @throws Error('User has not connected YNAB account') if user has no OAuth token
 * @throws Error('YNAB token refresh failed — user must re-authorize') if refresh fails
 */
export async function getValidYnabToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      oauthToken: true,
      oauthRefreshToken: true,
      oauthExpiresAt: true,
      lastRefreshAttemptAt: true,
    },
  });

  if (!user?.oauthToken) {
    throw new Error('User has not connected YNAB account');
  }

  // Check if token is still fresh (more than 5 minutes remaining)
  const fiveMinutesMs = BigInt(5 * 60 * 1000);
  const nowBigInt = BigInt(Date.now());
  const isExpiredOrNearExpiry =
    nowBigInt >= (user.oauthExpiresAt ?? BigInt(0)) - fiveMinutesMs;

  if (!isExpiredOrNearExpiry) {
    return decryptToken(user.oauthToken);
  }

  // Concurrent mutex: if lastRefreshAttemptAt is within 30 seconds, re-read from DB
  // to get the refreshed token from the concurrent call that already ran
  if (
    user.lastRefreshAttemptAt &&
    Date.now() - user.lastRefreshAttemptAt.getTime() < 30_000
  ) {
    const freshUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        oauthToken: true,
        oauthRefreshToken: true,
        oauthExpiresAt: true,
        lastRefreshAttemptAt: true,
      },
    });

    const freshIsExpiredOrNearExpiry =
      BigInt(Date.now()) >= (freshUser?.oauthExpiresAt ?? BigInt(0)) - fiveMinutesMs;

    if (!freshIsExpiredOrNearExpiry && freshUser?.oauthToken) {
      return decryptToken(freshUser.oauthToken);
    }
    // Fall through: the mutex holder may have failed, try our own refresh
  }

  // Perform token refresh
  if (!user.oauthRefreshToken) {
    throw new Error('User has not connected YNAB account');
  }

  const refreshToken = decryptToken(user.oauthRefreshToken);

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.YNAB_CLIENT_ID ?? '',
    client_secret: process.env.YNAB_CLIENT_SECRET ?? '',
  });

  const refreshRes = await fetch('https://app.ynab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!refreshRes.ok) {
    throw new Error('YNAB token refresh failed — user must re-authorize');
  }

  const tokenData = await refreshRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const newExpiresAt = BigInt(Date.now() + tokenData.expires_in * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      oauthToken: encryptToken(tokenData.access_token),
      oauthRefreshToken: encryptToken(tokenData.refresh_token),
      oauthExpiresAt: newExpiresAt,
      lastRefreshAttemptAt: new Date(),
    },
  });

  return tokenData.access_token;
}

/**
 * Fetches all non-deleted categories for a budget, flattened from category groups.
 *
 * @returns Flat array of {id, name} for every non-deleted category.
 * @throws Error with the HTTP status if YNAB returns a non-2xx response.
 */
export async function getCategories(userId: string, budgetId: string): Promise<YnabCategory[]> {
  const token = await getValidYnabToken(userId);
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
export async function getAccountName(userId: string, budgetId: string, accountId: string): Promise<string> {
  try {
    const token = await getValidYnabToken(userId);
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
  userId: string,
  params: YnabTransactionParams,
): Promise<string> {
  const { budgetId, accountId, amount, description, senderName, payeeName, date, categoryId } = params;

  const token = await getValidYnabToken(userId);

  // Convert to milliunits, negate for outflow
  const milliunits = Math.round(amount * 1000) * -1;

  const memo = `${senderName}: ${description} - Automatically added from email`;

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
