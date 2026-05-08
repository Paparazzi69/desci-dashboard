// GET /api/sentiment
//
// Public read of the latest Elfa snapshot per project, with change_24h_pct
// computed against yesterday's snapshot from D1 (not the sparkline tail).
// Cached at the edge for 30 minutes since the snapshot cron only runs
// daily · no point hammering D1 on every page load.
//
// Note · elfa_token_snapshots.ticker now stores the project's display
// name (e.g. "VitaDAO"), not "$VITA". We merge the $ticker subtext back
// in via DESCI_PROJECT_BY_DISPLAY so the payload exposes both:
//   token.display = "VitaDAO"
//   token.ticker  = "$VITA" | null
//
// Friendly stale-data behavior · this endpoint never 500s on Elfa-side
// errors. If snapshots are missing or empty we return an empty tokens
// array with metadata.totals zeroed, so the frontend can render a
// "Coming soon" or "Day 1, baseline" state without flicker.

import { jsonResponse, cacheGet, cachePut } from '../_shared.js';
import { DESCI_PROJECT_BY_DISPLAY } from '../_shared/desci-projects.js';

const CACHE_KEY  = 'sentiment:v7';
const TTL_S      = 30 * 60;            // 30 minutes
const SPARK_DAYS = 7;
const TIME_WINDOW = '7d';              // snapshot writes 7d rows now · see header in elfa-snapshot-tokens.js

export async function onRequest({ env }) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return jsonResponse(cached);

  if (!env.DB) {
    return jsonResponse({
      updated_at: null,
      tokens: [],
      metadata: {
        total_mentions: 0,
        tracked_count: 0,
        has_previous_day: false,
        smart_roster_size: 0,
      },
    });
  }

  // Latest row per project · ticker column stores the display name now.
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

  // Yesterday's snapshot per project · powers change_24h_pct. "Yesterday"
  // = the most recent snapshot before today's UTC midnight.
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
  const prevByDisplay = new Map(prevRows.map(r => [r.ticker, Number(r.mention_count) || 0]));

  // Sparkline source · last SPARK_DAYS of snapshots, oldest first.
  const cutoff = Math.floor(Date.now() / 1000) - SPARK_DAYS * 24 * 60 * 60;
  const sparkRows = (await env.DB.prepare(
    `SELECT ticker, snapshot_at, mention_count
       FROM elfa_token_snapshots
      WHERE snapshot_at >= ? AND time_window = ?
      ORDER BY ticker, snapshot_at ASC`
  ).bind(cutoff, TIME_WINDOW).all()).results || [];
  const sparkByDisplay = new Map();
  for (const r of sparkRows) {
    const t = r.ticker;
    if (!sparkByDisplay.has(t)) sparkByDisplay.set(t, []);
    sparkByDisplay.get(t).push(Number(r.mention_count) || 0);
  }

  // Roster size · for the DESCI column tooltip ("from our curated DeSci
  // roster of <X> tracked accounts"). We count every ok row, not just
  // is_smart=1 · the column counts mentions from any account in the
  // roster, regardless of Elfa's crypto-graph smart flag.
  let smartRosterSize = 0;
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM smart_accounts WHERE check_status = 'ok'"
    ).first();
    smartRosterSize = Number(row?.n || 0);
  } catch (e) {
    console.warn('sentiment: roster-size query failed', e);
  }

  let totalMentions = 0;
  let hasPreviousDay = false;

  const tokens = latestRows.map(r => {
    const display = r.ticker;                     // column name is historical · the value IS the display name
    const project = DESCI_PROJECT_BY_DISPLAY[display];
    const ticker = project?.ticker ?? null;
    const cur = Number(r.mention_count) || 0;
    totalMentions += cur;

    let change_24h_pct = null;
    const prev = prevByDisplay.get(display);
    if (typeof prev === 'number' && prev > 0) {
      change_24h_pct = ((cur - prev) / prev) * 100;
      hasPreviousDay = true;
    }

    return {
      // Back-compat alias · some clients still read `ticker` at the top
      // level. We keep it set to the display name to match the column
      // it came from, and surface $ticker as a sibling.
      ticker: display,
      display,
      symbol: ticker,
      mention_count: numOrNull(r.mention_count),
      smart_mention_count: numOrNull(r.smart_mention_count),
      sentiment_score: numOrNull(r.sentiment_score),
      mindshare: numOrNull(r.mindshare),
      sparkline: sparkByDisplay.get(display) || [],
      change_24h_pct,
      top_mention: r.top_mention_username ? {
        username: r.top_mention_username,
        view_count: numOrNull(r.top_mention_view_count),
        tweet_id: r.top_mention_tweet_id || null,
      } : null,
    };
  });

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
      smart_roster_size: smartRosterSize,
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
