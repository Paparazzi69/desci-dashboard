// POST /cron/elfa-snapshot-tokens?batch=4&offset=0
//
// Bearer-auth-gated daily snapshot of crypto-Twitter signal per DeSci
// project. For each project in the requested batch slice:
//   1. GET /v2/data/keyword-mentions · multi-keyword OR (verified by
//      Elfa team). Project-name keywords give cleaner results than
//      $TICKERs (Elfa's ticker filter pulls in too much noise).
//   2. Cross-reference the tweet authors against smart_accounts to
//      compute smart_mention_count = distinct DeSci-roster handles
//      who mentioned the project. The roster is the curated 303-handle
//      seed plus discovery additions · we deliberately do NOT filter
//      by is_smart=1 here. is_smart is Elfa's crypto-graph signal and
//      drops academic DeSci voices like @johncumbers (founder of
//      SynBioBeta) who have zero crypto-Twitter smart followers but
//      are highly DeSci-relevant. The strict is_smart subset is still
//      surfaced separately on the /kols leaderboard.
//   3. POST /v2/chat (only if mention_count >= 5) for a sentiment grade.
//
// Why batched · Cloudflare Pages Functions have a wall-clock budget
// (~30s on free, unbounded but unreliable on paid). 19 projects ×
// keyword-mentions + per-project sentiment chat (5-15s each) blows
// past 30s. We split work into batches of 4 (default) and let the
// caller iterate offsets until has_more=false.
//
// Mindshare and snapshot_at · we anchor every row of a given day to
// the same snapshot_at = UTC day start unix seconds. That way:
//   • Multiple batches within a day share the same UNIQUE row per
//     ticker (INSERT OR REPLACE updates idempotently).
//   • The mindshare UPDATE on the final batch sees every row from
//     today in one statement (no cross-batch state to carry forward).
// Mindshare runs only when this batch closes out the day's projects
// (next_offset >= total_projects), otherwise the percentages would
// be miscalculated mid-run.
//
// Caller loop (PowerShell):
//   $offset = 0
//   do {
//     $r = Invoke-RestMethod -Method POST `
//       -Uri "https://descidash.com/cron/elfa-snapshot-tokens?batch=4&offset=$offset" `
//       -Headers @{ "Authorization" = "Bearer $env:ADMIN_TOKEN" }
//     Write-Host "Processed: $($r.successes), Credits left: $($r.credits_remaining)"
//     $offset = $r.next_offset
//   } while ($r.has_more)
//
// cron-job.org cadence · stagger 5 tasks 2 minutes apart so each
// batch lands inside its own 30s window:
//   01:00 UTC · ?batch=4&offset=0
//   01:02 UTC · ?batch=4&offset=4
//   01:04 UTC · ?batch=4&offset=8
//   01:06 UTC · ?batch=4&offset=12
//   01:08 UTC · ?batch=4&offset=16

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, elfaPost, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';
import { DESCI_PROJECTS } from '../_shared/desci-projects.js';

