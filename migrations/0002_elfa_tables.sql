-- Elfa AI integration schema. Stores per-call credit accounting,
-- per-ticker mention/sentiment snapshots, and key-status health checks.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=migrations/0002_elfa_tables.sql
-- Re-running is idempotent (CREATE … IF NOT EXISTS everywhere).

-- Every Elfa API call gets a row here, success or failure. Lets us
-- compute monthly credit consumption against the 19,500 cap before
-- firing each request, and gives the admin dashboard an audit trail.
CREATE TABLE IF NOT EXISTS elfa_credit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  called_at     INTEGER NOT NULL,           -- unix seconds, UTC
  endpoint      TEXT    NOT NULL,           -- e.g. '/v2/data/top-mentions'
  params        TEXT,                       -- JSON of query params (ticker, timeWindow, …)
  credits_used  INTEGER NOT NULL DEFAULT 1, -- 5 for trending-narratives / event-summary, else 1
  http_status   INTEGER,
  success       INTEGER NOT NULL,           -- 0 / 1
  error_msg     TEXT
);
CREATE INDEX IF NOT EXISTS idx_credit_log_called_at ON elfa_credit_log(called_at);

-- One snapshot per (ticker, snapshot_at, time_window). The snapshot cron
-- writes a row per ticker per run; the public API joins back through this
-- table to build sparklines.
CREATE TABLE IF NOT EXISTS elfa_token_snapshots (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker                 TEXT    NOT NULL,
  snapshot_at            INTEGER NOT NULL,    -- unix seconds, UTC
  time_window            TEXT    NOT NULL,    -- e.g. '24h'
  mention_count          INTEGER,
  smart_mention_count    INTEGER,
  sentiment_score        REAL,                -- range -1..+1
  mindshare              REAL,                -- 0..1, share of sector chatter
  top_mention_username   TEXT,
  top_mention_view_count INTEGER,
  top_mention_tweet_id   TEXT,
  raw_json               TEXT,                -- full Elfa response, kept for debugging
  UNIQUE(ticker, snapshot_at, time_window)
);
CREATE INDEX IF NOT EXISTS idx_token_snap_ticker_time ON elfa_token_snapshots(ticker, snapshot_at);

-- Daily key-status ping. Stores remaining bonus credits + expiry so the
-- admin dashboard can warn before the 2026-05-31 expiry hits.
CREATE TABLE IF NOT EXISTS elfa_health_log (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at               INTEGER NOT NULL,
  bonus_credits_remaining  INTEGER,
  monthly_usage            INTEGER,
  expires_at               TEXT,
  raw_json                 TEXT
);
