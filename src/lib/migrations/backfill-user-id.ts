// This migration script is from the v5 multi-tenant era.
// It references prisma.user which no longer exists after Phase 20 schema rollback.
// Kept as a no-op stub to preserve git history. Safe to delete in Phase 24 cleanup.
export async function backfillUserId(_manuelEmail: string) {
  console.warn('backfillUserId: no-op stub — this migration has already been applied')
}
