import { prisma } from '@/lib/db';

const INITIAL_USER_EMAIL = process.env.ADMIN_EMAIL ?? 'manuelkuhs@gmail.com';

/**
 * Look up the initial user's id by email.
 * Returns null if the user does not exist yet.
 */
async function getInitialUserId(): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: INITIAL_USER_EMAIL },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export interface ActivityLogEntry {
  messageId: string;
  status: 'success' | 'test' | 'parse_error' | 'ynab_error' | 'unknown_sender' | 'duplicate' | 'no_message_id';
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
    accountName?: string;
    payeeName: string;
    date: string;
    memo?: string;
    categoryId?: string | null;
    categoryName?: string | null;
  };
  errorType?: string;
  errorMessage?: string;
  /** Optional: explicit userId. Defaults to the initial user (temporary shim until Phase 19). */
  userId?: string;
}

export async function writeActivityLog(entry: ActivityLogEntry): Promise<void> {
  try {
    // Use provided userId or fall back to the initial user (Phase 16-19 shim)
    const userId = entry.userId ?? (await getInitialUserId());
    if (!userId) {
      console.error('writeActivityLog: no userId available — log entry dropped');
      return;
    }

    await prisma.activityLog.create({
      data: {
        userId,
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
