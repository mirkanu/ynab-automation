-- Add orderNumber column to ActivityLog for cross-email (confirmation + dispatch)
-- order-number-based deduplication. Nullable: not every email yields an order number.
ALTER TABLE "ActivityLog" ADD COLUMN "orderNumber" TEXT;
CREATE INDEX "ActivityLog_orderNumber_idx" ON "ActivityLog"("orderNumber");
