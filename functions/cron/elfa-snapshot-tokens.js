// POST /cron/elfa-snapshot-tokens
//
// Bearer-auth-gated daily snapshot of crypto-Twitter signal per DeSci
// ticker. Calls Elfa /v2/data/top-mentions for each entry in DESCI_TICKERS
// and writes one row per ticker into elfa_token_snapshots.
//
// Daily cadence at 01:00 UTC (cron-job.org). One per-call sleep keeps us
// well under Elfa's 120 rpm rate limit and gives the per-call retry logic
// in elfaGet some breathing room. One ticker failing does not abort the
// run · we log and continue.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import { elfaGet, CreditCapReached } from '../_shared/elfa.js';

// Edit this list to track different DeSci tokens. Tickers are sent to
// Elfa with the leading $ stripped (Elfa expects "BIO", not "$BIO"), but
// stored in D1 with the $ prefix so the frontend can render them as-is.
const DESCI_TICKERS = [
  '$BIO', '$VITA', '$RSC', '$HAIR', '$AUBRAI',
  '$VITARNA', '$CRYO', '$RIF', '$URO', '$ATH',
  '$GROW', '$NEURON',
];

const PER_CALL_SLEEP_MS = 600;       // 100 calls/min · safe under 120 rpm
const TIME_WINDOW       = '24h';
const PAGE_SIZE         = 50;

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);
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
      const snapshotAt = Math.floor(Date.now() / 1000);

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
          summary.sentiment_score,
          summary.mindshare,
          summary.top_mention_username,
          summary.top_mention_view_count,
          summary.top_mention_tweet_id,
          JSON.stringify(data).slice(0, 64_000),
        ).run();
        successes++;
        results.push({ ticker: tickerWithDollar, ok: true, ...summary });
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
        // Stop early · every remaining call would also fail the cap check.
        break;
      }
      // Otherwise keep going · per-ticker errors should not abort the run.
      console.log(`elfa-snapshot ${tickerWithDollar}: ${msg}`);
    }
  }

  return jsonResponse({
    ok: failures === 0,
    startedAt,
    durationMs: Date.now() - startedAt * 1000,
    capReached,
    successes,
    failures,
    results,
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Distill top-mentions response into the columns we store. Elfa response
// shapes vary slightly by endpoint version; we read defensively and fall
// back to null rather than throwing.
function summarizeTopMentions(data) {
  const out = {
    mention_count: null,
    smart_mention_count: null,
    sentiment_score: null,
    mindshare: null,
    top_mention_username: null,
    top_mention_view_count: null,
    top_mention_tweet_id: null,
  };
  if (!data || typeof data !== 'object') return out;

  // The list of mentions can live at .data.data, .data, .mentions, or .results
  // depending on the endpoint version.
  const list =
    (Array.isArray(data?.data?.data) && data.data.data) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.mentions) && data.mentions) ||
    (Array.isArray(data?.results) && data.results) ||
    [];

  // Aggregate counts. Elfa often returns a metadata block with totals;
  // fall back to list length if that's missing.
  const meta = data?.metadata || data?.data?.metadata || {};
  out.mention_count = numOrNull(
    meta.totalMentions ?? meta.mention_count ?? meta.total ?? list.length
  );
  out.smart_mention_count = numOrNull(
    meta.smartMentionCount ?? meta.smart_mention_count ?? null
  );
  if (out.smart_mention_count === null) {
    // Derive from per-item smart flag if available.
    out.smart_mention_count = list.reduce(
      (n, m) => n + (m?.isSmart || m?.is_smart ? 1 : 0),
      0,
    ) || null;
  }
  out.sentiment_score = numOrNull(
    meta.sentimentScore ?? meta.sentiment_score ?? meta.sentiment ?? null
  );
  out.mindshare = numOrNull(
    meta.mindshare ?? meta.mindShare ?? null
  );

  // Top mention · pick the highest view-count tweet.
  let top = null;
  for (const m of list) {
    const vc = numOrNull(m?.metrics?.viewCount ?? m?.view_count ?? m?.views ?? null);
    if (vc !== null && (top === null || vc > top.view_count)) {
      top = {
        username: m?.account?.username ?? m?.username ?? null,
        tweet_id: m?.tweetId ?? m?.tweet_id ?? m?.id ?? null,
        view_count: vc,
      };
    }
  }
  if (top) {
    out.top_mention_username = top.username ? String(top.username) : null;
    out.top_mention_view_count = top.view_count;
    out.top_mention_tweet_id = top.tweet_id ? String(top.tweet_id) : null;
  }

  return out;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
