-- Run manually against production DB to add index for cache lookups.
-- Uses CONCURRENTLY to avoid locking the table during creation.
-- Execute: psql $DATABASE_URL -f scripts/add-searches-index.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS searches_query_idx ON searches (query);
