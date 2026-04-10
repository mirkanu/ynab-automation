-- PRE-MIGRATION SNAPSHOT
-- Captured: 2026-04-10T15:56:42Z
-- Purpose: Ground truth for post-migration verification (Phase 20-03 diff)

-- BACKUP FILE
-- Location: .planning/phases/20-schema-rollback-migration/pre-migration-backup.sql
-- Restore command (if migration fails):
--   railway run psql "$DATABASE_URL" < .planning/phases/20-schema-rollback-migration/pre-migration-backup.sql
-- WARNING: Restore will fail if tables already exist. Drop them first or use pg_restore with --clean.
-- Alternative restore (recommended):
--   railway run psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && railway run psql "$DATABASE_URL" < .planning/phases/20-schema-rollback-migration/pre-migration-backup.sql
-- NOTE: If railway run does not have internal network access, use the TCP proxy approach:
--   TCP proxy: mainline.proxy.rlwy.net:44022 (created during Plan 20-01)
--   PGPASSWORD="Y9x7KmqN2PvBwRjD8aHnCfEt" psql -h mainline.proxy.rlwy.net -p 44022 -U postgres -d railway -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
--   PGPASSWORD="Y9x7KmqN2PvBwRjD8aHnCfEt" psql -h mainline.proxy.rlwy.net -p 44022 -U postgres -d railway < .planning/phases/20-schema-rollback-migration/pre-migration-backup.sql

-- SETTING ROWS (pre-migration) — 7 rows
-- key | value
ADMIN_EMAIL|manuelkuhs@gmail.com
CURRENCY_ACCOUNTS|{"EUR":"f53855ba-ce7a-46bd-beae-cb8c1035a9e5"}
CURRENCY_RULES|[{"currency":"EUR","accountId":"f53855ba-ce7a-46bd-beae-cb8c1035a9e5","accountName":"€Wise Euro"}]
INBOUND_EMAIL|empk1lk0u08wjyn@upload.pipedream.net
SENDER_RULES|[{"email":"manuelkuhs@gmail.com","name":"Manuel","accountId":"6f470dd5-67e4-4580-82ee-74154cd26f3c","accountName":"Wise (GBP)","budgetId":"ed4cf96d-aa98-4ff9-bb59-f0ae967aa6af"},{"email":"kuhs.emilykate@gmail.com","name":"Emily-Kate","accountId":"5bfba3fe-b8d4-41e1-8acb-c10459c99534","accountName":"UK Current","budgetId":"ed4cf96d-aa98-4ff9-bb59-f0ae967aa6af"}]
SENDERS|[{"email":"manuelkuhs@gmail.com","name":"Manuel","accountId":"6f470dd5-67e4-4580-82ee-74154cd26f3c"},{"email":"kuhs.emilykate@gmail.com","name":"Emily-Kate","accountId":"5bfba3fe-b8d4-41e1-8acb-c10459c99534"}]
TEST_MODE|false
YNAB_BUDGET_ID|ed4cf96d-aa98-4ff9-bb59-f0ae967aa6af

-- ACTIVITYLOG ROW COUNT: 23
-- PROCESSEDEMAIL ROW COUNT: 23

-- VERIFICATION QUERIES (run post-migration to diff):
-- SELECT key, value FROM "Setting" ORDER BY key;
-- SELECT COUNT(*) FROM "ActivityLog";
-- SELECT COUNT(*) FROM "ProcessedEmail";
