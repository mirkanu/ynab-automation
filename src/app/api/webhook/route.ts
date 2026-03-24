import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  extractMessageId,
  extractOriginalSender,
  isFromAmazon,
} from '@/lib/email';

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
    await prisma.processedEmail.create({
      data: { messageId, sender: sender ?? 'unknown' },
    });

    return NextResponse.json({ received: true, sender, messageId }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