const PER_CALL_SLEEP_MS      = 600;       // ~100 calls/min · safe under 120 rpm
const TIME_WINDOW            = '24h';
const PAGE_SIZE              = 100;       // higher than ticker variant · keyword search casts a wider net
const SENTIMENT_MIN_MENTIONS = 5;
const CHAT_TIMEOUT_MS        = 30_000;
const DEFAULT_BATCH          = 4;
const MAX_BATCH              = 8;         // hard ceiling · sentiment chat × 8 still fits ~30s

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);
  // snapshot_at = UTC day start · stable across batches within a day,
  // so every batch lands its rows under the same key and the final-
  // batch mindshare UPDATE picks up everything in one statement.
  const snapshotAt = utcDayStartUnix();

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
  const slice = DESCI_PROJECTS.slice(offset, offset + batchSize);
  const nextOffset = offset + batchSize;
  const isFinalBatch = nextOffset >= DESCI_PROJECTS.length;
  const hasMore = !isFinalBatch;

  const results = [];
  let successes = 0;
  let failures = 0;
  let capReached = false;

  for (let i = 0; i < slice.length; i++) {
    const project = slice[i];
    if (i > 0) await sleep(PER_CALL_SLEEP_MS);

    try {
      // Multi-keyword OR · verified by Elfa team. A single project name
      // misses ticker / handle / lowercase variants; comma-joined list
      // with searchType=or covers them in one call (still 1 credit).
      const keywordsCsv = (project.keywords || []).join(',');
      const data = await elfaGet(env, '/v2/data/keyword-mentions', {
        keywords: keywordsCsv,
        searchType: 'or',
        timeWindow: TIME_WINDOW,
        pageSize: PAGE_SIZE,
      });

      const summary = summarizeKeywordMentions(data);

      // smart_mention_count · count distinct handles in the response
      // that exist in our DeSci roster (any check_status='ok' row,
      // not just is_smart=1). Reads from D1, not Elfa.
      summary.smart_mention_count = await countSmartMentions(env, summary.unique_authors);
      delete summary.unique_authors;

      // Sentiment via /v2/chat · skip below threshold to save credits.
      let sentiment = null;
      let sentimentSummary = null;
      let sentimentError = null;
      if ((summary.mention_count || 0) >= SENTIMENT_MIN_MENTIONS) {
        try {
          await sleep(PER_CALL_SLEEP_MS);
          const chatResult = await fetchSentiment(env, project.display);
          sentiment = chatResult.sentiment;
          sentimentSummary = chatResult.summary;
        } catch (e) {
          if (e instanceof CreditCapReached) throw e;
          sentimentError = String(e?.message || e).slice(0, 200);
          console.log(`elfa-snapshot ${project.display}: sentiment failed · ${sentimentError}`);
        }
      }

      try {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO elfa_token_snapshots
             (ticker, snapshot_at, time_window,
              mention_count, smart_mention_count, sentiment_score, mindshare,
              top_mention_username, top_mention_view_count, top_mention_tweet_id,
              raw_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          project.display,                   // ticker column · stores display name now
          snapshotAt,
          TIME_WINDOW,
          summary.mention_count,
          summary.smart_mention_count,
          sentiment,
          null,                              // mindshare filled in on the final batch
          summary.top_mention_username,
          summary.top_mention_view_count,
          summary.top_mention_tweet_id,
          JSON.stringify({
            keywordMentions: data,
            sentimentSummary,
            project: { display: project.display, keywords: project.keywords, ticker: project.ticker },
          }).slice(0, 64_000),
        ).run();
        successes++;
        results.push({
          display: project.display,
          ticker: project.ticker,
          ok: true,
          mention_count: summary.mention_count,
          smart_mention_count: summary.smart_mention_count,
          sentiment_score: sentiment,
          sentiment_error: sentimentError,
          top_mention_username: summary.top_mention_username,
          top_mention_view_count: summary.top_mention_view_count,
        });
      } catch (e) {
        failures++;
        results.push({
          display: project.display,
          ticker: project.ticker,
          ok: false,
          error: 'db-insert: ' + String(e?.message || e).slice(0, 200),
        });
      }
    } catch (e) {
      failures++;
      const msg = String(e?.message || e).slice(0, 300);
      results.push({ display: project.display, ticker: project.ticker, ok: false, error: msg });
      if (e instanceof CreditCapReached) {
        capReached = true;
        break;
      }
      console.log(`elfa-snapshot ${project.display}: ${msg}`);
    }
  }

  // Mindshare · only on the final batch, so we sum every row from
  // today (all batches share snapshotAt = UTC day start) in a single
  // UPDATE. Mid-run mindshare would be miscalculated against a
  // partial total, hence the gate.
  let mindshareUpdated = 0;
  let totalMentions = 0;
  if (isFinalBatch) {
    try {
      const totals = await env.DB.prepare(
        `SELECT COALESCE(SUM(mention_count), 0) AS total
           FROM elfa_token_snapshots
          WHERE snapshot_at = ? AND time_window = ?`
      ).bind(snapshotAt, TIME_WINDOW).first();
      totalMentions = Number(totals?.total || 0);
      if (totalMentions > 0) {
        const upd = await env.DB.prepare(
          `UPDATE elfa_token_snapshots
              SET mindshare = CAST(mention_count AS REAL) / ?
            WHERE snapshot_at = ? AND time_window = ?`
        ).bind(totalMentions, snapshotAt, TIME_WINDOW).run();
        mindshareUpdated = upd?.meta?.changes || 0;
      }
    } catch (e) {
      console.warn('elfa-snapshot: mindshare update failed', e);
    }
  }

  // Cap diagnostics.
  let creditsUsedToday = 0;
  let creditsUsedMonth = 0;
  let creditsRemaining = null;
  try {
    creditsUsedToday = await getCreditsUsedToday(env);
    creditsUsedMonth = await getMonthlyCreditsUsed(env);
    creditsRemaining = Math.max(0, getMonthlyCreditCap() - creditsUsedMonth);
  } catch (e) {
    console.warn('elfa-snapshot: credit diagnostics failed', e);
  }

  return jsonResponse({
    ok: failures === 0 && !capReached,
    startedAt,
    snapshotAt,
    durationMs: Date.now() - startedAt * 1000,
    capReached,
    total_projects: DESCI_PROJECTS.length,
    offset,
    batch: batchSize,
    next_offset: nextOffset,
    has_more: hasMore && !capReached,
    is_final_batch: isFinalBatch,
    successes,
    failures,
    totalMentions,
    mindshareUpdated,
    credits_used_today: creditsUsedToday,
    credits_used_this_month: creditsUsedMonth,
    credits_remaining: creditsRemaining,
    results,
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function utcDayStartUnix() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

// Reads /v2/data/keyword-mentions defensively. The list is at .data
// (sometimes .data.data); totals at .metadata.total. Each tweet exposes
// account.username directly · no regex needed.
function summarizeKeywordMentions(data) {
  const out = {
    mention_count: null,
    smart_mention_count: null,    // filled in by countSmartMentions
    unique_authors: [],
    top_mention_username: null,
    top_mention_view_count: null,
    top_mention_tweet_id: null,
  };
  if (!data || typeof data !== 'object') return out;

  const list =
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.data?.data) && data.data.data) ||
    [];
  const meta = data?.metadata || data?.data?.metadata || {};

  out.mention_count = numOrNull(meta.total ?? meta.totalMentions ?? meta.total_count ?? list.length);

  const authorSet = new Set();
  for (const m of list) {
    const u = m?.account?.username || m?.account?.handle || m?.username;
    if (typeof u === 'string' && u) authorSet.add(u.toLowerCase());
  }
  out.unique_authors = [...authorSet];

  const top = list[0];
  if (top) {
    out.top_mention_username =
      top?.account?.username ?? top?.account?.handle ?? top?.username ?? null;
    out.top_mention_view_count = numOrNull(top.viewCount ?? top.view_count ?? null);
    out.top_mention_tweet_id = top.tweetId ? String(top.tweetId)
      : top.tweet_id ? String(top.tweet_id)
      : null;
  }

  return out;
}

