// POST /cron/build-smart-roster
//
// Bearer-auth-gated. Bootstraps (or refreshes) the smart_accounts table
// from the curated seed at /data/seed-smart-accounts.json. For each
// handle not yet in the table (or last checked more than 30 days ago),
// calls /v2/account/smart-stats (1 credit) and stores the result.
//
// is_smart = 1 when smart_followers_count > 30. The threshold is
// deliberately loose for the seed: every handle in the seed list was
// curated by domain-knowledgeable humans, so we want a permissive cut
// that still excludes obviously-dormant accounts.
//
// Per-account error isolation · one failure does not stop the loop.
// Hard stop only on CreditCapReached. Each run writes a roster_run_log
// row so the admin dashboard can see the cumulative seed coverage over
// time.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';

const PER_CALL_SLEEP_MS = 600;
const RECHECK_AFTER_S   = 30 * 24 * 60 * 60;   // 30 days
const SMART_THRESHOLD   = 30;
const SEED_PATH         = '/data/seed-smart-accounts.json';

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startedAt = Math.floor(Date.now() / 1000);

  // Fetch the curated seed list from the deployed static asset. Works
  // both in production and under `wrangler pages dev` since Pages serves
  // /data/* as plain static files.
  let seed;
  try {
    const seedUrl = new URL(SEED_PATH, request.url).toString();
    const r = await fetch(seedUrl, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`seed fetch HTTP ${r.status}`);
    seed = await r.json();
    if (!Array.isArray(seed)) throw new Error('seed not an array');
  } catch (e) {
    return jsonResponse({ ok: false, error: 'seed-load: ' + String(e?.message || e) }, 500);
  }

  // Open a roster_run_log row up front · we'll stamp the totals at the end.
  let runLogId = null;
  try {
    const ins = await env.DB.prepare(
      `INSERT INTO roster_run_log (run_type, started_at, errors)
       VALUES ('seed', ?, 0)`
    ).bind(startedAt).run();
    runLogId = ins?.meta?.last_row_id || null;
  } catch (e) {
    console.warn('build-smart-roster: log-open failed', e);
  }

  // Pull the current state of every handle in the seed in one query so
  // we know which are due for a (re)check. Case-insensitive match · the
  // seed preserves first-seen casing but Elfa is case-insensitive.
  const seedLowercase = seed.map(s => s.toLowerCase());
  const known = new Map();
  if (seedLowercase.length) {
    // SQLite has no IN-list parameter trick · build placeholders inline.
    const placeholders = seedLowercase.map(() => '?').join(',');
    const rows = (await env.DB.prepare(
      `SELECT username, last_checked_at, check_status
         FROM smart_accounts
        WHERE LOWER(username) IN (${placeholders})`
    ).bind(...seedLowercase).all()).results || [];
    for (const r of rows) known.set(String(r.username).toLowerCase(), r);
  }

  let accountsChecked = 0;
  let accountsAdded = 0;
  let accountsMarkedSmart = 0;
  let errors = 0;
  let capReached = false;
  const creditsBefore = await getCreditsUsedToday(env);

  for (let i = 0; i < seed.length; i++) {
    const username = seed[i];
    if (typeof username !== 'string' || !username) continue;

    const lc = username.toLowerCase();
    const existing = known.get(lc);
    const lastChecked = existing?.last_checked_at ? Number(existing.last_checked_at) : 0;
    const dueForCheck = !existing || (startedAt - lastChecked) > RECHECK_AFTER_S;
    if (!dueForCheck) continue;

    if (accountsChecked > 0) await sleep(PER_CALL_SLEEP_MS);

    try {
      const data = await elfaGet(env, '/v2/account/smart-stats', { username });
      const stats = extractSmartStats(data);
      const isSmart = (stats.smart_followers_count || 0) > SMART_THRESHOLD ? 1 : 0;

      await upsertAccount(env, {
        username,
        smart_followers_count: stats.smart_followers_count,
        follower_count: stats.follower_count,
        following_count: stats.following_count,
        engagement_rate: stats.engagement_rate,
        is_smart: isSmart,
        source: existing ? (existing.source || 'seed') : 'seed',
        first_seen_at: existing ? null : startedAt,
        last_checked_at: startedAt,
        check_status: 'ok',
        raw_json: JSON.stringify(data).slice(0, 16_000),
      }, !!existing);

      accountsChecked++;
      if (!existing) accountsAdded++;
      if (isSmart) accountsMarkedSmart++;
    } catch (e) {
      if (e instanceof CreditCapReached) {
        capReached = true;
        break;
      }
      errors++;
      const status = e?.status;
      const msg = String(e?.message || e).slice(0, 200);
      // 404 · username doesn't exist on Elfa's index. Mark it so we
      // don't keep burning credits on it.
      const checkStatus = status === 404 ? 'not_found' : 'error';
      try {
        await upsertAccount(env, {
          username,
          smart_followers_count: null,
          follower_count: null,
          following_count: null,
          engagement_rate: null,
          is_smart: 0,
          source: existing ? (existing.source || 'seed') : 'seed',
          first_seen_at: existing ? null : startedAt,
          last_checked_at: startedAt,
          check_status: checkStatus,
          raw_json: JSON.stringify({ error: msg, status }).slice(0, 1000),
        }, !!existing);
      } catch (dbErr) {
        console.warn(`build-smart-roster: upsert failed for ${username}`, dbErr);
      }
      console.log(`build-smart-roster ${username}: ${msg}`);
    }
  }

  const creditsAfter = await getCreditsUsedToday(env);
  const creditsSpent = Math.max(0, creditsAfter - creditsBefore);

  // Stamp the run-log row with totals.
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
      console.warn('build-smart-roster: log-close failed', e);
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
    seed_size: seed.length,
    accounts_checked: accountsChecked,
    accounts_added: accountsAdded,
    accounts_marked_smart: accountsMarkedSmart,
    errors,
    capReached,
    credits_used_today: creditsAfter,
    credits_spent_this_run: creditsSpent,
    credits_used_this_month: creditsUsedMonth,
    credits_remaining: creditsRemaining,
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Read smart_followers_count, follower_count, following_count, and
// engagement_rate from /v2/account/smart-stats. Field shape varies
// across Elfa response versions · try the common spellings.
function extractSmartStats(data) {
  const d = (data && typeof data === 'object' && data.data && typeof data.data === 'object')
    ? data.data
    : data || {};
  return {
    smart_followers_count: numOrNull(
      d.smart_followers_count ?? d.smartFollowersCount ?? d.smart_followers ?? null
    ),
    follower_count: numOrNull(
      d.follower_count ?? d.followerCount ?? d.followers ?? d.followers_count ?? null
    ),
    following_count: numOrNull(
      d.following_count ?? d.followingCount ?? d.following ?? null
    ),
    engagement_rate: numOrNull(
      d.engagement_rate ?? d.engagementRate ?? d.engagement ?? null
    ),
  };
}

