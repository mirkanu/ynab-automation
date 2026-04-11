import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseOrderEmail } from '@/lib/claude'
import { createYnabTransaction, getAccountName } from '@/lib/ynab'
import { loadConfig, getSenderByEmail, getAccountForCurrency } from '@/lib/config'
import { writeActivityLog } from '@/lib/activity-log'
import { getSetting } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const { messageId, forceLive } = (await req.json()) as { messageId: string; forceLive?: boolean }
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }

  // 1. Fetch original log entry
  const entry = await prisma.activityLog.findUnique({ where: { messageId } })
  if (!entry) {
    return NextResponse.json({ error: 'Log entry not found' }, { status: 404 })
  }
  if (!entry.rawBody) {
    return NextResponse.json(
      { error: 'Email body not available for this entry' },
      { status: 422 },
    )
  }

  // 2. Resolve sender
  const config = loadConfig()
  const senderInfo = entry.sender ? getSenderByEmail(config, entry.sender) : null
  if (!senderInfo) {
    return NextResponse.json(
      { error: 'Sender not found in current config' },
      { status: 422 },
    )
  }

  // 3. Parse email
  const parsed = await parseOrderEmail(entry.rawBody, senderInfo.name)
  if (!parsed) {
    await writeActivityLog({
      messageId: `replay-${messageId}-${Date.now()}`,
      status: 'parse_error',
      sender: entry.sender ?? undefined,
      subject: `REPLAY: ${entry.subject ?? ''}`,
      rawBody: entry.rawBody,
      errorType: 'parse_error',
      errorMessage: 'Claude could not re-parse this email',
    })
    return NextResponse.json(
      { error: 'Claude could not parse this email' },
      { status: 422 },
    )
  }

  // 4. Resolve YNAB budget
  const budgetId = await getSetting('YNAB_BUDGET_ID')
  if (!budgetId) {
    return NextResponse.json(
      { error: 'YNAB_BUDGET_ID not configured' },
      { status: 500 },
    )
  }

  const accountId = getAccountForCurrency(config, senderInfo.accountId, parsed.currency)
  const testModeValue = await getSetting('TEST_MODE')
  const testMode = testModeValue === 'true' && !forceLive

  const memo = `${senderInfo.name}: ${parsed.description} - Automatically added from email`
  const accountName = await getAccountName(budgetId, accountId)

  // 5. If test mode (and not force-live), skip YNAB and log as test
  if (testMode) {
    await writeActivityLog({
      messageId: `replay-${messageId}-${Date.now()}`,
      status: 'test',
      sender: entry.sender ?? undefined,
      subject: `REPLAY: ${entry.subject ?? ''}`,
      rawBody: entry.rawBody,
      parseResult: parsed,
      ynabResult: {
        transactionId: '(test — not created)',
        amount: Math.round(parsed.amount * 1000) * -1,
        accountId,
        accountName,
        payeeName: parsed.retailer,
        memo,
        date: parsed.date,
      },
    })
    return NextResponse.json({
      success: true,
      testMode: true,
      parsed,
    })
  }

  // 6. Create YNAB transaction
  try {
    const transactionId = await createYnabTransaction({
      budgetId,
      accountId,
      amount: parsed.amount,
      description: parsed.description,
      senderName: senderInfo.name,
      payeeName: parsed.retailer,
      date: parsed.date,
    })

    // 7. Write activity log for replay
    await writeActivityLog({
      messageId: `replay-${messageId}-${Date.now()}`,
      status: 'success',
      sender: entry.sender ?? undefined,
      subject: `REPLAY: ${entry.subject ?? ''}`,
      rawBody: entry.rawBody,
      parseResult: parsed,
      ynabResult: {
        transactionId,
        amount: Math.round(parsed.amount * 1000) * -1,
        accountId,
        accountName,
        payeeName: parsed.retailer,
        memo,
        date: parsed.date,
      },
    })

    return NextResponse.json({
      success: true,
      transactionId,
      parsed,
    })
  } catch (e) {
    await writeActivityLog({
      messageId: `replay-${messageId}-${Date.now()}`,
      status: 'ynab_error',
      sender: entry.sender ?? undefined,
      subject: `REPLAY: ${entry.subject ?? ''}`,
      rawBody: entry.rawBody,
      parseResult: parsed,
      errorType: 'ynab_error',
      errorMessage: (e as Error).message,
    })
    return NextResponse.json(
      { error: `YNAB error: ${(e as Error).message}` },
      { status: 500 },
    )
  }
}
