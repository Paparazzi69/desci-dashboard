-- Drop every table introduced by migrations 0001-0003.
--
-- Context: the news aggregator, Elfa AI sentiment pipeline, and smart-account
-- roster were all removed in the cleanup that retires /feed, /admin,
-- /sentiment, and /kols. After this migration runs, the desci-news D1
-- database has zero project tables and can be deleted from the Cloudflare
-- dashboard (or left empty).
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=migrations/0006_drop_all_tables.sql
--
-- If the wrangler.toml D1 binding has already been removed when you run this,
-- re-add it temporarily (or run via the dashboard's D1 console).
--
-- Note: 0005_peptides.sql is intentionally not touched here. It was staged
-- but never applied, per project history.

DROP TABLE IF EXISTS news_items;
DROP TABLE IF EXISTS failed_sources;

DROP TABLE IF EXISTS elfa_credit_log;
DROP TABLE IF EXISTS elfa_token_snapshots;
DROP TABLE IF EXISTS elfa_health_log;

DROP TABLE IF EXISTS smart_accounts;
DROP TABLE IF EXISTS roster_run_log;
