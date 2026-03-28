import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseOrderEmail } from '@/lib/claude';
import { createYnabTransaction } from '@/lib/ynab';
import { loadConfig, getSenderByEmail, getAccountForCurrency } from '@/lib/config';
import { writeActivityLog } from '@/lib/activity-log';

export async function POST(req: NextRequest) {
  const { messageId } = (await req.json()) as { messageId: string };
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
  }

  // 1. Fetch original log entry
  const entry = await prisma.activityLog.findUnique({ where: { messageId } });
  if (!entry) {
    return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
  }
  if (!entry.rawBody) {
    return NextResponse.json(
      { error: 'Email body not available for this entry' },
      { status: 422 },
    );
  }

  // 2. Resolve sender
  const config = loadConfig();
  const senderInfo = entry.sender ? getSenderByEmail(config, entry.sender) : null;
  if (!senderInfo) {
    return NextResponse.json(
      { error: 'Sender not found in current config' },
      { status: 422 },
    );
  }

  // 3. Parse email
  const parsed = await parseOrderEmail(entry.rawBody, senderInfo.name);
  if (!parsed) {
    await writeActivityLog({
      messageId: `replay-${messageId}-${Date.now()}`,
      status: 'parse_error',
      sender: entry.sender ?? undefined,
      subject: `REPLAY: ${entry.subject ?? ''}`,
      rawBody: entry.rawBody,
      errorType: 'parse_error',
      errorMessage: 'Claude could not re-parse this email',
    });
    return NextResponse.json(
      { error: 'Claude could not parse this email' },
      { status: 422 },
    );
  }

  // 4. Resolve YNAB budget
  const budgetId = process.env.YNAB_BUDGET_ID;
  if (!budgetId) {
    return NextResponse.json(
      { error: 'YNAB_BUDGET_ID not configured' },
      { status: 500 },
    );
  }

  const accountId = getAccountForCurrency(config, senderInfo.accountId, parsed.currency);

  // 5. Create YNAB transaction
  try {
    const transactionId = await createYnabTransaction({
      budgetId,
      accountId,
      amount: parsed.amount,
      description: parsed.description,
      senderName: senderInfo.name,
      payeeName: parsed.retailer,
      date: parsed.date,
    });

    // 6. Write activity log for replay
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
        payeeName: parsed.retailer,
        date: parsed.date,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId,
      parsed,
    });
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
    });
    return NextResponse.json(
      { error: `YNAB error: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