// UPSERT: insert if `exists` is false, otherwise update. We split the
// two paths so the username column never gets re-cased on update (the
// first-seen casing is what users see in the UI).
async function upsertAccount(env, row, exists) {
  if (!exists) {
    await env.DB.prepare(
      `INSERT INTO smart_accounts
         (username, smart_followers_count, follower_count, following_count,
          engagement_rate, is_smart, source, first_seen_at, last_checked_at,
          check_status, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      row.username,
      row.smart_followers_count,
      row.follower_count,
      row.following_count,
      row.engagement_rate,
      row.is_smart,
      row.source,
      row.first_seen_at,
      row.last_checked_at,
      row.check_status,
      row.raw_json,
    ).run();
  } else {
    await env.DB.prepare(
      `UPDATE smart_accounts
          SET smart_followers_count = ?, follower_count = ?, following_count = ?,
              engagement_rate = ?, is_smart = ?, last_checked_at = ?,
              check_status = ?, raw_json = ?
        WHERE LOWER(username) = LOWER(?)`
    ).bind(
      row.smart_followers_count,
      row.follower_count,
      row.following_count,
      row.engagement_rate,
      row.is_smart,
      row.last_checked_at,
      row.check_status,
      row.raw_json,
      row.username,
    ).run();
  }
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
