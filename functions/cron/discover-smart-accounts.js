// POST /cron/discover-smart-accounts?batch=20&offset=0
//
// Bearer-auth-gated. Weekly. Mines /v2/data/keyword-mentions tweet
// authors directly from the snapshot's raw_json (elfa_token_snapshots
// stores the full Elfa response per project), then runs every author
// NOT already in smart_accounts through /v2/account/smart-stats. New
// rows land with source='discovery'.
//
// Why batched · Cloudflare Pages Functions have a wall-clock budget
// (~30s on free, unbounded but unreliable on paid). 150 smart-stats
// calls × 600ms sleep = 90+ seconds, which times out hard. Same
// pattern as build-smart-roster and elfa-snapshot-tokens · ?batch=N
// &offset=O, response carries next_offset / has_more, caller iterates
// until has_more=false.
//
// Caller loop (PowerShell):
//   $offset = 0
//   do {
//     $r = Invoke-RestMethod -Method POST `
//       -Uri "https://descidash.com/cron/discover-smart-accounts?batch=20&offset=$offset" `
//       -Headers @{ "Authorization" = "Bearer $env:ADMIN_TOKEN" }
//     Write-Host "Added: $($r.added), Smart: $($r.marked_smart)"
//     $offset = $r.next_offset
//   } while ($r.has_more)
//
// cron-job.org cadence · weekly task that just calls offset=0 with
// batch=30 (single shot covers ~30 candidates, plenty to keep the
// roster fresh week to week). Manual runs use the loop above when
// the candidate pool is bigger than 30 after a long gap.
//
// Why source from the snapshot · before today this cron made its own
// keyword-mentions call against generic sector keywords (DeSci, BioDAO,
// IPNFT). That worked at sector scale but did NOT cover the specific
// tracked-project keyword sets, and a parser drift left candidates
// stuck at zero. Reading the snapshot's already-saved raw_json:
//   1. Costs zero extra Elfa credits for the tweet pull (snapshot paid)
//   2. Discovers authors specifically engaging with the projects we
//      track, not just sector-wide chatter
//   3. Stays robust to Elfa response-shape drift · the snapshot already
//      proved it can read account.username from each tweet
//
// Inclusion philosophy · we INSERT every author we resolve, regardless
// of smart_followers_count. Anyone tweeting about a tracked DeSci
// project is DeSci-relevant by definition, even if Elfa's crypto-graph
// hasn't flagged them. The is_smart=1 column still uses
// smart_followers_count > 5 (gate for the /kols leaderboard), but the
// row itself goes in even when is_smart=0 so the snapshot's DESCI
// count picks them up.
//
// Per-account isolation, hard stop on CreditCapReached. Every run lands
// a roster_run_log row with run_type='discovery' so we can trend roster
// growth over time.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';

