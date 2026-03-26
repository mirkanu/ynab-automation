import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  extractMessageId,
  extractOriginalSender,
  extractCategoryHint,
} from '@/lib/email';
import { parseOrderEmail } from '@/lib/claude';
import { createYnabTransaction, getCategories, findCategory } from '@/lib/ynab';
import { sendErrorNotification } from '@/lib/notify';
import { loadConfig, getSenderByEmail, getAccountForCurrency, notificationSuffix } from '@/lib/config';

const prisma = new PrismaClient();

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  try {
    const config = loadConfig();
    const body = await req.json();

    // Step 1: Extract message ID
    const messageId = extractMessageId(body);
    if (!messageId) {
      console.warn('Webhook received email with no message ID — skipping');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 2: Deduplicate
    const existing = await prisma.processedEmail.findUnique({
      where: { messageId },
    });
    if (existing) {
      console.log('Duplicate email skipped:', messageId);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 3: Extract sender early (needed for notifications)
    const sender = extractOriginalSender(body);
    const senderKey = (sender ?? '').toLowerCase();

    // Step 4: Record as processed
    console.log('Processing order email from:', sender, 'messageId:', messageId);
    console.log('Step 4: writing ProcessedEmail record');
    try {
      await prisma.processedEmail.create({
        data: { messageId, sender: sender ?? 'unknown' },
      });
      console.log('Step 4: done');
    } catch (dbErr) {
      console.error('Step 4 DB error:', dbErr);
      throw dbErr;
    }

    // Step 5: Resolve sender to display name and YNAB account ID
    console.log('Step 5: resolving sender');
    const senderInfo = getSenderByEmail(config, senderKey);
    console.log('Step 5: senderKey:', senderKey, 'found:', !!senderInfo);
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
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 6: Extract HTML body and parse with Claude
    const html = body?.trigger?.event?.body?.html ?? '';
    const categoryHint = extractCategoryHint(html);
    console.log('Step 6: calling Claude, html length:', html.length);
    const parsed = await parseOrderEmail(html, senderInfo.name);
    console.log('Step 6: Claude result:', parsed);
    if (!parsed) {
      console.error('Step 6: Claude parsing failed for messageId:', messageId);
      await sendErrorNotification({
        to: config.adminEmail,
        subject: `YNAB automation: failed to parse order email${notificationSuffix(senderInfo)}`,
        body:
          `An order confirmation email forwarded by ${sender ?? 'unknown'} could not be parsed automatically. No YNAB transaction was created.\n\n` +
          `Message ID: ${messageId}\n\n` +
          `Please add this transaction to YNAB manually.`,
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
          console.log('Step 6b: matched category:', matched.name, matched.id);
        } else {
          console.log('Step 6b: no category match for hint:', categoryHint);
        }
      } catch (err) {
        // Non-fatal: log and continue without category
        console.error('Step 6b: getCategories failed, continuing without category:', err);
      }
    }

    // Step 7: Create YNAB transaction
    console.log('Step 7: creating YNAB transaction');
    const accountId = getAccountForCurrency(config, senderInfo.accountId, parsed.currency);
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
      console.log('Step 7: YNAB transaction created:', transactionId, 'for', senderInfo.name);
      return NextResponse.json({ received: true, transactionId }, { status: 200 });
    } catch (ynabErr) {
      console.error('Step 7: YNAB API error:', ynabErr);
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
      return NextResponse.json({ received: true }, { status: 200 });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
