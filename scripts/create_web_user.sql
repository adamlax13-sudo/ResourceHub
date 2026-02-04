-- PostgreSQL Least Privilege: Restricted role for the web application
--
-- Usage:
--   psql $DATABASE_URL -f scripts/create_web_user.sql
--
-- After running, update your web app's DATABASE_URL to use the new role:
--   postgresql://web_user:<password>@<host>:<port>/recovery_hub
--
-- The scraper should continue using the original admin/owner connection string
-- since it needs full INSERT/UPDATE/DELETE on the services table.

-- 1. Create the restricted role (change the password!)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_user') THEN
    CREATE ROLE web_user WITH LOGIN PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';
  END IF;
END
$$;

-- 2. Revoke all default privileges on the database
REVOKE ALL ON DATABASE recovery_hub FROM web_user;
GRANT CONNECT ON DATABASE recovery_hub TO web_user;

-- 3. Grant schema usage
GRANT USAGE ON SCHEMA public TO web_user;

-- 4. Services table: read-only (the web app never writes services)
GRANT SELECT ON services TO web_user;

-- 5. Searches table: read + insert (the web app caches search results)
GRANT SELECT, INSERT ON searches TO web_user;
GRANT USAGE, SELECT ON SEQUENCE searches_id_seq TO web_user;

-- 6. Feedback table: read + insert (the web app accepts feedback submissions)
GRANT SELECT, INSERT ON feedback TO web_user;
GRANT USAGE, SELECT ON SEQUENCE feedback_id_seq TO web_user;

-- 7. AI enrichments table: read + insert + update (the web app upserts enrichments)
GRANT SELECT, INSERT, UPDATE ON ai_service_enrichments TO web_user;
GRANT USAGE, SELECT ON SEQUENCE ai_service_enrichments_id_seq TO web_user;

-- 8. Prevent web_user from creating new tables or modifying schema
REVOKE CREATE ON SCHEMA public FROM web_user;
