import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  extractMessageId,
  extractOriginalSender,
  isFromAmazon,
} from '@/lib/email';
import { parseAmazonEmail } from '@/lib/claude';
import { createYnabTransaction } from '@/lib/ynab';

const prisma = new PrismaClient();

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

    // Step 3: Filter non-Amazon emails
    if (!isFromAmazon(body)) {
      console.log('Non-Amazon email ignored:', messageId);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 4: Extract sender (forwarding user for YNAB routing)
    const sender = extractOriginalSender(body);
    console.log('Processing Amazon email from:', sender, 'messageId:', messageId);

    // Step 5: Record as processed
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

    const senderKey = (sender ?? '').toLowerCase();
    const senderInfo = SENDER_MAP[senderKey];
    console.log('Step 6: senderKey:', senderKey, 'found:', !!senderInfo);
    if (!senderInfo) {
      console.warn('Unrecognised sender — no YNAB transaction created:', sender);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 7: Extract HTML body and parse with Claude
    const html = body?.trigger?.event?.body?.html ?? '';
    console.log('Step 7: calling Claude, html length:', html.length);
    const parsed = await parseAmazonEmail(html, senderInfo.name);
    console.log('Step 7: Claude result:', parsed);
    if (!parsed) {
      console.error('Step 7: Claude parsing failed for messageId:', messageId);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 8: Create YNAB transaction
    console.log('Step 8: creating YNAB transaction');
    const budgetId = process.env.YNAB_BUDGET_ID ?? '';
    const transactionId = await createYnabTransaction({
      budgetId,
      accountId: senderInfo.accountId,
      amount: parsed.amount,
      description: parsed.description,
      senderName: senderInfo.name,
    });
    console.log('Step 8: YNAB transaction created:', transactionId, 'for', senderInfo.name);

    return NextResponse.json({ received: true, transactionId }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
