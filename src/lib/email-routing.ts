import { prisma } from '@/lib/db';

/**
 * Verifies that the request IP is in the Postmark IP allowlist.
 * POSTMARK_IPS env var: comma-separated list of allowed IPs.
 * Reference: https://postmarkapp.com/developer/user-guide/inbound/parse-an-email
 */
export function verifyPostmarkIp(ip: string | null): boolean {
  if (!ip) return false;
  const allowlist = process.env.POSTMARK_IPS;
  if (!allowlist) return false;
  return allowlist.split(',').map(s => s.trim()).includes(ip);
}

/**
 * Maps a Postmark To address to a userId via EmailForwardingAddress lookup.
 * Extracts mailboxHash from the local part of the email address.
 * Returns userId if found, null if unknown address.
 */
export async function getUserFromForwardingAddress(toAddress: string): Promise<string | null> {
  if (!toAddress || !toAddress.includes('@')) return null;
  const [localPart] = toAddress.split('@');
  if (!localPart) return null;

  const forwarding = await prisma.emailForwardingAddress.findUnique({
    where: { mailboxHash: localPart },
    select: { userId: true },
  });

  return forwarding?.userId ?? null;
}
