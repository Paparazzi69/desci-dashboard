// POST /cron/discover-smart-accounts
//
// Bearer-auth-gated. Weekly. Pulls /v2/data/keyword-mentions for the
// canonical DeSci sector keywords, extracts unique authors from the
// returned tweets, and runs every author NOT already in smart_accounts
// through /v2/account/smart-stats. New rows land with source='discovery'.
//
// Inclusion philosophy · we INSERT every author we resolve, regardless
// of smart_followers_count. Anyone tweeting about DeSci sector keywords
// is DeSci-relevant by definition, even if Elfa's crypto-graph hasn't
// flagged them. The is_smart=1 column still uses smart_followers_count
// > 5 (gate for the /kols leaderboard), but the row itself goes in
// even when is_smart=0 so the snapshot's DESCI count picks them up.
// This deliberately bloats smart_accounts in exchange for far better
// DeSci coverage on the sentiment table.
//
// Per-account isolation, hard stop on CreditCapReached. Every run lands
// a roster_run_log row with run_type='discovery' so we can trend roster
// growth over time.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';

const PER_CALL_SLEEP_MS = 600;
const SMART_THRESHOLD   = 5;
const KEYWORDS          = 'DeSci,BioDAO,IPNFT,decentralized science';
const TIME_WINDOW       = '7d';
const PAGE_SIZE         = 100;
const MAX_NEW_PER_RUN   = 150;  // cap discovery cost per run · ~150 credits.
                                // Bumped from 80 once we started inserting all
                                // authors (not just is_smart=1) since the per-run
                                // pool of net-new handles got noticeably wider.

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);

  let runLogId = null;
  try {
    const ins = await env.DB.prepare(
      `INSERT INTO roster_run_log (run_type, started_at, errors)
       VALUES ('discovery', ?, 0)`
    ).bind(startedAt).run();
    runLogId = ins?.meta?.last_row_id || null;
  } catch (e) {
    console.warn('discover-smart-accounts: log-open failed', e);
  }

  // 1. Pull a week's keyword-mentions for the sector.
  let mentions;
  try {
    mentions = await elfaGet(env, '/v2/data/keyword-mentions', {
      keywords: KEYWORDS,
      timeWindow: TIME_WINDOW,
      pageSize: PAGE_SIZE,
    });
  } catch (e) {
    if (e instanceof CreditCapReached) {
      return jsonResponse({ ok: false, error: 'cap-reached', startedAt }, 429);
    }
    return jsonResponse({ ok: false, error: String(e?.message || e) }, 502);
  }

  const list =
    (Array.isArray(mentions?.data) && mentions.data) ||
    (Array.isArray(mentions?.data?.data) && mentions.data.data) ||
    [];

  // 2. Extract unique candidate usernames. Preserve first-seen casing.
  const seenLower = new Set();
  const candidates = [];
  for (const m of list) {
    const u = m?.account?.username || m?.account?.handle || m?.username;
    if (typeof u !== 'string' || !u) continue;
    const lc = u.toLowerCase();
    if (seenLower.has(lc)) continue;
    seenLower.add(lc);
    candidates.push(u);
  }

  // 3. Filter to ones not already in smart_accounts.
  let newOnes = [];
  if (candidates.length) {
    const placeholders = candidates.map(() => '?').join(',');
    const knownRows = (await env.DB.prepare(
      `SELECT LOWER(username) AS lc FROM smart_accounts
        WHERE LOWER(username) IN (${placeholders})`
    ).bind(...candidates.map(u => u.toLowerCase())).all()).results || [];
    const knownSet = new Set(knownRows.map(r => r.lc));
    newOnes = candidates.filter(u => !knownSet.has(u.toLowerCase()));
  }
  const toCheck = newOnes.slice(0, MAX_NEW_PER_RUN);
  const skipped = newOnes.length - toCheck.length;

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
    candidates: candidates.length,
    new_unknowns: newOnes.length,
    checked: accountsChecked,
    added: accountsAdded,
    marked_smart: accountsMarkedSmart,
    skipped_over_cap: skipped,
    errors,
    capReached,
    credits_used_today: creditsAfter,
    credits_spent_this_run: creditsSpent,
    credits_used_this_month: creditsUsedMonth,
    credits_remaining: creditsRemaining,
  });
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
