-- Deferred retry state for LLM-provider quota exhaustion ('retry_pending' rows).
-- ownerName/ownerAccountId persist the RESOLVED owner (display name + default YNAB
-- account) because ActivityLog.sender holds the original retailer sender
-- (e.g. auto-confirm@amazon.co.uk) and the owner cannot be re-derived from rawBody.
ALTER TABLE "ActivityLog"
  ADD COLUMN "retryAt" TIMESTAMP(3),
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "ownerAccountId" TEXT;

CREATE INDEX "ActivityLog_status_retryAt_idx" ON "ActivityLog"("status", "retryAt");
