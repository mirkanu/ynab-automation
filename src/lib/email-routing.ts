// Phase 18 dead code — this module was used by the multi-tenant Postmark forwarding system.
// The active email ingestion path is /api/webhook (Pipedream), not /api/email/inbound.
// Phase 22 will delete this file along with the Postmark inbound route.

/**
 * @deprecated Dead code from Phase 18. Phase 22 will delete this file.
 */
export function verifyPostmarkIp(_ip: string | null): boolean {
  throw new Error('verifyPostmarkIp: dead code — Phase 22 will delete this')
}

/**
 * @deprecated Dead code from Phase 18. Phase 22 will delete this file.
 */
export async function getUserFromForwardingAddress(_toAddress: string): Promise<string | null> {
  throw new Error('getUserFromForwardingAddress: dead code — Phase 22 will delete this')
}
