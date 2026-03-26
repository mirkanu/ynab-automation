import { Resend } from 'resend';

export interface NotificationOptions {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

/**
 * Sends an error notification email via Resend.
 * Fire-and-forget — never throws. Logs on failure.
 */
export async function sendErrorNotification(opts: NotificationOptions): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'YNAB Automation <onboarding@resend.dev>',
      to: opts.to,
      ...(opts.cc ? { cc: opts.cc } : {}),
      subject: opts.subject,
      text: opts.body,
    });
  } catch (err) {
    console.error('sendErrorNotification failed:', err);
  }
}
