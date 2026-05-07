// GET /api/sentiment
//
// Public read of the latest Elfa snapshot per ticker, plus a 7-day
// mention-count sparkline. Cached at the edge for 30 minutes since the
// snapshot cron only runs daily · no point hammering D1 on every page load.
//
// Friendly stale-data behavior · this endpoint never 500s on Elfa-side
// errors. If snapshots are missing or empty we return an empty tokens
// array with the latest updated_at we know about, so the frontend can
// render a "Coming soon" state.

import { jsonResponse, cacheGet, cachePut } from '../_shared.js';

const CACHE_KEY = 'sentiment:v1';
const TTL_S     = 30 * 60;  // 30 minutes
const SPARK_DAYS = 7;

export async function onRequest({ env }) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return jsonResponse(cached);

  if (!env.DB) {
    // No DB binding · still return the friendly empty shape so the
    // frontend's "Coming soon" path renders cleanly.
    return jsonResponse({ updated_at: null, tokens: [] });
  }

  // Latest row per ticker. We store at most one row per ticker per
  // snapshot run, so MAX(snapshot_at) per ticker uniquely identifies
  // the freshest row.
  const latestRows = (await env.DB.prepare(
    `SELECT s.ticker,
            s.snapshot_at,
            s.mention_count,
            s.smart_mention_count,
            s.sentiment_score,
            s.mindshare,
            s.top_mention_username,
            s.top_mention_view_count,
            s.top_mention_tweet_id
       FROM elfa_token_snapshots s
       JOIN (
         SELECT ticker, MAX(snapshot_at) AS max_at
           FROM elfa_token_snapshots
          GROUP BY ticker
       ) latest ON latest.ticker = s.ticker AND latest.max_at = s.snapshot_at
       ORDER BY s.ticker`
  ).all()).results || [];

  // Sparkline source · last SPARK_DAYS of snapshots per ticker, oldest
  // first. We over-select in one query and bucket client-side.
  const cutoff = Math.floor(Date.now() / 1000) - SPARK_DAYS * 24 * 60 * 60;
  const sparkRows = (await env.DB.prepare(
    `SELECT ticker, snapshot_at, mention_count
       FROM elfa_token_snapshots
      WHERE snapshot_at >= ?
      ORDER BY ticker, snapshot_at ASC`
  ).bind(cutoff).all()).results || [];
  const sparkByTicker = new Map();
  for (const r of sparkRows) {
    const t = r.ticker;
    if (!sparkByTicker.has(t)) sparkByTicker.set(t, []);
    sparkByTicker.get(t).push(Number(r.mention_count) || 0);
  }

  const tokens = latestRows.map(r => {
    const spark = sparkByTicker.get(r.ticker) || [];
    // 24h change · compare today's mention_count to the value 24h before.
    // Sparkline is daily-cadence so the prior point is yesterday's value.
    let change_24h_pct = null;
    if (spark.length >= 2) {
      const cur = spark[spark.length - 1];
      const prev = spark[spark.length - 2];
      if (prev > 0) change_24h_pct = ((cur - prev) / prev) * 100;
    }
    return {
      ticker: r.ticker,
      mention_count: numOrNull(r.mention_count),
      smart_mention_count: numOrNull(r.smart_mention_count),
      sentiment_score: numOrNull(r.sentiment_score),
      mindshare: numOrNull(r.mindshare),
      sparkline: spark,
      change_24h_pct,
      top_mention: r.top_mention_username ? {
        username: r.top_mention_username,
        view_count: numOrNull(r.top_mention_view_count),
        tweet_id: r.top_mention_tweet_id || null,
      } : null,
    };
  });

  // updated_at = freshest snapshot across all tickers · what the UI shows.
  let updated_at = null;
  for (const r of latestRows) {
    const ts = Number(r.snapshot_at) || 0;
    if (updated_at === null || ts > updated_at) updated_at = ts;
  }

  const payload = { updated_at, tokens };
  await cachePut(CACHE_KEY, payload, TTL_S);
  return jsonResponse(payload);
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
