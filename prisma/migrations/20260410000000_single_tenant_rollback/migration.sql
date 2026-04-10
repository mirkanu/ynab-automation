-- Migration: single_tenant_rollback
-- Phase 20: Remove multi-tenant machinery from production DB
-- Preserves: ActivityLog rows, Setting rows, ProcessedEmail rows (data only, userId dropped)
-- Drops: User, Account, Session, VerificationToken, EmailForwardingAddress, ProcessedWebhook tables
-- Drops: userId columns from Setting, ActivityLog, ProcessedEmail
-- Drops: All RLS policies and FORCE RLS on all affected tables
-- Drops: current_app_user_id() helper function
-- Reconstructs: Setting PK as key-only; ProcessedEmail unique index as messageId-only
--
-- Constraint names verified against Railway DB on 2026-04-10 by Plan 20-02 Task 1:
--   Setting FK:               "Setting_userId_fkey"
--   ActivityLog FK:           "ActivityLog_userId_fkey"
--   ProcessedEmail FK:        "ProcessedEmail_userId_fkey"
--   Setting unique idx:       "Setting_userId_key_key"
--   Setting PK:               "Setting_pkey" (on id column, rebuilt on key)
--   ActivityLog composite:    "ActivityLog_userId_createdAt_idx"
--   ProcessedEmail unique:    "ProcessedEmail_userId_messageId_key"
--   ProcessedEmail idx:       "ProcessedEmail_userId_processedAt_idx"
--   EFA policy:               "user_isolation"
--   ProcessedWebhook policy:  "user_isolation"

-- ============================================================
-- STEP 1: Drop RLS policies on Phase 18 tables (before dropping tables)
-- ============================================================
DROP POLICY IF EXISTS user_isolation ON "EmailForwardingAddress";
DROP POLICY IF EXISTS user_isolation ON "ProcessedWebhook";

ALTER TABLE "EmailForwardingAddress" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmailForwardingAddress" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "ProcessedWebhook" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedWebhook" DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: Drop RLS policies on surviving tables
-- ============================================================
DROP POLICY IF EXISTS activity_log_user_isolation ON "ActivityLog";
DROP POLICY IF EXISTS setting_user_isolation ON "Setting";
DROP POLICY IF EXISTS processed_email_user_isolation ON "ProcessedEmail";

ALTER TABLE "ActivityLog" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "Setting" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Setting" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "ProcessedEmail" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedEmail" DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: Drop the RLS helper function
-- ============================================================
DROP FUNCTION IF EXISTS current_app_user_id();

-- ============================================================
-- STEP 4: Drop FK constraints from surviving tables (before dropping User)
-- ============================================================
ALTER TABLE "ActivityLog" DROP CONSTRAINT IF EXISTS "ActivityLog_userId_fkey";
ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_userId_fkey";
ALTER TABLE "ProcessedEmail" DROP CONSTRAINT IF EXISTS "ProcessedEmail_userId_fkey";

-- ============================================================
-- STEP 5: Drop the Phase 18 tables (CASCADE handles their FKs to User)
-- ============================================================
DROP TABLE IF EXISTS "EmailForwardingAddress" CASCADE;
DROP TABLE IF EXISTS "ProcessedWebhook" CASCADE;

-- ============================================================
-- STEP 6: Drop Auth.js tables (CASCADE handles Account, Session -> User)
-- ============================================================
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- ============================================================
-- STEP 7: Reconstruct Setting — drop composite unique/PK, drop userId column, add key-only PK
-- ============================================================

-- Drop the composite unique index (userId, key)
DROP INDEX IF EXISTS "Setting_userId_key_key";

-- Drop the old id-based primary key constraint
ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_pkey";

-- Drop userId column
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "userId";

-- Drop the now-unused id column (Setting will use key as PK, matching v4.0 single-tenant design)
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "id";

-- Add key as the primary key
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("key");

-- ============================================================
-- STEP 8: Reconstruct ActivityLog — drop userId index, drop userId column
-- ============================================================

-- Drop the (userId, createdAt) composite index
DROP INDEX IF EXISTS "ActivityLog_userId_createdAt_idx";

-- Drop userId column
ALTER TABLE "ActivityLog" DROP COLUMN IF EXISTS "userId";

-- ============================================================
-- STEP 9: Reconstruct ProcessedEmail — drop composite unique/index, drop userId column, add messageId-only unique
-- ============================================================

-- Drop the composite unique index (userId, messageId)
DROP INDEX IF EXISTS "ProcessedEmail_userId_messageId_key";

-- Drop the composite processedAt index (userId, processedAt)
DROP INDEX IF EXISTS "ProcessedEmail_userId_processedAt_idx";

-- Drop userId column
ALTER TABLE "ProcessedEmail" DROP COLUMN IF EXISTS "userId";

-- Add messageId-only unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedEmail_messageId_key" ON "ProcessedEmail"("messageId");
