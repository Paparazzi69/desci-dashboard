// GET /api/kols
//
// Public read of the smart-account roster, ranked by smart_followers_count.
// Cached at the edge for 30 minutes · the roster is refreshed weekly so a
// half-hour TTL is plenty fresh for the leaderboard view.
//
// Returns at most TOP_LIMIT rows where is_smart = 1, plus aggregate
// totals and the timestamp of the most recent roster_run_log entry so
// the page can show "last updated".

import { jsonResponse, cacheGet, cachePut } from '../_shared.js';

const CACHE_KEY = 'kols:v1';
const TTL_S     = 30 * 60;
const TOP_LIMIT = 50;

export async function onRequest({ env }) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return jsonResponse(cached);

  if (!env.DB) {
    return jsonResponse({
      kols: [],
      metadata: {
        smart_count: 0,
        checked_count: 0,
        last_run_at: null,
        last_run_type: null,
      },
    });
  }

  const kols = (await env.DB.prepare(
    `SELECT username, smart_followers_count, follower_count,
            following_count, engagement_rate, last_checked_at,
            source, first_seen_at
       FROM smart_accounts
      WHERE is_smart = 1
      ORDER BY smart_followers_count DESC NULLS LAST,
               follower_count DESC NULLS LAST
      LIMIT ?`
  ).bind(TOP_LIMIT).all()).results || [];

  // Aggregate counts · how full is the roster, how many handles have we
  // checked at all (smart or not).
  const counts = await env.DB.prepare(
    `SELECT
        SUM(CASE WHEN is_smart = 1 THEN 1 ELSE 0 END) AS smart,
        COUNT(*) AS checked
       FROM smart_accounts
      WHERE check_status IN ('ok', 'not_found') OR check_status IS NULL`
  ).first();

  // Latest roster_run_log row · powers the "last updated" indicator.
  const lastRun = await env.DB.prepare(
    `SELECT run_type, COALESCE(ended_at, started_at) AS ts
       FROM roster_run_log
      ORDER BY COALESCE(ended_at, started_at) DESC
      LIMIT 1`
  ).first();

  const payload = {
    kols: kols.map(r => ({
      username: r.username,
      smart_followers_count: numOrNull(r.smart_followers_count),
      follower_count: numOrNull(r.follower_count),
      following_count: numOrNull(r.following_count),
      engagement_rate: numOrNull(r.engagement_rate),
      last_checked_at: numOrNull(r.last_checked_at),
      source: r.source || null,
    })),
    metadata: {
      smart_count: Number(counts?.smart || 0),
      checked_count: Number(counts?.checked || 0),
      last_run_at: lastRun?.ts ? Number(lastRun.ts) : null,
      last_run_type: lastRun?.run_type || null,
    },
  };
  await cachePut(CACHE_KEY, payload, TTL_S);
  return jsonResponse(payload);
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
