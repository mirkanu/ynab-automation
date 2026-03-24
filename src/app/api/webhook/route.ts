import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  extractMessageId,
  extractOriginalSender,
  isFromAmazon,
} from '@/lib/email';
import { parseAmazonEmail } from '@/lib/claude';
import { createYnabTransaction } from '@/lib/ynab';
import { sendErrorNotification, MANUEL_EMAIL } from '@/lib/notify';

const prisma = new PrismaClient();

/** Returns a subject prefix identifying the sender when it's Emily-Kate. */
function senderLabel(senderKey: string): string {
  return senderKey === 'manuelkuhs@gmail.com' ? '' : ' (Emily-Kate)';
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  try {
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

    // Step 3: Extract sender early (needed for notifications before Amazon check)
    const sender = extractOriginalSender(body);
    const senderKey = (sender ?? '').toLowerCase();

    // Step 4: Filter non-Amazon emails — notify sender
    if (!isFromAmazon(body)) {
      console.log('Non-Amazon email ignored:', messageId, 'from:', sender);
      if (sender) {
        await sendErrorNotification({
          to: MANUEL_EMAIL,
          subject: `YNAB automation: email was not from Amazon${senderLabel(senderKey)}`,
          body:
            `An email forwarded by ${sender} could not be processed because it did not appear to be an Amazon order confirmation.\n\n` +
            `Message ID: ${messageId}\n\n` +
            `If this was meant to be an Amazon order, please forward it again.`,
        });
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 5: Record as processed
    console.log('Processing Amazon email from:', sender, 'messageId:', messageId);
    console.log('Step 5: writing ProcessedEmail record');
    try {
      await prisma.processedEmail.create({
        data: { messageId, sender: sender ?? 'unknown' },
      });
      console.log('Step 5: done');
    } catch (dbErr) {
      console.error('Step 5 DB error:', dbErr);
      throw dbErr;
    }

    // Step 6: Resolve sender to display name and YNAB account ID
    console.log('Step 6: resolving sender');
    const SENDER_MAP: Record<string, { name: string; accountId: string }> = {
      'manuelkuhs@gmail.com': {
        name: 'Manuel',
        accountId: process.env.YNAB_MANUEL_ACCOUNT_ID ?? '',
      },
      [process.env.EMILY_KATE_EMAIL ?? '']: {
        name: 'Emily-Kate',
        accountId: process.env.YNAB_EMILY_ACCOUNT_ID ?? '',
      },
    };

    const senderInfo = SENDER_MAP[senderKey];
    console.log('Step 6: senderKey:', senderKey, 'found:', !!senderInfo);
    if (!senderInfo) {
      console.warn('Unrecognised sender — no YNAB transaction created:', sender);
      await sendErrorNotification({
        to: MANUEL_EMAIL,
        subject: 'YNAB automation: unknown sender',
        body:
          `An Amazon order email was forwarded from an unrecognised email address and could not be processed.\n\n` +
          `Sender: ${sender ?? 'unknown'}\n` +
          `Message ID: ${messageId}\n\n` +
          `Add this sender to the automation if needed.`,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 7: Extract HTML body and parse with Claude
    const html = body?.trigger?.event?.body?.html ?? '';
    console.log('Step 7: calling Claude, html length:', html.length);
    const parsed = await parseAmazonEmail(html, senderInfo.name);
    console.log('Step 7: Claude result:', parsed);
    if (!parsed) {
      console.error('Step 7: Claude parsing failed for messageId:', messageId);
      await sendErrorNotification({
        to: MANUEL_EMAIL,
        subject: `YNAB automation: failed to parse Amazon email${senderLabel(senderKey)}`,
        body:
          `An Amazon order email forwarded by ${sender ?? 'unknown'} could not be parsed automatically. No YNAB transaction was created.\n\n` +
          `Message ID: ${messageId}\n\n` +
          `Please add this transaction to YNAB manually.`,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 8: Create YNAB transaction
    console.log('Step 8: creating YNAB transaction');
    const budgetId = process.env.YNAB_BUDGET_ID ?? '';
    try {
      const transactionId = await createYnabTransaction({
        budgetId,
        accountId: senderInfo.accountId,
        amount: parsed.amount,
        description: parsed.description,
        senderName: senderInfo.name,
      });
      console.log('Step 8: YNAB transaction created:', transactionId, 'for', senderInfo.name);
      return NextResponse.json({ received: true, transactionId }, { status: 200 });
    } catch (ynabErr) {
      console.error('Step 8: YNAB API error:', ynabErr);
      await sendErrorNotification({
        to: MANUEL_EMAIL,
        subject: `YNAB automation: failed to create transaction${senderLabel(senderKey)}`,
        body:
          `An Amazon order email forwarded by ${sender ?? 'unknown'} was parsed but the YNAB transaction could not be created.\n\n` +
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