// Count how many of the given (lowercased) usernames exist in our
// DeSci roster (any check_status='ok' row). is_smart is intentionally
// NOT part of this filter · see the header comment for the rationale.
// Returns 0 when the list is empty (Elfa returned no tweets) so the
// column is never null in that case.
async function countSmartMentions(env, lowerUsernames) {
  if (!Array.isArray(lowerUsernames) || lowerUsernames.length === 0) return 0;
  const placeholders = lowerUsernames.map(() => '?').join(',');
  try {
    const row = await env.DB.prepare(
      `SELECT COUNT(DISTINCT LOWER(username)) AS n
         FROM smart_accounts
        WHERE check_status = 'ok'
          AND LOWER(username) IN (${placeholders})`
    ).bind(...lowerUsernames).first();
    return Number(row?.n || 0);
  } catch (e) {
    console.warn('elfa-snapshot: smart-count query failed', e);
    return null;
  }
}

async function fetchSentiment(env, displayName) {
  const message =
    `Analyze the overall sentiment of recent crypto Twitter discussion ` +
    `about ${displayName} in the last 24 hours. Look at top mentions and ` +
    `engagement. Return ONLY a JSON object in this exact format with ` +
    `no other text: ` +
    `{"sentiment": <number from -1 to 1>, "summary": "<one short sentence under 100 chars>"}`;

  const data = await elfaPost(env, '/v2/chat', {
    message,
    stream: false,
  }, { timeoutMs: CHAT_TIMEOUT_MS });

  const text =
    data?.data?.message ??
    data?.data?.response ??
    data?.message ??
    data?.response ??
    data?.choices?.[0]?.message?.content ??
    data?.assistant?.content ??
    '';
  if (!text || typeof text !== 'string') {
    throw new Error('chat: no assistant text in response');
  }

  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const m = stripped.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('chat: no JSON object in assistant text');

  let parsed;
  try { parsed = JSON.parse(m[0]); }
  catch (e) { throw new Error('chat: invalid JSON · ' + String(e?.message || e)); }

  const s = Number(parsed?.sentiment);
  if (!Number.isFinite(s) || s < -1 || s > 1) {
    throw new Error(`chat: sentiment out of range · ${parsed?.sentiment}`);
  }
  const summary = typeof parsed?.summary === 'string'
    ? parsed.summary.slice(0, 200)
    : null;
  return { sentiment: s, summary };
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
