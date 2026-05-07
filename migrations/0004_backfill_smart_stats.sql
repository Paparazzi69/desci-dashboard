-- Backfill smart_accounts numeric columns from raw_json.
--
-- The PR #18/#19 parser read snake_case fields, but Elfa's live
-- /v2/account/smart-stats response uses camelCase. Result: every row
-- inserted by the seed bootstrap has NULL for smart_followers_count
-- (and friends) but the full response is still in raw_json (137-139
-- bytes per row). This migration recovers the numeric values from
-- raw_json using SQLite's JSON1 functions, no Elfa credits spent.
--
-- After this runs, every row with check_status='ok' should have
-- non-null smart_followers_count and a correctly-flagged is_smart.
--
-- Threshold lowered from 30 to 5 to match the new code-side default.
-- DeSci-sized accounts have small smart-follower counts (Paul Kohlhaas
-- had 13 at the time we calibrated this) so 30 was dropping most of
-- the curated seed back out.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=migrations/0004_backfill_smart_stats.sql
-- Re-running is safe · later runs are no-ops once values are populated,
-- and the is_smart UPDATE is idempotent on identical inputs.

UPDATE smart_accounts
SET
  smart_followers_count = COALESCE(
    json_extract(raw_json, '$.data.smartFollowerCount'),
    json_extract(raw_json, '$.smartFollowerCount')
  ),
  follower_count = COALESCE(
    json_extract(raw_json, '$.data.followerCount'),
    json_extract(raw_json, '$.followerCount')
  ),
  following_count = COALESCE(
    json_extract(raw_json, '$.data.smartFollowingCount'),
    json_extract(raw_json, '$.smartFollowingCount')
  ),
  engagement_rate = COALESCE(
    json_extract(raw_json, '$.data.averageEngagement'),
    json_extract(raw_json, '$.averageEngagement')
  )
WHERE check_status = 'ok' AND raw_json IS NOT NULL;

-- Recompute is_smart from the (now-populated) smart_followers_count.
-- Threshold = 5 · matches SMART_THRESHOLD in build-smart-roster.js
-- and discover-smart-accounts.js.
UPDATE smart_accounts
SET is_smart = CASE
  WHEN smart_followers_count IS NOT NULL AND smart_followers_count > 5 THEN 1
  ELSE 0
END
WHERE check_status = 'ok';
