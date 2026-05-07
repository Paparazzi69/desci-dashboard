// POST /cron/elfa-snapshot-tokens
//
// Bearer-auth-gated daily snapshot of crypto-Twitter signal per DeSci
// ticker. For each ticker:
//   1. GET /v2/data/top-mentions · pulls the loudest 50 tweets in the
//      24h window. Total mention count comes from metadata.total; the
//      top tweet's metrics power the top_mention columns; smart-account
//      reposts in those tweets become smart_mention_count.
//   2. POST /v2/chat (only if mention_count >= 5) · asks Elfa AI to
//      grade overall sentiment. Returns a JSON object we parse for
//      sentiment_score in [-1, +1].
//
// After all tickers finish, mindshare is computed locally as
// mention_count / total_mentions and UPDATEd onto every row from this
// run. We use a single snapshot_at value so the UPDATE matches all rows.
//
// Daily cadence at 01:00 UTC (cron-job.org). One per-call sleep keeps
// us well under Elfa's 120 rpm rate limit. One ticker failing does not
// abort the run · we log and continue.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, elfaPost, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';

// Edit this list to track different DeSci tokens. Tickers are sent to
// Elfa with the leading $ stripped (Elfa expects "BIO", not "$BIO"), but
// stored in D1 with the $ prefix so the frontend can render them as-is.
const DESCI_TICKERS = [
  '$BIO', '$VITA', '$RSC', '$HAIR', '$AUBRAI',
  '$VITARNA', '$CRYO', '$RIF', '$URO', '$ATH',
  '$GROW', '$NEURON',
];

const PER_CALL_SLEEP_MS         = 600;       // ~100 calls/min · safe under 120 rpm
const TIME_WINDOW               = '24h';
const PAGE_SIZE                 = 50;
const SENTIMENT_MIN_MENTIONS    = 5;         // skip /v2/chat below this · saves credits
const CHAT_TIMEOUT_MS           = 30_000;    // chat is slow (5-15s typical)

// Captures USERNAME from links shaped https://x.com/USERNAME/status/12345
const X_LINK_USERNAME_RE = /https:\/\/x\.com\/([^\/]+)\/status\//i;

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);
  const snapshotAt = startedAt;  // single value for this run · drives mindshare UPDATE
  const results = [];
  let successes = 0;
  let failures = 0;
  let capReached = false;

  for (let i = 0; i < DESCI_TICKERS.length; i++) {
    const tickerWithDollar = DESCI_TICKERS[i];
    const tickerBare = tickerWithDollar.replace(/^\$/, '');

    if (i > 0) await sleep(PER_CALL_SLEEP_MS);

    try {
      const data = await elfaGet(env, '/v2/data/top-mentions', {
        ticker: tickerBare,
        timeWindow: TIME_WINDOW,
        pageSize: PAGE_SIZE,
      });

      const summary = summarizeTopMentions(data);

      // Sentiment via /v2/chat · only when there's enough chatter to
      // ask a meaningful question. Single failure leaves sentiment_score
      // null but does not break the row.
      let sentiment = null;
      let sentimentSummary = null;
      let sentimentError = null;
      if ((summary.mention_count || 0) >= SENTIMENT_MIN_MENTIONS) {
        try {
          await sleep(PER_CALL_SLEEP_MS);
          const chatResult = await fetchSentiment(env, tickerWithDollar);
          sentiment = chatResult.sentiment;
          sentimentSummary = chatResult.summary;
        } catch (e) {
          if (e instanceof CreditCapReached) throw e;  // bubble · stop the run
          sentimentError = String(e?.message || e).slice(0, 200);
          console.log(`elfa-snapshot ${tickerWithDollar}: sentiment failed · ${sentimentError}`);
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
          tickerWithDollar,
          snapshotAt,
          TIME_WINDOW,
          summary.mention_count,
          summary.smart_mention_count,
          sentiment,
          null,                                // mindshare filled in after the loop
          summary.top_mention_username,
          summary.top_mention_view_count,
          summary.top_mention_tweet_id,
          JSON.stringify({ topMentions: data, sentimentSummary }).slice(0, 64_000),
        ).run();
        successes++;
        results.push({
          ticker: tickerWithDollar,
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
          ticker: tickerWithDollar,
          ok: false,
          error: 'db-insert: ' + String(e?.message || e).slice(0, 200),
        });
      }
    } catch (e) {
      failures++;
      const msg = String(e?.message || e).slice(0, 300);
      results.push({ ticker: tickerWithDollar, ok: false, error: msg });
      if (e instanceof CreditCapReached) {
        capReached = true;
        break;
      }
      console.log(`elfa-snapshot ${tickerWithDollar}: ${msg}`);
    }
  }

  // Compute mindshare locally · share of total mentions across this run.
  // We UPDATE rather than re-INSERT so we don't burn another snapshot row.
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

  // Cap diagnostics · what did this run cost, and how much room is left?
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Pull the fields we actually display from a /v2/data/top-mentions
// response. Reads defensively · Elfa nests the array under data and the
// totals under metadata, but we tolerate the top-level fallback shape too.
function summarizeTopMentions(data) {
  const out = {
    mention_count: null,
    smart_mention_count: null,
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

  // smart_mention_count · sum of repostBreakdown.smart across the list.
  // This is "smart-account reposts engaging with top mentions", a proxy
  // for KOL attention rather than a true smart-mention count.
  let smartSum = 0;
  let smartSeen = false;
  for (const m of list) {
    const s = numOrNull(m?.repostBreakdown?.smart ?? m?.repost_breakdown?.smart ?? null);
    if (s !== null) { smartSum += s; smartSeen = true; }
  }
  out.smart_mention_count = smartSeen ? smartSum : null;

  // Top mention · the first tweet in data[]. Elfa returns the list
  // sorted by relevance/engagement so data[0] is the surface-worthy one.
  const top = list[0];
  if (top) {
    out.top_mention_tweet_id = top.tweetId ? String(top.tweetId)
      : top.tweet_id ? String(top.tweet_id)
      : null;
    out.top_mention_view_count = numOrNull(top.viewCount ?? top.view_count ?? null);
    const link = top.link || top.url || '';
    const m = X_LINK_USERNAME_RE.exec(link);
    if (m && m[1]) out.top_mention_username = m[1];
  }

  return out;
}

// Ask /v2/chat for a sentiment grade. Returns { sentiment, summary } on
// success, throws on failure (so the caller can log and continue).
async function fetchSentiment(env, ticker) {
  const message =
    `Analyze the overall sentiment of recent crypto Twitter discussion ` +
    `about ${ticker} in the last 24 hours. Look at top mentions and ` +
    `engagement. Return ONLY a JSON object in this exact format with ` +
    `no other text: ` +
    `{"sentiment": <number from -1 to 1>, "summary": "<one short sentence under 100 chars>"}`;

  const data = await elfaPost(env, '/v2/chat', {
    message,
    stream: false,
  }, { timeoutMs: CHAT_TIMEOUT_MS });

  // The chat response shape varies · try the well-known fields in order.
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

  // Strip ```json or ``` fences, then pull the first JSON object out.
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
