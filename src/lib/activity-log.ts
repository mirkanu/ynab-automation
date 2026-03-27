import { prisma } from '@/lib/db';

export interface ActivityLogEntry {
  messageId: string;
  status: 'success' | 'parse_error' | 'ynab_error' | 'unknown_sender' | 'duplicate' | 'no_message_id';
  sender?: string;
  subject?: string;
  rawBody?: string;
  parseResult?: {
    retailer: string;
    amount: number;
    date: string;
    currency: string;
    description: string;
  };
  ynabResult?: {
    transactionId: string;
    amount: number;
    accountId: string;
    payeeName: string;
    date: string;
  };
  errorType?: string;
  errorMessage?: string;
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
        parseResult: entry.parseResult ?? undefined,
        ynabResult: entry.ynabResult ?? undefined,
        errorType: entry.errorType,
        errorMessage: entry.errorMessage,
      },
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}
