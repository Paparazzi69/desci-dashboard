// POST /cron/elfa-news-pulse?batch=8&offset=0
//
// Bearer-auth-gated daily pulse of newsworthy Twitter mentions per
// DeSci project, sourced from Elfa's /v2/data/token-news endpoint.
// token-news returns tweets from news/analytics-focused accounts
// (DeItaone, WuBlockchain, lookonchain, OnchainLens, etc.) · for
// $BIO this returned 768 results over 7 days vs 1 RSS article from
// our existing aggregator in the same window.
//
// Each qualifying tweet (viewCount > 1000 OR likeCount > 10) lands as
// a pending row in the existing news_items table. The /admin queue
// triages them alongside RSS items · source_type='twitter' so the
// admin UI can surface them with a distinct badge.
//
// token-news only accepts a ticker (no multi-keyword), so we skip
// projects with ticker=null (currently only ClawdLab).
//
// Why batched · Cloudflare Pages Functions have a wall-clock budget
// (~30s on free, unbounded but unreliable on paid). 18 token-news
// calls × ~3s each blows past 30s when network latency drifts. We
// split work into batches of 8 (default) and let the caller iterate
// offsets until has_more=false. token-news is fast (no chat call)
// so a larger batch than the snapshot cron fits.
//
// Per-project error isolation · one failure does not abort the
// batch. CreditCapReached is the only hard stop.
//
// Caller loop (PowerShell):
//   $offset = 0
//   do {
//     $r = Invoke-RestMethod -Method POST `
//       -Uri "https://descidash.com/cron/elfa-news-pulse?batch=8&offset=$offset" `
//       -Headers @{ "Authorization" = "Bearer $env:ADMIN_TOKEN" }
//     Write-Host "Tweets added: $($r.tweets_added), Credits left: $($r.credits_remaining)"
//     $offset = $r.next_offset
//   } while ($r.has_more)
//
// cron-job.org cadence · stagger 3 tasks 2 minutes apart so each
// batch lands inside its own 30s window:
//   02:00 UTC · ?batch=8&offset=0
//   02:02 UTC · ?batch=8&offset=8
//   02:04 UTC · ?batch=8&offset=16

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';
import { DESCI_PROJECTS } from '../_shared/desci-projects.js';

