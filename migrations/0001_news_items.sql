-- DeSci news aggregation schema. Hourly cron writes pending items here;
-- approved/featured rows are served by /api/feed-v2.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=migrations/0001_news_items.sql
-- Re-running is idempotent (CREATE … IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS news_items (
  id               TEXT PRIMARY KEY,           -- SHA-256 hex of normalized URL
  source           TEXT NOT NULL,
  source_type      TEXT NOT NULL,              -- 'project' | 'media' | 'paper' | 'release'
  title            TEXT NOT NULL,
  title_normalized TEXT NOT NULL,              -- lowercased, alnum-only — fuzzy dedup key
  url              TEXT NOT NULL UNIQUE,
  summary          TEXT,
  take             TEXT DEFAULT NULL,          -- editorial commentary, set at approve/feature time
  author           TEXT,
  category         TEXT,
  published_at     INTEGER NOT NULL,           -- unix seconds, UTC
  fetched_at       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'  -- pending | approved | rejected | featured
);

CREATE INDEX IF NOT EXISTS idx_status_published   ON news_items(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_source             ON news_items(source);
CREATE INDEX IF NOT EXISTS idx_category           ON news_items(category);
CREATE INDEX IF NOT EXISTS idx_title_normalized   ON news_items(title_normalized);

CREATE TABLE IF NOT EXISTS failed_sources (
  source_name          TEXT PRIMARY KEY,
  last_error           TEXT,
  last_failed_at       INTEGER NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 1
);