const PER_CALL_SLEEP_MS    = 600;
const SMART_THRESHOLD      = 5;
const SNAPSHOT_LOOKBACK_S  = 7 * 24 * 60 * 60;   // pull authors from the last week of snapshots
const DEFAULT_BATCH        = 20;             // ~12s per batch · safe under Cloudflare's 30s budget
const MAX_BATCH            = 30;             // hard ceiling · 30 × 600ms = 18s plus per-call latency
const KNOWN_CHUNK_SIZE     = 50;             // D1 / SQLite caps placeholder count at ~100 per statement.
                                              // 50 leaves headroom for the LOWER() projection on each side
                                              // and stays well under the limit even on bind() overhead.

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ ok: false, error: 'D1 binding DB not configured' });

  // Top-level guard · same shape as build-smart-roster.js. Any unexpected
  // throw inside the handler bubbles up to the catch, where we 1) log
  // it, 2) try to mark the run-log row as errored, and 3) return HTTP
  // 200 with { ok: false, error, stack, type } so the caller doesn't
  // have to dig through Cloudflare logs to debug a 1101.
  const startedAt = Math.floor(Date.now() / 1000);
  let runLogId = null;

  try {
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

    try {
      const ins = await env.DB.prepare(
        `INSERT INTO roster_run_log (run_type, started_at, errors)
         VALUES ('discovery', ?, 0)`
      ).bind(startedAt).run();
      runLogId = ins?.meta?.last_row_id || null;
    } catch (e) {
      // Run-log is observability, not correctness · keep going.
      console.warn('discover-smart-accounts: log-open failed', e);
    }

    // 1. Read the last week of snapshot rows. Each row's raw_json holds
    //    { keywordMentions: { data: [...], metadata: {...} }, ... }.
    const since = startedAt - SNAPSHOT_LOOKBACK_S;
    const rows = (await env.DB.prepare(
      `SELECT ticker, snapshot_at, raw_json
         FROM elfa_token_snapshots
        WHERE snapshot_at >= ?
          AND raw_json IS NOT NULL`
    ).bind(since).all()).results || [];

    // 2. Walk every snapshot, parse raw_json, extract distinct authors.
    //    Preserve first-seen casing (Elfa is case-insensitive on lookup).
    const seenLower = new Set();
    const candidates = [];
    let parseFailures = 0;
    for (const row of rows) {
      let parsed;
      try {
        parsed = JSON.parse(row.raw_json);
      } catch {
        parseFailures++;
        continue;
      }
      const list =
        (Array.isArray(parsed?.keywordMentions?.data) && parsed.keywordMentions.data) ||
        (Array.isArray(parsed?.keywordMentions?.data?.data) && parsed.keywordMentions.data.data) ||
        [];
      for (const tweet of list) {
        const u = tweet?.account?.username || tweet?.account?.handle || tweet?.username;
        if (typeof u !== 'string' || !u) continue;
        const lc = u.toLowerCase();
        if (seenLower.has(lc)) continue;
        seenLower.add(lc);
        candidates.push(u);
      }
    }
    console.log(
      `discover-smart-accounts: parsed ${rows.length} snapshots ` +
      `(${parseFailures} parse failures), found ${candidates.length} candidate usernames`
    );
    if (candidates.length) {
      console.log(`discover-smart-accounts: sample candidates · ${candidates.slice(0, 5).join(', ')}`);
    }

    // 3. Filter to ones not already in smart_accounts.
    //
    // D1 / SQLite caps the per-statement parameter count at ~100 (we hit
    // "too many SQL variables at offset 285: SQLITE_ERROR" in production
    // when the candidate pool grew past that). Chunk the IN-clause into
    // KNOWN_CHUNK_SIZE-sized slices, accumulate the already-known set
    // across chunks, and filter at the end.
    let newOnes = [];
    let alreadyKnown = 0;
    if (candidates.length) {
      const knownSet = new Set();
      const lowered = candidates.map(u => u.toLowerCase());
      for (let i = 0; i < lowered.length; i += KNOWN_CHUNK_SIZE) {
        const chunk = lowered.slice(i, i + KNOWN_CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const rs = (await env.DB.prepare(
          `SELECT LOWER(username) AS lc FROM smart_accounts
            WHERE LOWER(username) IN (${placeholders})`
        ).bind(...chunk).all()).results || [];
        for (const row of rs) knownSet.add(row.lc);
      }
      alreadyKnown = knownSet.size;
      newOnes = candidates.filter(u => !knownSet.has(u.toLowerCase()));
    }
    const toCheck = newOnes.slice(offset, offset + batchSize);
    const nextOffset = offset + batchSize;
    const isFinalBatch = nextOffset >= newOnes.length;
    const hasMore = !isFinalBatch;
    console.log(
      `discover-smart-accounts: already in roster · ${alreadyKnown}, ` +
      `new unknowns · ${newOnes.length}, batch=${batchSize} offset=${offset}, ` +
      `will check · ${toCheck.length}` +
      (hasMore ? ` (next_offset ${nextOffset})` : ' (final batch)')
    );

    // 4. Run smart-stats for each new candidate.
    let accountsChecked = 0;
    let accountsAdded = 0;
    let accountsMarkedSmart = 0;
    let errors = 0;
    let capReached = false;
    const creditsBefore = await getCreditsUsedToday(env);

    for (let i = 0; i < toCheck.length; i++) {
      const username = toCheck[i];
      if (i > 0) await sleep(PER_CALL_SLEEP_MS);

      try {
        const data = await elfaGet(env, '/v2/account/smart-stats', { username });
        const stats = extractSmartStats(data);
        // is_smart gates the /kols leaderboard. The INSERT below runs
        // unconditionally · authors with smart_followers_count <= 5 still
        // land in the roster (with is_smart=0) so the snapshot's DESCI
        // count picks them up.
        const isSmart = (stats.smart_followers_count || 0) > SMART_THRESHOLD ? 1 : 0;

        await env.DB.prepare(
          `INSERT INTO smart_accounts
             (username, smart_followers_count, follower_count, following_count,
              engagement_rate, is_smart, source, first_seen_at, last_checked_at,
              check_status, raw_json)
             VALUES (?, ?, ?, ?, ?, ?, 'discovery', ?, ?, 'ok', ?)
           ON CONFLICT(username) DO UPDATE SET
             smart_followers_count = excluded.smart_followers_count,
             follower_count        = excluded.follower_count,
             following_count       = excluded.following_count,
             engagement_rate       = excluded.engagement_rate,
             is_smart              = excluded.is_smart,
             last_checked_at       = excluded.last_checked_at,
             check_status          = excluded.check_status,
             raw_json              = excluded.raw_json`
        ).bind(
          username,
          stats.smart_followers_count,
          stats.follower_count,
          stats.following_count,
          stats.engagement_rate,
          isSmart,
          startedAt,
          startedAt,
          JSON.stringify(data).slice(0, 16_000),
        ).run();

        accountsChecked++;
        accountsAdded++;
        if (isSmart) accountsMarkedSmart++;
      } catch (e) {
        if (e instanceof CreditCapReached) {
          capReached = true;
          break;
        }
        errors++;
        const msg = String(e?.message || e).slice(0, 200);
        const status = e?.status;
        const checkStatus = status === 404 ? 'not_found' : 'error';
        try {
          await env.DB.prepare(
            `INSERT INTO smart_accounts
               (username, is_smart, source, first_seen_at, last_checked_at, check_status, raw_json)
               VALUES (?, 0, 'discovery', ?, ?, ?, ?)
             ON CONFLICT(username) DO UPDATE SET
               last_checked_at = excluded.last_checked_at,
               check_status    = excluded.check_status,
               raw_json        = excluded.raw_json`
          ).bind(
            username,
            startedAt,
            startedAt,
            checkStatus,
            JSON.stringify({ error: msg, status }).slice(0, 1000),
          ).run();
        } catch (dbErr) {
          console.warn(`discover-smart-accounts: insert failed for ${username}`, dbErr);
        }
        console.log(`discover-smart-accounts ${username}: ${msg}`);
      }
    }

    const creditsAfter = await getCreditsUsedToday(env);
    const creditsSpent = Math.max(0, creditsAfter - creditsBefore);

    if (runLogId) {
      try {
        await env.DB.prepare(
          `UPDATE roster_run_log
              SET ended_at = ?, accounts_checked = ?, accounts_added = ?,
                  accounts_marked_smart = ?, credits_spent = ?, errors = ?
            WHERE id = ?`
        ).bind(
          Math.floor(Date.now() / 1000),
          accountsChecked,
          accountsAdded,
          accountsMarkedSmart,
          creditsSpent,
          errors,
          runLogId,
        ).run();
      } catch (e) {
        console.warn('discover-smart-accounts: log-close failed', e);
      }
    }

    let creditsUsedMonth = 0;
    let creditsRemaining = null;
    try {
      creditsUsedMonth = await getMonthlyCreditsUsed(env);
      creditsRemaining = Math.max(0, getMonthlyCreditCap() - creditsUsedMonth);
    } catch { /* swallow */ }

    return jsonResponse({
      ok: errors === 0 && !capReached,
      startedAt,
      snapshots_scanned: rows.length,
      parse_failures: parseFailures,
      candidates: candidates.length,
      already_known: alreadyKnown,
      new_unknowns: newOnes.length,
      total_candidates: newOnes.length,    // alias for batch consumers
      offset,
      batch: batchSize,
      next_offset: nextOffset,
      has_more: hasMore && !capReached,
      is_final_batch: isFinalBatch,
      processed: toCheck.length,
      checked: accountsChecked,
      added: accountsAdded,
      marked_smart: accountsMarkedSmart,
      errors,
      capReached,
      credits_used_today: creditsAfter,
      credits_spent_this_run: creditsSpent,
      credits_used_this_month: creditsUsedMonth,
      credits_remaining: creditsRemaining,
    });
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 500);
    const stack = String(e?.stack || '').slice(0, 1500);
    const type = e?.constructor?.name || 'Error';
    console.error('discover-smart-accounts: unhandled', type, msg, stack);
    if (runLogId) {
      try {
        await env.DB.prepare(
          `UPDATE roster_run_log
              SET ended_at = ?, errors = COALESCE(errors, 0) + 1
            WHERE id = ?`
        ).bind(Math.floor(Date.now() / 1000), runLogId).run();
      } catch { /* swallow · we are already in the failure path */ }
    }
    // Return 200 with error details so the caller can read what blew up
    // straight from the JSON body, no Cloudflare-1101 dashboard hunt.
    return jsonResponse({
      ok: false,
      startedAt,
      error: msg,
      stack: stack || null,
      type,
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Live Elfa /v2/account/smart-stats response shape (verified 2026-05-07):
//   { success: true,
//     data: { smartFollowingCount, averageEngagement, averageReach,
//             smartFollowerCount, followerCount } }
// camelCase first, snake_case kept as a fallback in case Elfa flips it
// on us in a future revision.
function extractSmartStats(data) {
  const d = (data && typeof data === 'object' && data.data && typeof data.data === 'object')
    ? data.data
    : data || {};
  return {
    smart_followers_count: numOrNull(
      d.smartFollowerCount ?? d.smart_followers_count ?? d.smartFollowersCount ?? null
    ),
    follower_count: numOrNull(
      d.followerCount ?? d.follower_count ?? d.followers ?? d.followers_count ?? null
    ),
    following_count: numOrNull(
      d.smartFollowingCount ?? d.smart_following_count ?? d.followingCount ?? d.following_count ?? null
    ),
    engagement_rate: numOrNull(
      d.averageEngagement ?? d.engagement_rate ?? d.engagementRate ?? null
    ),
  };
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
