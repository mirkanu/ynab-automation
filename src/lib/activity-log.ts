import { prisma } from '@/lib/db'

export interface ActivityLogEntry {
  messageId: string
  status: 'success' | 'test' | 'parse_error' | 'ynab_error' | 'unknown_sender' | 'duplicate' | 'no_message_id' | 'invalid_amount' | 'duplicate_order' | 'no_price_expected' | 'retry_pending'
  sender?: string
  subject?: string
  rawBody?: string
  orderNumber?: string
  parseResult?: {
    retailer: string
    amount: number
    date: string
    currency: string
    description: string
  }
  ynabResult?: {
    transactionId: string
    amount: number
    accountId: string
    accountName?: string
    payeeName: string
    date: string
    memo?: string
    categoryId?: string | null
    categoryName?: string | null
  }
  errorType?: string
  errorMessage?: string
  // Deferred retry state — set when the LLM provider's token plan is exhausted
  // and the email is queued for an automatic re-parse.
  retryAt?: Date
  retryCount?: number
  // The RESOLVED owner (display name + default YNAB account) the retry worker
  // must use. ActivityLog.sender holds the retailer, not the owner.
  ownerName?: string
  ownerAccountId?: string
}

export async function writeActivityLog(entry: ActivityLogEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        messageId: entry.messageId,
        status: entry.status,
        sender: entry.sender,
        subject: entry.subject,
        rawBody: entry.rawBody,
        orderNumber: entry.orderNumber,
        parseResult: entry.parseResult ?? undefined,
        ynabResult: entry.ynabResult ?? undefined,
        errorType: entry.errorType,
        errorMessage: entry.errorMessage,
        retryAt: entry.retryAt,
        retryCount: entry.retryCount,
        ownerName: entry.ownerName,
        ownerAccountId: entry.ownerAccountId,
      },
    })
  } catch (err) {
    console.error('Failed to write activity log:', err)
  }
}

/**
 * Fields that can be changed on an existing log row.
 *
 * Prisma semantics relied on here: `undefined` fields are ignored (the column
 * keeps its value) while an explicit `null` writes SQL NULL — which is how a
 * row's stale `errorType` is cleared once the row finally succeeds.
 */
export interface ActivityLogPatch {
  status?: string
  errorType?: string | null
  errorMessage?: string | null
  parseResult?: {
    retailer: string
    amount: number
    date: string
    currency: string
    description: string
  }
  ynabResult?: {
    transactionId: string
    amount: number
    accountId: string
    accountName?: string
    payeeName: string
    date: string
    memo?: string
    categoryId?: string | null
    categoryName?: string | null
  }
  orderNumber?: string | null
  retryAt?: Date | null
  retryCount?: number
}

/**
 * Updates an existing activity-log row in place.
 *
 * Never throws — a failed update is logged, not propagated, so a database
 * hiccup in the retry worker cannot abort the whole run.
 */
export async function updateActivityLog(messageId: string, patch: ActivityLogPatch): Promise<void> {
  try {
    await prisma.activityLog.update({
      where: { messageId },
      data: {
        status: patch.status,
        errorType: patch.errorType,
        errorMessage: patch.errorMessage,
        parseResult: patch.parseResult ?? undefined,
        ynabResult: patch.ynabResult ?? undefined,
        orderNumber: patch.orderNumber,
        retryAt: patch.retryAt,
        retryCount: patch.retryCount,
      },
    })
  } catch (err) {
    console.error('Failed to update activity log:', err)
  }
}
