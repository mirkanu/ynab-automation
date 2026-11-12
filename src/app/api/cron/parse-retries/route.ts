// Deferred-retry worker for order emails that could not be parsed because the
// LLM provider's token plan was exhausted (HTTP 429).
//
// The webhook no longer loses such an email: it stores it as 'retry_pending'
// with the resolved owner and a next-attempt time. This worker picks those
// rows up and tries again. The FIRST failure (in the webhook) notifies nobody;
// this worker notifies the admin from the SECOND failure onwards, and moves the
// next attempt 24 hours out.
//
// Guarded by CRON_SECRET — the route fails CLOSED when the env var is unset.
// The secret is never echoed back in a response.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseOrderEmail } from '@/lib/claude'
import { extractCategoryHint, extractOrderNumber } from '@/lib/email'
import { createYnabTransaction, getAccountName, formatMemo } from '@/lib/ynab'
import { loadConfig } from '@/lib/config'
import { sendErrorNotification } from '@/lib/notify'
import { updateActivityLog } from '@/lib/activity-log'
import { getSetting } from '@/lib/settings'
import {
  SUBSEQUENT_RETRY_DELAY_MS,
  loadCurrencyRules,
  resolveAccountId,
  resolveCategory,
} from '@/lib/order-processing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // --- Auth gate: fail closed when CRON_SECRET is missing ---
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let config: ReturnType<typeof loadConfig>
  try {
    config = loadConfig()
  } catch (err) {
    console.error('parse-retries: config unavailable:', err)
    return NextResponse.json({ error: 'config unavailable' }, { status: 500 })
  }

  const appUrl = process.env.YNAB_APP_URL ?? ''

  let due: Array<{
    id: number
    messageId: string
    subject: string | null
    rawBody: string | null
    orderNumber: string | null
    ownerName: string | null
    ownerAccountId: string | null
    retryCount: number
    retryAt: Date | null
  }>
  try {
    due = await prisma.activityLog.findMany({
      where: { status: 'retry_pending', retryAt: { lte: new Date() } },
      orderBy: { id: 'asc' },
    })
  } catch (err) {
    console.error('parse-retries: could not load due rows:', err)
    return NextResponse.json({ error: 'database unavailable' }, { status: 500 })
  }

  let succeeded = 0
  let duplicates = 0
  let failed = 0
  let adminEmailsSent = 0

  for (const row of due) {
    try {
      // 1. No stored body → nothing to re-parse.
      if (!row.rawBody) {
        await updateActivityLog(row.messageId, {
          status: 'parse_error',
          errorType: 'no_raw_body',
          errorMessage: 'No raw body stored — cannot retry',
          retryAt: null,
        })
        failed++
        continue
      }

      // 2. No owner account → we cannot know where the money belongs.
      if (!row.ownerAccountId) {
        await updateActivityLog(row.messageId, {
          status: 'parse_error',
          errorType: 'missing_owner_account',
          errorMessage: 'No owner account recorded — cannot retry',
          retryAt: null,
        })
        await sendErrorNotification({
          to: config.adminEmail,
          subject: 'YNAB automation: failed to parse order email',
          body:
            `An order confirmation email could not be parsed automatically and no owner account was recorded, so it cannot be retried. No YNAB transaction was created.\n\n` +
            `Error: no owner account recorded for this email.\n\n` +
            `Message ID: ${row.messageId}\n\n` +
            `View in log: ${appUrl}/logs\n\n` +
            `Please add this transaction to YNAB manually.`,
        })
        adminEmailsSent++
        failed++
        continue
      }

      // 3. Re-parse with the configured provider (no provider fallback).
      const parseResult = await parseOrderEmail(row.rawBody, row.ownerName ?? '')

      // 4. The quota is STILL exhausted — keep the email queued, tell the admin.
      if (!parseResult.ok && parseResult.reason === 'quota_exceeded') {
        const retryCount = (row.retryCount ?? 0) + 1
        const nextAttempt = new Date(Date.now() + SUBSEQUENT_RETRY_DELAY_MS)

        await sendErrorNotification({
          to: config.adminEmail,
          subject: 'YNAB automation: LLM provider quota still exhausted — order still queued',
          body:
            `The LLM provider's quota is exhausted, so an order email could not be parsed. The email is STILL QUEUED and has not been lost — it will be tried again automatically.\n\n` +
            `Subject: ${row.subject ?? '(unknown)'}\n` +
            `Message ID: ${row.messageId}\n` +
            `Forwarded by: ${row.ownerName ?? 'unknown'}\n` +
            `Failed attempts so far: ${retryCount}\n` +
            `Next automatic attempt: ${nextAttempt.toISOString()}\n\n` +
            `No YNAB transaction has been created for this order yet.\n\n` +
            `View in log: ${appUrl}/logs`,
        })
        adminEmailsSent++

        await updateActivityLog(row.messageId, {
          status: 'retry_pending',
          retryCount,
          retryAt: nextAttempt,
          errorType: 'quota_exceeded',
          errorMessage: parseResult.detail,
        })
        failed++
        continue
      }

      // 5. Any other failure → fall back to the "add this to YNAB manually" email.
      if (!parseResult.ok) {
        await updateActivityLog(row.messageId, {
          status: 'parse_error',
          errorType: parseResult.reason,
          errorMessage: parseResult.detail,
          retryAt: null,
        })
        await sendErrorNotification({
          to: config.adminEmail,
          subject: 'YNAB automation: failed to parse order email',
          body:
            `An order confirmation email could not be parsed automatically on retry. No YNAB transaction was created.\n\n` +
            `Error: ${parseResult.reason}: ${parseResult.detail ?? 'failed to extract order details'}\n\n` +
            `Message ID: ${row.messageId}\n\n` +
            `View in log: ${appUrl}/logs\n\n` +
            `Please add this transaction to YNAB manually.`,
        })
        adminEmailsSent++
        failed++
        continue
      }

      // 6. Parsed successfully.
      const order = parseResult.order

      // 6a. Amount guard — same rule as the webhook.
      if (!Number.isFinite(order.amount) || order.amount <= 0) {
        await updateActivityLog(row.messageId, {
          status: 'invalid_amount',
          errorType: 'invalid_amount',
          errorMessage: `Parsed amount ${order.amount} is not usable (<= 0 or NaN)`,
          parseResult: {
            retailer: order.retailer,
            amount: order.amount,
            date: order.date,
            currency: order.currency,
            description: order.description,
          },
          retryAt: null,
        })
        await sendErrorNotification({
          to: config.adminEmail,
          subject: 'YNAB automation: no valid amount found',
          body:
            `An order confirmation email was parsed on retry, but no valid amount could be extracted (parsed amount: ${order.amount}). No YNAB transaction was created.\n\n` +
            `Description: ${order.description}\n` +
            `Retailer: ${order.retailer}\n` +
            `Forwarded by: ${row.ownerName ?? 'unknown'}\n\n` +
            `Message ID: ${row.messageId}\n` +
            `View in log: ${appUrl}/logs`,
        })
        adminEmailsSent++
        failed++
        continue
      }

      // 6b. Order-number dedup — the SAME check as the webhook's step 6c.
      const orderNumber = extractOrderNumber(row.rawBody) ?? undefined
      if (orderNumber) {
        const priorSuccess = await prisma.activityLog.findFirst({
          where: { orderNumber, status: 'success' },
        })
        if (priorSuccess) {
          await updateActivityLog(row.messageId, {
            status: 'duplicate_order',
            orderNumber,
            retryAt: null,
            errorType: null,
            errorMessage: null,
            parseResult: {
              retailer: order.retailer,
              amount: order.amount,
              date: order.date,
              currency: order.currency,
              description: order.description,
            },
          })
          duplicates++
          continue
        }
      }

      // 6c. Create the transaction (mirroring the webhook's steps 6b/7).
      const budgetId = (await getSetting('YNAB_BUDGET_ID')) ?? ''
      const currencyRules = await loadCurrencyRules()
      const accountId = resolveAccountId(config, currencyRules, row.ownerAccountId, order.currency)
      const categoryHint = extractCategoryHint(row.rawBody)
      const { categoryId, categoryName } = await resolveCategory(budgetId, categoryHint)
      const memo = formatMemo(row.ownerName ?? '', order.description, order.customNote)
      const accountName = await getAccountName(budgetId, accountId)
      const testMode = (await getSetting('TEST_MODE')) === 'true'

      const parseResultJson = {
        retailer: order.retailer,
        amount: order.amount,
        date: order.date,
        currency: order.currency,
        description: order.description,
      }

      if (testMode) {
        await updateActivityLog(row.messageId, {
          status: 'test',
          orderNumber,
          retryAt: null,
          errorType: null,
          errorMessage: null,
          parseResult: parseResultJson,
          ynabResult: {
            transactionId: '(test — not created)',
            amount: Math.round(order.amount * 1000) * -1,
            accountId,
            accountName,
            payeeName: order.retailer,
            memo,
            categoryId: categoryId ?? null,
            categoryName: categoryName ?? null,
            date: order.date,
            orderNumber,
          },
        })
        succeeded++
        continue
      }

      try {
        const transactionId = await createYnabTransaction({
          budgetId,
          accountId,
          amount: order.amount,
          description: order.description,
          senderName: row.ownerName ?? '',
          payeeName: order.retailer,
          date: order.date,
          categoryId,
          customNote: order.customNote,
        })

        await updateActivityLog(row.messageId, {
          status: 'success',
          orderNumber,
          retryAt: null,
          errorType: null,
          errorMessage: null,
          parseResult: parseResultJson,
          ynabResult: {
            transactionId,
            amount: Math.round(order.amount * 1000) * -1,
            accountId,
            accountName,
            payeeName: order.retailer,
            memo,
            categoryId: categoryId ?? null,
            categoryName: categoryName ?? null,
            date: order.date,
            orderNumber,
          },
        })
        succeeded++
      } catch (ynabErr) {
        await updateActivityLog(row.messageId, {
          status: 'ynab_error',
          errorType: 'ynab_api_error',
          errorMessage: ynabErr instanceof Error ? ynabErr.message : String(ynabErr),
          retryAt: null,
          parseResult: parseResultJson,
        })
        await sendErrorNotification({
          to: config.adminEmail,
          subject: 'YNAB automation: failed to create transaction',
          body:
            `An order confirmation email was parsed on retry but the YNAB transaction could not be created.\n\n` +
            `Item: ${order.description}\n` +
            `Amount: £${order.amount.toFixed(2)}\n` +
            `Message ID: ${row.messageId}\n\n` +
            `Please add this transaction to YNAB manually.`,
        })
        adminEmailsSent++
        failed++
      }
    } catch (err) {
      // One row's failure must never abort the whole run.
      console.error('parse-retries: row failed:', row.id, err)
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    succeeded,
    duplicates,
    failed,
    adminEmailsSent,
  })
}
