// POST /cron/elfa-snapshot-tokens
//
// Bearer-auth-gated daily snapshot of crypto-Twitter signal per DeSci
// project. For each entry in DESCI_PROJECTS:
//   1. GET /v2/data/keyword-mentions · keyword-based search returns the
//      tweet array + metadata.total. Project-name keywords give cleaner
//      results than $TICKERs (Elfa's ticker filter pulls in too much noise).
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
// After all projects finish, mindshare = mention_count / sector_total
// is UPDATEd onto every row from this run. We use a single snapshot_at
// value so the UPDATE matches all rows in one statement.
//
// The ticker column on elfa_token_snapshots stores the project's
// `display` name (e.g. "VitaDAO"), not "$VITA". /api/sentiment merges
// the ticker subtext back in via DESCI_PROJECT_BY_DISPLAY.
//
// Daily cadence at 01:00 UTC. Per-project error isolation · one failure
// does not abort the run.

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

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);
  const snapshotAt = startedAt;
  const results = [];
  let successes = 0;
  let failures = 0;
  let capReached = false;

  for (let i = 0; i < DESCI_PROJECTS.length; i++) {
    const project = DESCI_PROJECTS[i];
    if (i > 0) await sleep(PER_CALL_SLEEP_MS);

    try {
      const data = await elfaGet(env, '/v2/data/keyword-mentions', {
        keywords: project.keyword,
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
          null,                              // mindshare filled in after the loop
          summary.top_mention_username,
          summary.top_mention_view_count,
          summary.top_mention_tweet_id,
          JSON.stringify({
            keywordMentions: data,
            sentimentSummary,
            project: { display: project.display, keyword: project.keyword, ticker: project.ticker },
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

  // Compute mindshare · share of total mentions across this run.
  let mindshareUpdated = 0;
  let totalMentions = 0;
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
    ok: failures === 0,
    startedAt,
    snapshotAt,
    durationMs: Date.now() - startedAt * 1000,
    capReached,
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
