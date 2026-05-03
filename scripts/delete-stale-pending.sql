-- One-off cleanup. Delete pending items older than 30 days — these were
-- ingested before the uniform 30-day cutoff applied to all sources
-- (project-native filter:'pass' sources used to bypass date filtering
-- entirely). Going forward the aggregator never inserts items past the
-- 30-day mark, so this is for the historical backlog only.
--
-- Approved / featured / rejected items are deliberately left alone —
-- once you've made an editorial call on a story, your curation outweighs
-- the recency heuristic. A stellar 6-month-old explainer you've written
-- a "your take" on shouldn't auto-disappear.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=scripts/delete-stale-pending.sql

DELETE FROM news_items
WHERE status = 'pending'
  AND published_at < (strftime('%s', 'now') - 30 * 24 * 60 * 60);
