import { NextRequest, NextResponse } from 'next/server';
import { prisma, getPrismaForUser } from '@/lib/db';
import { parseOrderEmail } from '@/lib/claude';
import { createYnabTransaction, getCategories, findCategory, getAccountName } from '@/lib/ynab';
import { loadConfig, getSenderByEmail, getAccountForCurrency } from '@/lib/config';
import { loadDbSettings } from '@/lib/settings';
import { writeActivityLog } from '@/lib/activity-log';
import { extractCategoryHint } from '@/lib/email';
import { verifyPostmarkIp, getUserFromForwardingAddress } from '@/lib/email-routing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify request originates from Postmark
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('cf-connecting-ip')
      ?? null;

    if (!verifyPostmarkIp(clientIp)) {
      console.warn('Rejected inbound webhook from unauthorized IP:', clientIp);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const providerId: string = body.MessageID;

    if (!providerId) {
      return NextResponse.json({ status: 'missing_message_id' }, { status: 200 });
    }

    // Step 2: Idempotency — check for duplicate delivery (global prisma OK: userId not yet known)
    const existing = await prisma.processedWebhook.findUnique({
      where: { provider_providerId: { provider: 'postmark', providerId } },
    });
    if (existing) {
      return NextResponse.json({ status: 'skipped', reason: 'already_processed' }, { status: 200 });
    }

    // Step 3: Extract userId from MailboxHash (To header local part)
    const toAddress: string = body.To ?? '';
    const userId = await getUserFromForwardingAddress(toAddress);

    if (!userId) {
      // Unknown address — use global prisma (no real userId to scope RLS to)
      await prisma.processedWebhook.create({
        data: { provider: 'postmark', providerId, userId: 'unknown', status: 'skipped' },
      });
      return NextResponse.json({ status: 'unknown_recipient' }, { status: 200 });
    }

    // From here on, userId is a real user — use getPrismaForUser(userId) for all writes
    // so that the RLS policy (app.user_id = userId) is satisfied on ProcessedWebhook inserts.
    const userPrisma = getPrismaForUser(userId);

    // Step 4: Verify user has connected YNAB account
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { oauthToken: true, selectedBudgetId: true, selectedAccountId: true },
    });

    if (!user?.oauthToken) {
      await userPrisma.processedWebhook.create({
        data: { provider: 'postmark', providerId, userId, status: 'skipped' },
      });
      return NextResponse.json({ status: 'no_ynab_account' }, { status: 200 });
    }

    // Step 5: Load config and parse email with Claude
    await loadDbSettings();
    const config = loadConfig();
    const html = body.HtmlBody ?? '';
    const sender = body.From ?? '';
    const subject = body.Subject ?? '';
    const senderKey = sender.toLowerCase();
    const senderInfo = getSenderByEmail(config, senderKey);

    if (!senderInfo) {
      await writeActivityLog({
        userId,
        messageId: providerId,
        status: 'unknown_sender',
        sender,
        subject,
        rawBody: html || undefined,
        errorType: 'unknown_sender',
        errorMessage: `No sender config found for: ${sender}`,
      });
      await userPrisma.processedWebhook.create({
        data: { provider: 'postmark', providerId, userId, status: 'skipped' },
      });
      return NextResponse.json({ status: 'unknown_sender' }, { status: 200 });
    }

    const categoryHint = extractCategoryHint(html);
    const parsed = await parseOrderEmail(html, senderInfo.name);

    if (!parsed) {
      await writeActivityLog({
        userId,
        messageId: providerId,
        status: 'parse_error',
        sender,
        subject,
        rawBody: html || undefined,
        errorType: 'parse_failed',
        errorMessage: `Claude failed to parse email from ${sender}`,
      });
      await userPrisma.processedWebhook.create({
        data: { provider: 'postmark', providerId, userId, status: 'error' },
      });
      return NextResponse.json({ status: 'parse_error' }, { status: 200 });
    }

    // Step 6: Resolve category and account
    const budgetId = user.selectedBudgetId ?? process.env.YNAB_BUDGET_ID ?? '';
    const accountId = getAccountForCurrency(config, senderInfo.accountId, parsed.currency);

    let categoryId: string | undefined;
    let categoryName: string | undefined;
    if (categoryHint) {
      try {
        const categories = await getCategories(userId, budgetId);
        const matched = findCategory(categories, categoryHint);
        if (matched) { categoryId = matched.id; categoryName = matched.name; }
      } catch (err) {
        console.error('getCategories failed, continuing without category:', err);
      }
    }

    const accountName = await getAccountName(userId, budgetId, accountId);

    // Step 7: Create YNAB transaction
    const memo = `${senderInfo.name}: ${parsed.description} - Automatically added from email`;
    const transactionId = await createYnabTransaction(userId, {
      budgetId,
      accountId,
      amount: parsed.amount,
      description: parsed.description,
      senderName: senderInfo.name,
      payeeName: parsed.retailer,
      date: parsed.date,
      categoryId,
    });

    // Step 8: Record as processed AFTER successful YNAB call (use userPrisma for RLS)
    await userPrisma.processedWebhook.create({
      data: { provider: 'postmark', providerId, userId, status: 'success' },
    });

    await writeActivityLog({
      userId,
      messageId: providerId,
      status: 'success',
      sender,
      subject,
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
        accountName,
        payeeName: parsed.retailer,
        memo,
        categoryId: categoryId ?? null,
        categoryName: categoryName ?? null,
        date: parsed.date,
      },
    });

    return NextResponse.json({ status: 'success', transactionId }, { status: 200 });

  } catch (error) {
    // P2002 = unique constraint violation = duplicate (race condition)
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ status: 'skipped', reason: 'race_condition' }, { status: 200 });
    }
    console.error('Inbound webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
