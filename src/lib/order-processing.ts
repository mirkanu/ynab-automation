// Helpers shared by the webhook and the retry worker.
//
// Both paths take an order email and turn it into a YNAB transaction. When
// they each had their own copy of the account/category resolution logic they
// could drift — and a drift here means money landing in the wrong account.
// Keeping the resolution in one module guarantees the retry path resolves the
// account exactly like the original webhook did.

import { getSetting } from '@/lib/settings'
import { getAccountForCurrency, type AppConfig } from '@/lib/config'
import { getCategories, findCategory } from '@/lib/ynab'

export interface CurrencyRule {
  currency: string
  accountId: string
}

/** Delay before the FIRST automatic retry of a quota-exhausted email: 6 hours. */
export const FIRST_RETRY_DELAY_MS = 6 * 60 * 60 * 1000

/** Delay before every SUBSEQUENT retry: 24 hours. */
export const SUBSEQUENT_RETRY_DELAY_MS = 24 * 60 * 60 * 1000

/**
 * Loads the currency→account rules from the DB settings.
 *
 * Returns an empty list when the setting is missing or not valid JSON —
 * never throws, because a broken rule set must not stop an order from being
 * recorded.
 */
export async function loadCurrencyRules(): Promise<CurrencyRule[]> {
  try {
    const raw = await getSetting('CURRENCY_RULES')
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as CurrencyRule[]
  } catch (err) {
    console.error('loadCurrencyRules failed, continuing without currency rules:', err)
    return []
  }
}

/**
 * Resolves the YNAB account an order's transaction belongs to.
 *
 * Precedence:
 *   1. the DB currency rule for the order's currency,
 *   2. the env-var currency accounts,
 *   3. the owner's own default account.
 *
 * @param config - App config (env-var senders + currency accounts)
 * @param currencyRules - Currency rules from the DB
 * @param ownerAccountId - The owner's default YNAB account id
 * @param currency - Currency of the parsed order (e.g. "GBP")
 */
export function resolveAccountId(
  config: AppConfig,
  currencyRules: CurrencyRule[],
  ownerAccountId: string,
  currency: string,
): string {
  const match = currencyRules.find(
    r => r.currency.toUpperCase() === currency.toUpperCase(),
  )
  return match?.accountId ?? getAccountForCurrency(config, ownerAccountId, currency)
}

/**
 * Resolves a user-typed category hint to a YNAB category id + name.
 *
 * Returns an empty object when there is no hint, no match, or the category
 * lookup fails — a missing category must never lose a transaction.
 */
export async function resolveCategory(
  budgetId: string,
  categoryHint: string | null,
): Promise<{ categoryId?: string; categoryName?: string }> {
  if (!categoryHint) return {}
  try {
    const categories = await getCategories(budgetId)
    const matched = findCategory(categories, categoryHint)
    if (matched) {
      return { categoryId: matched.id, categoryName: matched.name }
    }
    return {}
  } catch (err) {
    console.error('getCategories failed, continuing without category:', err)
    return {}
  }
}
