-- Migration: make userId NOT NULL on ActivityLog, Setting, ProcessedEmail
-- and restructure Setting PKs and unique constraints.
--
-- This migration follows a safe three-phase approach:
--   Phase 1: Backfill — ensure all existing rows have a userId
--   Phase 2: Schema changes — NOT NULL constraints, new PKs, indexes

-- ============================================================
-- PHASE 1: Backfill userId on all existing rows
-- ============================================================

-- Ensure the initial user (Manuel) exists.
-- If the user already exists (created by Auth.js on first login), this is a no-op.
INSERT INTO "User" ("id", "email", "name", "emailVerified", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'manuelkuhs@gmail.com',
  'Manuel',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE "email" = 'manuelkuhs@gmail.com'
);

-- Backfill ActivityLog rows with no userId
UPDATE "ActivityLog"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'manuelkuhs@gmail.com')
WHERE "userId" IS NULL;

-- Backfill ProcessedEmail rows with no userId
UPDATE "ProcessedEmail"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'manuelkuhs@gmail.com')
WHERE "userId" IS NULL;

-- Backfill Setting rows with no userId
UPDATE "Setting"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'manuelkuhs@gmail.com')
WHERE "userId" IS NULL;

-- ============================================================
-- PHASE 2: Schema changes
-- ============================================================

-- ---- ActivityLog ----
-- Make userId NOT NULL
ALTER TABLE "ActivityLog" ALTER COLUMN "userId" SET NOT NULL;

-- Add index on (userId, createdAt)
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- ---- Setting ----
-- The Setting table currently has: key TEXT PRIMARY KEY, userId TEXT (nullable)
-- We need to: add a cuid id column, drop old PK, make id the new PK,
-- make userId NOT NULL, add @@unique([userId, key])

-- Step 1: Add new id column
ALTER TABLE "Setting" ADD COLUMN "id" TEXT;

-- Step 2: Populate id with uuid-based values (Prisma will use cuids for new rows)
UPDATE "Setting" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- Step 3: Set id NOT NULL
ALTER TABLE "Setting" ALTER COLUMN "id" SET NOT NULL;

-- Step 4: Drop old primary key constraint (key was @id)
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey";

-- Step 5: Add new primary key on id
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id");

-- Step 6: Make userId NOT NULL
ALTER TABLE "Setting" ALTER COLUMN "userId" SET NOT NULL;

-- Step 7: Add @@unique([userId, key])
CREATE UNIQUE INDEX "Setting_userId_key_key" ON "Setting"("userId", "key");

-- ---- ProcessedEmail ----
-- Drop old messageId-only unique constraint
DROP INDEX IF EXISTS "ProcessedEmail_messageId_key";

-- Make userId NOT NULL
ALTER TABLE "ProcessedEmail" ALTER COLUMN "userId" SET NOT NULL;

-- Add @@unique([userId, messageId])
CREATE UNIQUE INDEX "ProcessedEmail_userId_messageId_key" ON "ProcessedEmail"("userId", "messageId");

-- Add index on (userId, processedAt)
CREATE INDEX "ProcessedEmail_userId_processedAt_idx" ON "ProcessedEmail"("userId", "processedAt");
