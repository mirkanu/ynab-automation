import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  extractMessageId,
  extractOriginalSender,
  extractCategoryHint,
} from '@/lib/email';
import { parseOrderEmail } from '@/lib/claude';
import { createYnabTransaction, getCategories, findCategory } from '@/lib/ynab';
import { sendErrorNotification } from '@/lib/notify';
import { loadConfig, getSenderByEmail, getAccountForCurrency, notificationSuffix } from '@/lib/config';
import { writeActivityLog } from '@/lib/activity-log';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  try {
    const config = loadConfig();
    const body = await req.json();
    const subject = body?.trigger?.event?.headers?.subject ?? null;

    // Step 1: Extract message ID
    const messageId = extractMessageId(body);
    if (!messageId) {
      console.warn('Webhook received email with no message ID — skipping');
      await writeActivityLog({
        messageId: `no-id-${Date.now()}`,
        status: 'no_message_id',
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 2: Deduplicate
    const existing = await prisma.processedEmail.findUnique({
      where: { messageId },
    });
    if (existing) {
      console.log('Duplicate email skipped:', messageId);
      await writeActivityLog({
        messageId,
        status: 'duplicate',
        sender: extractOriginalSender(body) ?? undefined,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 3: Extract sender early (needed for notifications)
    const sender = extractOriginalSender(body);
    const senderKey = (sender ?? '').toLowerCase();

    // Step 4: Record as processed
    console.log('Processing order email from:', sender, 'messageId:', messageId);
    try {
      await prisma.processedEmail.create({
        data: { messageId, sender: sender ?? 'unknown' },
      });
    } catch (dbErr) {
      console.error('Step 4 DB error:', dbErr);
      throw dbErr;
    }

    // Step 5: Resolve sender to display name and YNAB account ID
    const senderInfo = getSenderByEmail(config, senderKey);
    if (!senderInfo) {
      console.warn('Unrecognised sender — no YNAB transaction created:', sender);
      await sendErrorNotification({
        to: config.adminEmail,
        subject: 'YNAB automation: unknown sender',
        body:
          `An order confirmation email was forwarded from an unrecognised email address and could not be processed.\n\n` +
          `Sender: ${sender ?? 'unknown'}\n` +
          `Message ID: ${messageId}\n\n` +
          `Add this sender to the automation if needed.`,
      });
      await writeActivityLog({
        messageId,
        status: 'unknown_sender',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: body?.trigger?.event?.body?.html ?? undefined,
        errorType: 'unknown_sender',
        errorMessage: `No sender config found for: ${sender ?? 'unknown'}`,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 6: Extract HTML body and parse with Claude
    const html = body?.trigger?.event?.body?.html ?? '';
    const categoryHint = extractCategoryHint(html);
    const parsed = await parseOrderEmail(html, senderInfo.name);
    if (!parsed) {
      console.error('Claude parsing failed for messageId:', messageId);
      await sendErrorNotification({
        to: config.adminEmail,
        subject: `YNAB automation: failed to parse order email${notificationSuffix(senderInfo)}`,
        body:
          `An order confirmation email forwarded by ${sender ?? 'unknown'} could not be parsed automatically. No YNAB transaction was created.\n\n` +
          `Message ID: ${messageId}\n\n` +
          `Please add this transaction to YNAB manually.`,
      });
      await writeActivityLog({
        messageId,
        status: 'parse_error',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: html || undefined,
        errorType: 'parse_failed',
        errorMessage: `Claude failed to parse email from ${sender ?? 'unknown'}`,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 6b: Resolve category hint to YNAB category ID (if hint was present)
    const budgetId = process.env.YNAB_BUDGET_ID ?? '';
    let categoryId: string | undefined;
    if (categoryHint) {
      try {
        const categories = await getCategories(budgetId);
        const matched = findCategory(categories, categoryHint);
        if (matched) {
          categoryId = matched.id;
        }
      } catch (err) {
        console.error('getCategories failed, continuing without category:', err);
      }
    }

    // Step 7: Create YNAB transaction (or skip in test mode)
    const accountId = getAccountForCurrency(config, senderInfo.accountId, parsed.currency);
    const testMode = process.env.TEST_MODE === 'true';

    if (testMode) {
      console.log('TEST MODE — skipping YNAB transaction for', senderInfo.name);
      await writeActivityLog({
        messageId,
        status: 'test',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: html || undefined,
        parseResult: {
          retailer: parsed.retailer,
          amount: parsed.amount,
          date: parsed.date,
          currency: parsed.currency,
          description: parsed.description,
        },
      });
      return NextResponse.json({ received: true, testMode: true }, { status: 200 });
    }

    try {
      const transactionId = await createYnabTransaction({
        budgetId,
        accountId,
        amount: parsed.amount,
        description: parsed.description,
        senderName: senderInfo.name,
        payeeName: parsed.retailer,
        date: parsed.date,
        categoryId,
      });
      console.log('YNAB transaction created:', transactionId, 'for', senderInfo.name);
      await writeActivityLog({
        messageId,
        status: 'success',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: html || undefined,
        parseResult: {
          retailer: parsed.retailer,
          amount: parsed.amount,
          date: parsed.date,
          currency: parsed.currency,
          description: parsed.description,
        },
        ynabResult: {
          transactionId,
          amount: Math.round(parsed.amount * 1000) * -1,
          accountId,
          payeeName: parsed.retailer,
          date: parsed.date,
        },
      });
      return NextResponse.json({ received: true, transactionId }, { status: 200 });
    } catch (ynabErr) {
      console.error('YNAB API error:', ynabErr);
      await sendErrorNotification({
        to: config.adminEmail,
        subject: `YNAB automation: failed to create transaction${notificationSuffix(senderInfo)}`,
        body:
          `An order confirmation email forwarded by ${sender ?? 'unknown'} was parsed but the YNAB transaction could not be created.\n\n` +
          `Item: ${parsed.description}\n` +
          `Amount: £${parsed.amount.toFixed(2)}\n` +
          `Message ID: ${messageId}\n\n` +
          `Please add this transaction to YNAB manually.`,
      });
      await writeActivityLog({
        messageId,
        status: 'ynab_error',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: html || undefined,
        parseResult: {
          retailer: parsed.retailer,
          amount: parsed.amount,
          date: parsed.date,
          currency: parsed.currency,
          description: parsed.description,
        },
        errorType: 'ynab_api_error',
        errorMessage: ynabErr instanceof Error ? ynabErr.message : String(ynabErr),
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
