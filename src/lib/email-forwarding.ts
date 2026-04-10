// Phase 18 dead code — this module was used by the multi-tenant Postmark forwarding system.
// The active email ingestion path is /api/webhook (Pipedream), not /api/email/inbound.
// Phase 22 will delete this file along with the Postmark inbound route.

/**
 * @deprecated Dead code from Phase 18. Phase 22 will delete this file.
 */
export function generateMailboxHash(_userId: string): string {
  throw new Error('generateMailboxHash: dead code — Phase 22 will delete this')
}

/**
 * @deprecated Dead code from Phase 18. Phase 22 will delete this file.
 */
export async function assignForwardingAddress(_userId: string): Promise<string> {
  throw new Error('assignForwardingAddress: dead code — Phase 22 will delete this')
}