const PER_CALL_SLEEP_MS = 600;
const TIME_WINDOW       = '24h';
const PAGE_SIZE         = 20;
const MIN_VIEW_COUNT    = 1000;
const MIN_LIKE_COUNT    = 10;
const TITLE_MAX         = 200;
const DEFAULT_BATCH     = 8;
const MAX_BATCH         = 20;

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);
  const eligible = DESCI_PROJECTS.filter(p => p.ticker);

  // Parse batch / offset · clamp to safe ranges.
  const url = new URL(request.url);
  const batchRaw = Number(url.searchParams.get('batch'));
  const offsetRaw = Number(url.searchParams.get('offset'));
  const batchSize = Number.isFinite(batchRaw)
    ? Math.min(MAX_BATCH, Math.max(1, Math.floor(batchRaw)))
    : DEFAULT_BATCH;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0
    ? Math.floor(offsetRaw)
    : 0;
  const projects = eligible.slice(offset, offset + batchSize);
  const nextOffset = offset + batchSize;
  const isFinalBatch = nextOffset >= eligible.length;
  const hasMore = !isFinalBatch;

  const results = [];
  let successes = 0;
  let failures = 0;
  let tweetsAdded = 0;
  let capReached = false;

  const creditsBefore = await safeCreditsToday(env);

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    if (i > 0) await sleep(PER_CALL_SLEEP_MS);

    let data;
    try {
      data = await elfaGet(env, '/v2/data/token-news', {
        ticker: project.ticker,
        timeWindow: TIME_WINDOW,
        pageSize: PAGE_SIZE,
      });
    } catch (e) {
      if (e instanceof CreditCapReached) {
        capReached = true;
        results.push({ ticker: project.ticker, ok: false, error: 'cap-reached' });
        break;
      }
      failures++;
      const msg = String(e?.message || e).slice(0, 200);
      results.push({ ticker: project.ticker, ok: false, error: msg });
      console.log(`elfa-news-pulse ${project.ticker}: ${msg}`);
      continue;
    }

    const tweets = extractTweets(data);
    let qualified = 0;
    let inserted = 0;

    for (const t of tweets) {
      const view = numOrNull(t?.viewCount ?? t?.view_count ?? null) || 0;
      const like = numOrNull(t?.likeCount ?? t?.like_count ?? null) || 0;
      if (view <= MIN_VIEW_COUNT && like <= MIN_LIKE_COUNT) continue;
      qualified++;

      try {
        const row = await buildRow(t, project, startedAt);
        if (!row) continue;
        const upd = await env.DB.prepare(
          `INSERT OR IGNORE INTO news_items
             (id, source, source_type, title, title_normalized, url, summary, author,
              category, published_at, fetched_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        ).bind(
          row.id, row.source, row.source_type, row.title, row.title_normalized,
          row.url, row.summary, row.author, row.category,
          row.published_at, row.fetched_at,
        ).run();
        if (upd?.meta?.changes) inserted++;
      } catch (dbErr) {
        // Per-tweet isolation · one bad row should not stop the project.
        console.warn(`elfa-news-pulse ${project.ticker}: row insert failed`, dbErr);
      }
    }

    successes++;
    tweetsAdded += inserted;
    results.push({
      ticker: project.ticker,
      display: project.display,
      ok: true,
      tweets_seen: tweets.length,
      tweets_qualified: qualified,
      tweets_inserted: inserted,
    });
  }

  const creditsAfter = await safeCreditsToday(env);
  const creditsSpent = Math.max(0, creditsAfter - creditsBefore);
  let creditsUsedMonth = 0;
  let creditsRemaining = null;
  try {
    creditsUsedMonth = await getMonthlyCreditsUsed(env);
    creditsRemaining = Math.max(0, getMonthlyCreditCap() - creditsUsedMonth);
  } catch { /* swallow */ }

  return jsonResponse({
    ok: failures === 0 && !capReached,
    startedAt,
    durationMs: Date.now() - startedAt * 1000,
    capReached,
    total_projects: eligible.length,
    offset,
    batch: batchSize,
    next_offset: nextOffset,
    has_more: hasMore && !capReached,
    is_final_batch: isFinalBatch,
    successes,
    failures,
    tweets_added: tweetsAdded,
    credits_used_today: creditsAfter,
    credits_used: creditsSpent,
    credits_used_this_month: creditsUsedMonth,
    credits_remaining: creditsRemaining,
    results,
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeCreditsToday(env) {
  try { return await getCreditsUsedToday(env); } catch { return 0; }
}

function extractTweets(data) {
  return (Array.isArray(data?.data) && data.data)
    || (Array.isArray(data?.data?.data) && data.data.data)
    || [];
}

// Build a news_items row from a token-news tweet. Returns null if we
// can't make a usable URL · everything else is best-effort.
async function buildRow(tweet, project, fetchedAt) {
  const url = normalizeUrl(tweet?.link || tweet?.url || tweetUrlFrom(tweet));
  if (!url) return null;

  const username = tweet?.account?.username || tweet?.username || null;
  const view = numOrNull(tweet?.viewCount ?? tweet?.view_count ?? null) || 0;
  const like = numOrNull(tweet?.likeCount ?? tweet?.like_count ?? null) || 0;
  const content = (typeof tweet?.content === 'string' && tweet.content.trim())
    || (typeof tweet?.text === 'string' && tweet.text.trim())
    || '';

  // Prefer the actual tweet text if Elfa surfaces it · otherwise fall
  // back to a synthesized headline that still tells a triage operator
  // who said it and how loud the signal was.
  const title = content
    ? content.replace(/\s+/g, ' ').slice(0, TITLE_MAX)
    : `${username || 'unknown'} on ${project.display}: ${formatCount(view)} views, ${formatCount(like)} likes`;

  const summary = `${project.ticker} mention by @${username || 'unknown'}`;
  const publishedAt = mentionedAtToUnix(tweet) || fetchedAt;
  const id = await sha256Hex(url);

  return {
    id,
    source: 'twitter',
    source_type: 'twitter',
    title,
    title_normalized: normalizeTitle(title),
    url,
    summary,
    author: username,
    category: 'token',
    published_at: publishedAt,
    fetched_at: fetchedAt,
  };
}

function tweetUrlFrom(t) {
  const id = t?.tweetId || t?.tweet_id || t?.id;
  const username = t?.account?.username || t?.username;
  if (id && username) return `https://x.com/${username}/status/${id}`;
  return null;
}

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'ref_url',
  's', 't',                                  // X.com tracking · the "share?s=20" cruft
]);

function normalizeUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim());
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

function normalizeTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mentionedAtToUnix(tweet) {
  const v = tweet?.mentionedAt ?? tweet?.mentioned_at ?? tweet?.createdAt ?? tweet?.created_at ?? null;
  if (v == null) return null;
  // mentionedAt can come as unix seconds, unix ms, or an ISO string.
  if (typeof v === 'number') {
    return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  }
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatCount(n) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
