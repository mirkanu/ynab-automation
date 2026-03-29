-- Enable Row-Level Security on scoped tables
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedEmail" ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID from session variable
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.user_id', TRUE), '')
$$ LANGUAGE SQL SECURITY DEFINER;

-- ActivityLog: users see only their own rows
CREATE POLICY activity_log_user_isolation ON "ActivityLog"
  USING ("userId" = current_app_user_id());

-- Setting: users see only their own settings
CREATE POLICY setting_user_isolation ON "Setting"
  USING ("userId" = current_app_user_id());

-- ProcessedEmail: users see only their own records
CREATE POLICY processed_email_user_isolation ON "ProcessedEmail"
  USING ("userId" = current_app_user_id());

-- IMPORTANT: Prisma runs as the database owner/superuser by default.
-- Superusers bypass RLS unless FORCE ROW LEVEL SECURITY is set.
-- Add FORCE RLS so even the app DB role cannot bypass:
ALTER TABLE "ActivityLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Setting" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedEmail" FORCE ROW LEVEL SECURITY;
