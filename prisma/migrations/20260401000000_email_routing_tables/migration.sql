-- CreateTable: EmailForwardingAddress — maps mailboxHash to userId for per-user email routing
CREATE TABLE "EmailForwardingAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailForwardingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProcessedWebhook — idempotency dedup log; prevents duplicate YNAB transactions
CREATE TABLE "ProcessedWebhook" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique mailboxHash globally (one hash maps to exactly one user)
CREATE UNIQUE INDEX "EmailForwardingAddress_mailboxHash_key" ON "EmailForwardingAddress"("mailboxHash");

-- CreateIndex: composite unique for (userId, mailboxHash)
CREATE UNIQUE INDEX "EmailForwardingAddress_userId_mailboxHash_key" ON "EmailForwardingAddress"("userId", "mailboxHash");

-- CreateIndex: userId for fast lookups per user
CREATE INDEX "EmailForwardingAddress_userId_idx" ON "EmailForwardingAddress"("userId");

-- CreateIndex: CRITICAL — atomic idempotency guard; prevents duplicate webhook processing
CREATE UNIQUE INDEX "ProcessedWebhook_provider_providerId_key" ON "ProcessedWebhook"("provider", "providerId");

-- CreateIndex: userId + createdAt for per-user webhook history queries
CREATE INDEX "ProcessedWebhook_userId_createdAt_idx" ON "ProcessedWebhook"("userId", "createdAt");

-- AddForeignKey: EmailForwardingAddress.userId -> User.id (CASCADE delete)
ALTER TABLE "EmailForwardingAddress" ADD CONSTRAINT "EmailForwardingAddress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProcessedWebhook.userId -> User.id (CASCADE delete)
ALTER TABLE "ProcessedWebhook" ADD CONSTRAINT "ProcessedWebhook_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security on new tables (matching Phase 16-03 pattern)
ALTER TABLE "EmailForwardingAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailForwardingAddress" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON "EmailForwardingAddress"
  USING ("userId" = current_setting('app.user_id', true));

ALTER TABLE "ProcessedWebhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedWebhook" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON "ProcessedWebhook"
  USING ("userId" = current_setting('app.user_id', true));
