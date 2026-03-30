import { createHash } from 'crypto';
import { prisma } from '@/lib/db';

const INBOUND_DOMAIN = process.env.POSTMARK_INBOUND_DOMAIN ?? 'inbound.postmarkapp.com';

/**
 * Generates a unique, non-reversible mailbox hash for a user.
 * Format: user_{userId[0..8]}_{sha256(userId)[0..16]}
 * The hash embeds a partial userId prefix for debugging but is NOT reversible
 * — the full userId is never present in the email address.
 */
export function generateMailboxHash(userId: string): string {
  const hash = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return `user_${userId.slice(0, 8)}_${hash}`;
}

/**
 * Assigns a unique Postmark forwarding address to a user.
 * Creates an EmailForwardingAddress record and sets User.forwardingEmail.
 * Safe to call multiple times — skips if address already assigned.
 */
export async function assignForwardingAddress(userId: string): Promise<string> {
  // Check if already assigned
  const existing = await prisma.emailForwardingAddress.findFirst({
    where: { userId },
    select: { email: true },
  });
  if (existing) return existing.email;

  const mailboxHash = generateMailboxHash(userId);
  const forwardingEmail = `${mailboxHash}@${INBOUND_DOMAIN}`;

  await prisma.$transaction([
    prisma.emailForwardingAddress.create({
      data: { userId, mailboxHash, email: forwardingEmail },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { forwardingEmail },
    }),
  ]);

  return forwardingEmail;
}
