-- Smart-account roster + roster-build audit log.
--
-- The snapshot cron uses smart_accounts to count how many DeSci-flagged
-- handles mentioned each project (replacing the unreliable
-- accountCategories=smart filter on Elfa's side). Roster is bootstrapped
-- from a curated seed (data/seed-smart-accounts.json) and topped up
-- weekly by /cron/discover-smart-accounts.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=migrations/0003_smart_accounts.sql
-- Re-running is idempotent (CREATE · IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS smart_accounts (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  username               TEXT NOT NULL UNIQUE,           -- case as first seen
  smart_followers_count  INTEGER,
  follower_count         INTEGER,
  following_count        INTEGER,
  engagement_rate        REAL,
  is_smart               INTEGER NOT NULL DEFAULT 0,     -- 0 / 1, threshold smart_followers_count > 30
  source                 TEXT NOT NULL DEFAULT 'seed',   -- 'seed' | 'discovery' | 'manual'
  first_seen_at          INTEGER NOT NULL,               -- unix seconds, UTC
  last_checked_at        INTEGER,
  check_status           TEXT,                           -- 'ok' | 'not_found' | 'error'
  raw_json               TEXT
);
CREATE INDEX IF NOT EXISTS idx_smart_username ON smart_accounts(username);
CREATE INDEX IF NOT EXISTS idx_smart_is_smart ON smart_accounts(is_smart);

CREATE TABLE IF NOT EXISTS roster_run_log (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type               TEXT NOT NULL,                  -- 'seed' | 'discovery' | 'refresh'
  started_at             INTEGER NOT NULL,
  ended_at               INTEGER,
  accounts_checked       INTEGER,
  accounts_added         INTEGER,
  accounts_marked_smart  INTEGER,
  credits_spent          INTEGER,
  errors                 INTEGER
);
