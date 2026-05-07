// GET /api/sentiment
//
// Public read of the latest Elfa snapshot per ticker, with change_24h_pct
// computed against yesterday's snapshot from D1 (not the sparkline tail).
// Cached at the edge for 30 minutes since the snapshot cron only runs
// daily · no point hammering D1 on every page load.
//
// Friendly stale-data behavior · this endpoint never 500s on Elfa-side
// errors. If snapshots are missing or empty we return an empty tokens
// array with metadata.totals zeroed, so the frontend can render a
// "Coming soon" or "Day 1, baseline" state without flicker.

import { jsonResponse, cacheGet, cachePut } from '../_shared.js';

const CACHE_KEY  = 'sentiment:v2';
const TTL_S      = 30 * 60;            // 30 minutes
const SPARK_DAYS = 7;
const TIME_WINDOW = '24h';

export async function onRequest({ env }) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return jsonResponse(cached);

  if (!env.DB) {
    return jsonResponse({
      updated_at: null,
      tokens: [],
      metadata: { total_mentions: 0, tracked_count: 0, has_previous_day: false },
    });
  }

  // Latest row per ticker. We store at most one row per ticker per
  // snapshot_at, so MAX(snapshot_at) per ticker uniquely identifies
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
          WHERE time_window = ?
          GROUP BY ticker
       ) latest ON latest.ticker = s.ticker AND latest.max_at = s.snapshot_at
      WHERE s.time_window = ?
      ORDER BY s.ticker`
  ).bind(TIME_WINDOW, TIME_WINDOW).all()).results || [];

  // Yesterday's snapshot per ticker · powers change_24h_pct. "Yesterday"
  // = the most recent snapshot before today's UTC midnight. For tickers
  // missing a prior snapshot the change stays null and the frontend
  // renders a "Day 1, baseline" state.
  const todayStart = utcDayStartUnix();
  const prevRows = (await env.DB.prepare(
    `SELECT s.ticker, s.mention_count
       FROM elfa_token_snapshots s
       JOIN (
         SELECT ticker, MAX(snapshot_at) AS max_at
           FROM elfa_token_snapshots
          WHERE time_window = ? AND snapshot_at < ?
          GROUP BY ticker
       ) prev ON prev.ticker = s.ticker AND prev.max_at = s.snapshot_at
      WHERE s.time_window = ?`
  ).bind(TIME_WINDOW, todayStart, TIME_WINDOW).all()).results || [];
  const prevByTicker = new Map(prevRows.map(r => [r.ticker, Number(r.mention_count) || 0]));

  // Sparkline source · last SPARK_DAYS of snapshots per ticker, oldest
  // first. We over-select in one query and bucket client-side.
  const cutoff = Math.floor(Date.now() / 1000) - SPARK_DAYS * 24 * 60 * 60;
  const sparkRows = (await env.DB.prepare(
    `SELECT ticker, snapshot_at, mention_count
       FROM elfa_token_snapshots
      WHERE snapshot_at >= ? AND time_window = ?
      ORDER BY ticker, snapshot_at ASC`
  ).bind(cutoff, TIME_WINDOW).all()).results || [];
  const sparkByTicker = new Map();
  for (const r of sparkRows) {
    const t = r.ticker;
    if (!sparkByTicker.has(t)) sparkByTicker.set(t, []);
    sparkByTicker.get(t).push(Number(r.mention_count) || 0);
  }

  let totalMentions = 0;
  let hasPreviousDay = false;

  const tokens = latestRows.map(r => {
    const cur = Number(r.mention_count) || 0;
    totalMentions += cur;

    let change_24h_pct = null;
    const prev = prevByTicker.get(r.ticker);
    if (typeof prev === 'number' && prev > 0) {
      change_24h_pct = ((cur - prev) / prev) * 100;
      hasPreviousDay = true;
    }

    return {
      ticker: r.ticker,
      mention_count: numOrNull(r.mention_count),
      smart_mention_count: numOrNull(r.smart_mention_count),
      sentiment_score: numOrNull(r.sentiment_score),
      mindshare: numOrNull(r.mindshare),
      sparkline: sparkByTicker.get(r.ticker) || [],
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

  const payload = {
    updated_at,
    tokens,
    metadata: {
      total_mentions: totalMentions,
      tracked_count: tokens.length,
      has_previous_day: hasPreviousDay,
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

function utcDayStartUnix() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}
