import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  extractMessageId,
  extractOriginalSender,
  extractOriginalRecipient,
  extractCategoryHint,
  extractOrderNumber,
} from '@/lib/email';
import { parseOrderEmail } from '@/lib/claude';
import { createYnabTransaction, getCategories, findCategory, getAccountName, formatMemo } from '@/lib/ynab';
import { sendErrorNotification } from '@/lib/notify';
import { loadConfig, getSenderByEmail, getAccountForCurrency, notificationSuffix } from '@/lib/config';
import { writeActivityLog } from '@/lib/activity-log';
import { getSetting } from '@/lib/settings';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  try {
    const config = loadConfig();
    const body = await req.json();
    const subject = body?.trigger?.event?.headers?.subject ?? null;
    const html = body?.trigger?.event?.body?.html ?? '';
    const text = body?.trigger?.event?.body?.text ?? '';
    const rawUrl = body?.trigger?.event?.rawUrl ?? '';

    // Debug logging for Gmail forwarding emails
    if (html === '' && text === '' && rawUrl === '') {
      console.warn('Email has no html, text, or rawUrl:', { messageId: extractMessageId(body), subject });
    }

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
    // DB rules (configured via /rules UI) take precedence over env-var config
    const [senderRulesRaw, currencyRulesRaw] = await Promise.all([
      getSetting('SENDER_RULES'),
      getSetting('CURRENCY_RULES'),
    ]);
    const dbSenderRules: Array<{ email: string; name: string; accountId: string }> =
      senderRulesRaw ? (JSON.parse(senderRulesRaw) as Array<{ email: string; name: string; accountId: string }>) : [];
    const dbCurrencyRules: Array<{ currency: string; accountId: string }> =
      currencyRulesRaw ? (JSON.parse(currencyRulesRaw) as Array<{ currency: string; accountId: string }>) : [];

    // Try to match 'from' header first (manual forwards)
    let dbSenderMatch = dbSenderRules.find(r => r.email.toLowerCase() === senderKey);
    let envSenderInfo = getSenderByEmail(config, senderKey);
    let senderInfo = dbSenderMatch
      ? { ...dbSenderMatch, name: dbSenderMatch.name || envSenderInfo?.name || '' }
      : envSenderInfo;

    // If no match on 'from', try 'to' header (Gmail auto-forwards)
    if (!senderInfo) {
      const recipient = extractOriginalRecipient(body);
      const recipientKey = (recipient ?? '').toLowerCase();
      if (recipientKey) {
        console.log('No sender match on from header, trying to header:', recipientKey);
        dbSenderMatch = dbSenderRules.find(r => r.email.toLowerCase() === recipientKey);
        envSenderInfo = getSenderByEmail(config, recipientKey);
        senderInfo = dbSenderMatch
          ? { ...dbSenderMatch, name: dbSenderMatch.name || envSenderInfo?.name || '' }
          : envSenderInfo;
        if (senderInfo) {
          console.log('Matched recipient to sender config:', recipientKey, '→', senderInfo.name);
        }
      }
    }

    if (!senderInfo) {
      console.warn('Unrecognised sender — no YNAB transaction created:', sender);
      console.log('Email body fields:', {
        html: !!html,
        text: !!text,
        rawUrl: !!rawUrl,
        htmlUrl: !!body?.trigger?.event?.body?.htmlUrl
      });

      // Include available content in notification
      const contentForNotification = html || text;
      const notificationHtml = contentForNotification ? `
Original email content:
<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;">
${contentForNotification}
</pre>
` : rawUrl ? `<a href="${rawUrl}">View raw email</a>` : '';

      await sendErrorNotification({
        to: config.adminEmail,
        subject: 'YNAB automation: unknown sender',
        body:
          `An order confirmation email was forwarded from an unrecognised email address and could not be processed.\n\n` +
          `Sender: ${sender ?? 'unknown'}\n` +
          `Message ID: ${messageId}\n\n` +
          `Add this sender to the automation if needed.`,
        html: html || notificationHtml,
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
    const categoryHint = extractCategoryHint(html);
    const parsed = await parseOrderEmail(html, senderInfo.name);
    if (!parsed) {
      console.error('Claude parsing failed for messageId:', messageId);
      const appUrl = process.env.YNAB_APP_URL ?? '';
      await sendErrorNotification({
        to: config.adminEmail,
        subject: `YNAB automation: failed to parse order email${notificationSuffix(senderInfo)}`,
        body:
          `An order confirmation email forwarded by ${sender ?? 'unknown'} could not be parsed automatically. No YNAB transaction was created.\n\n` +
          `Error: Claude failed to extract order details from the email body.\n\n` +
          `Message ID: ${messageId}\n\n` +
          `View in log: ${appUrl}/logs\n\n` +
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

    // Step 6a: Reject unusable amounts (e.g. shipping/dispatch emails with no price shown,
    // which Claude may extract as amount: 0). Zero and NaN both pass `typeof === 'number'`
    // in parseOrderEmail's validation, so this guard catches what that check misses.
    if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
      console.warn('Rejected parsed order — invalid amount:', parsed.amount, 'messageId:', messageId);
      const appUrl = process.env.YNAB_APP_URL ?? '';
      await sendErrorNotification({
        to: config.adminEmail,
        subject: `YNAB automation: no valid amount found${notificationSuffix(senderInfo)}`,
        body:
          `An order confirmation email forwarded by ${senderInfo.name} was parsed, but no valid ` +
          `amount could be extracted (parsed amount: ${parsed.amount}). No YNAB transaction was created.\n\n` +
          `Description: ${parsed.description}\n` +
          `Retailer: ${parsed.retailer}\n` +
          `Forwarded by: ${senderInfo.name}\n\n` +
          `This usually means the email was a shipping/dispatch notice rather than a purchase ` +
          `receipt, and had no price shown. Please check the original email and add the ` +
          `transaction to YNAB manually if needed.\n\n` +
          `Message ID: ${messageId}\n` +
          `View in log: ${appUrl}/logs`,
      });
      await writeActivityLog({
        messageId,
        status: 'invalid_amount',
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
        errorType: 'invalid_amount',
        errorMessage: `Parsed amount ${parsed.amount} is not usable (<= 0 or NaN)`,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Step 6c: Order-number-based dedup — catches cross-email duplicates (e.g. confirmation
    // + dispatch emails for the same order) that Step 2's messageId dedup cannot catch, since
    // those emails have different Message-IDs. Only matches against a prior 'success' row, so
    // a forged/coincidental order-number match against a failed/duplicate row can never block
    // a legitimate transaction.
    const orderNumber = extractOrderNumber(html) ?? undefined;
    if (orderNumber) {
      const priorSuccess = await prisma.activityLog.findFirst({
        where: { orderNumber, status: 'success' },
      });
      if (priorSuccess) {
        console.log('Duplicate order skipped (order-number match):', orderNumber, 'messageId:', messageId);
        await writeActivityLog({
          messageId,
          status: 'duplicate_order',
          sender: sender ?? undefined,
          subject: subject ?? undefined,
          rawBody: html || undefined,
          orderNumber,
          parseResult: {
            retailer: parsed.retailer,
            amount: parsed.amount,
            date: parsed.date,
            currency: parsed.currency,
            description: parsed.description,
          },
        });
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }

    // Step 6b: Resolve category hint to YNAB category ID (if hint was present)
    const budgetId = (await getSetting('YNAB_BUDGET_ID')) ?? '';
    let categoryId: string | undefined;
    let categoryName: string | undefined;
    if (categoryHint) {
      try {
        const categories = await getCategories(budgetId);
        const matched = findCategory(categories, categoryHint);
        if (matched) {
          categoryId = matched.id;
          categoryName = matched.name;
        }
      } catch (err) {
        console.error('getCategories failed, continuing without category:', err);
      }
    }

    // Step 7: Create YNAB transaction (or skip in test mode)
    const dbCurrencyMatch = dbCurrencyRules.find(r => r.currency.toUpperCase() === parsed.currency.toUpperCase());
    const accountId = dbCurrencyMatch?.accountId ?? getAccountForCurrency(config, senderInfo.accountId, parsed.currency);
    // Read test mode from the DB setting (set via settings UI).
    const testModeValue = await getSetting('TEST_MODE');
    const testMode = testModeValue === 'true';

    const memo = formatMemo(senderInfo.name, parsed.description, parsed.customNote);
    const accountName = await getAccountName(budgetId, accountId);

    if (testMode) {
      console.log('TEST MODE — skipping YNAB transaction for', senderInfo.name);
      await writeActivityLog({
        messageId,
        status: 'test',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: html || undefined,
        orderNumber,
        parseResult: {
          retailer: parsed.retailer,
          amount: parsed.amount,
          date: parsed.date,
          currency: parsed.currency,
          description: parsed.description,
        },
        ynabResult: {
          transactionId: '(test — not created)',
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
        customNote: parsed.customNote,
      });
      console.log('YNAB transaction created:', transactionId, 'for', senderInfo.name);
      await writeActivityLog({
        messageId,
        status: 'success',
        sender: sender ?? undefined,
        subject: subject ?? undefined,
        rawBody: html || undefined,
        orderNumber,
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
