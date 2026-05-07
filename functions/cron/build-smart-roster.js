// POST /cron/build-smart-roster?batch=50&offset=0
//
// Bearer-auth-gated. Bootstraps (or refreshes) the smart_accounts table
// from the curated SEED_ACCOUNTS list. For each handle in the requested
// batch slice that is not yet in the table (or last checked more than
// 30 days ago), calls /v2/account/smart-stats (1 credit) and stores the
// result.
//
// is_smart = 1 when smart_followers_count > 30. The threshold is
// deliberately loose for the seed: every handle in the seed list was
// curated by domain-knowledgeable humans, so we want a permissive cut
// that still excludes obviously-dormant accounts.
//
// Why batched · Cloudflare Pages Functions have a wall-clock limit
// (~30s on the free tier, unbounded on paid but unreliable in practice).
// 303 accounts × 600ms sleep = 180s, which times out hard. We split the
// work into batches and let the caller run repeatedly with a growing
// offset until has_more=false.
//
// Why hardcoded seed · An earlier version read data/seed-smart-accounts.json
// via runtime fetch from the deployed static asset. That path 1101'd in
// production for reasons we never fully diagnosed (likely a Pages routing
// edge case during cold start). Inlining the array sidesteps it · the
// JSON file is kept in repo as documentation but is no longer read.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import {
  elfaGet, CreditCapReached,
  getCreditsUsedToday, getMonthlyCreditsUsed, getMonthlyCreditCap,
} from '../_shared/elfa.js';

// ─── Constants ──────────────────────────────────────────────────────────
const PER_CALL_SLEEP_MS = 600;
const RECHECK_AFTER_S   = 30 * 24 * 60 * 60;   // 30 days
const SMART_THRESHOLD   = 30;
const DEFAULT_BATCH     = 50;
const MAX_BATCH         = 80;

// ─── Seed list ──────────────────────────────────────────────────────────
// Source of truth for the curated DeSci roster. Sorted alphabetically
// (case-insensitive) for stable diffs. Keep data/seed-smart-accounts.json
// in sync if you edit this · the JSON copy is the human-readable mirror.
const SEED_ACCOUNTS = [
  '_cutbank', '_eshabora', '_WaterDAO', '0xfishylosopher', '0xidanlevin',
  '1kxnetwork', '60Forward', 'a_m_mastroianni', 'abakhus', 'acoerco',
  'AdamDraper', 'AdamGoyer', 'adaugelli', 'AgentBILLNYE', 'ahkyee',
  'AimedisGlobal', 'aitherick', 'aloktayi', 'Amino_Chain', 'amol',
  'anagenxyz', 'andrew_bakst', 'AndrewHemingway', 'andreypnfrv',
  'AntidoteDAO', 'antitokens', 'AntsReview', 'AQGenesis', 'arshiamalek_',
  'artan_bio', 'arxiv_sh', 'aryelipman', 'AsteraInstitute', 'asteriskdao',
  'athenabiorg', 'Aura_Sci', 'aweissman', 'awrigh01', 'AxonDAO',
  'BacalhauProject', 'beakerdao', 'BeeARDai', 'bel_kepson', 'benjileibo',
  'bio_hacker_dao', 'BIOACC_SOL_CTO', 'biofoundershq', 'bionicdao_',
  'BioProtocol', 'BitDoctorAI', 'blockchainmuic', 'blueyard', 'bmagierski',
  'BoostVC', 'BowTiedBiotech', 'BrackLab', 'brett_cornick', 'brian_armstrong',
  'bryan_johnson', 'carlaostmann', 'catalyst_xyz', 'CausalityNet',
  'ceeceeboom', 'cerbivore', 'Cerebrum_DAO', 'chadfowler', 'ChatDKG',
  'CherryVentures', 'chrisleiter_', 'circularweb3', 'clinamenic',
  'CounterpartsDAO', 'crdntwrk', 'CrowdFundedCure', 'crunchDAO', 'cryodao',
  'CudisWellness', 'cure_dao', 'CurlyJungleJake', 'cyber_skald',
  'DanverChandler', 'dao_sleep', 'daohydra', 'DARMACapital', 'darrenzhu',
  'DataLakeToken', 'david_enim', 'db_dao', 'DeSci_Agents', 'DeSci_Girl',
  'desci_global', 'desci_hub', 'DeSciAfrica', 'DeSciAlliance', 'DeSciAsia',
  'DeSciBerlin', 'DeSciChatter', 'DeSciCollective', 'desciers', 'descieth',
  'DesciFoundation', 'DeSciIndia', 'DeSciJapan', 'DeSciLabs', 'DeSciLATAM',
  'DesciLondon', 'DeSciMic', 'DeSciTokyo', 'DesciWeekly', 'DeSciWorld',
  'DeSciYouths', 'DiabetesDAO', 'dnahussey', 'dongossen', 'dynexcoin',
  'Elata_Bio', 'emiyazono', 'endpointarena', 'endrarediseases',
  'ErectusDAO', 'erik_vanwinkle', 'erinmdahl', 'eticaprotocol', 'EzanneTess',
  'fabian_0x', 'fiftyyears', 'flow_science', 'FrontierDAO', 'Fundesci',
  'GainForestNow', 'GaleonCare', 'genobank_io', 'GenomeFi', 'GenpulseAI',
  'getbabyxyz', 'gethealthready', 'ghostwasabii', 'Giveth', 'GolatoTyler',
  'GridcoinNetwork', 'griffgreen', 'gwei_sha', 'HADeSHealth', 'HealthSci_AI',
  'hebbianloop', 'Helice_H', 'HeyChristopher', 'Hippo_Protocol', 'holkexyz',
  'humntech', 'HydraVentures_', 'HYPRINF', 'imprnt_ai', 'inakib',
  'inference_labs', 'inflection_fund', 'InnBioresearch', 'itzjoshuajake',
  'ivangbi_', 'jakub_smekal', 'jamessinka', 'JaneSparking', 'JasonBardi',
  'JasonSoraVC', 'jb87ua', 'jeffyfish9', 'JelaniC3', 'JellyfishDAO',
  'JennyCo_inc', 'johncumbers', 'joycesticks', 'jssh___', 'JustOneGiantLab',
  'khantext_1', 'kulesatony', 'L1D_xyz', 'lab_dao', 'LauraMinquini',
  'LifeNetwork_AI', 'Lilypad_Tech', 'longcovidlabs', 'longevion',
  'longevist_xyz', 'lukasweidener', 'lunar_vc', 'mackenziejem', 'manveerxyz',
  'MattGueniffey', 'MattPRD', 'maxplanckpress', 'MaxUnfried', 'MeritoNetwork',
  'MesoReefDAO', 'mhdempsey', 'Molecule_sci', 'MoritzW42', 'Muhdohealth',
  'Murad_Sattarov', 'MuseMatrix_', 'NEARFoundation', 'Nema_Lab', 'neuradao',
  'NewAtlantisDAO', 'newscienceorg', 'Niklas_TR', 'nikokatsuyoshi',
  'NiomeAI', 'nobleblocks', 'nosignul', 'odonoghuepete', 'OfficialMoonDAO',
  'onchain_creator', 'opscientia', 'OrangeDAOxyz', 'origin_trail', 'parulia',
  'patricksmalone', 'paulkhls', 'pet3rpan_', 'pete_mathias', 'phagedirectory',
  'pierskicks', 'PKoellinger', 'PoSciDonDAO', 'PossibleVC', 'pridesai',
  'priva_xyz', 'privateAIcom', 'proots_desci', 'protocollabs', 'ProtoResearch',
  'psy_dao', 'psychofaunanaut', 'publed_official', 'pumpdotscience',
  'quantdotbond', 'QuantumBioEco', 'QURE_systems', 'QwQiao', 'Rejuve_AI',
  'ReputableDAO', 'ResearchHub', 'ResearchHubF', 'rivatez', 'RushiDTrivedi',
  'sci2sci_com', 'science_b0', 'ScienceStanley', 'ScieNFT', 'SciHubFans',
  'SCINET_INC', 'sdimantha', 'sebastian_gero', 'Shamburgularara',
  'ShineCapitalNYC', 'sjdedic', 'Skymapperspace', 'SoraVentures',
  'StadiumScience_', 'stadolf', 'stevenemassey', 'symbiontlabs', 'T_L_D_R',
  'talentDAO_', 'tannedoaksprout', 'TBDeSci', 'teamrymedi', 'ThatMrE',
  'The_Babylonians', 'thealbertanis', 'TheDesciAcademy', 'TheDeSciPodcast',
  'theNerdLabs', 'tigfoundation', 'timrpeterson', 'transhumancoin',
  'trentmc0', 'triplicate_xyz', 'tsotchkecorp', 'tuum_io', 'UltraRareBio',
  'Un__commons', 'UnboundScience', 'uselateral', 'valley_dao',
  'VerbinnenAndrew', 'vibe_cap', 'VibeBio', 'vincentweisser', 'vitadao',
  'VvfitVv', 'waterbear_sci', 'WeavechainWeb3', 'webisopen', 'welsharehealth',
  'yawnxyz', 'yesnoerror', 'yzilabs', 'zacxbt', 'ZayaAI_PathDx', 'zee_jnsp',
  'ZeePrimeCap', 'zile_cao',
];

// ─── Handler ────────────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ ok: false, error: 'D1 binding DB not configured' });

  // Top-level guard · any unexpected throw bubbles up here, where we
  // 1) try to record it on the run log, and 2) return a 200 with details
  // so the caller doesn't have to dig through Cloudflare logs to debug.
  const startedAt = Math.floor(Date.now() / 1000);
  let runLogId = null;

  try {
    // Parse query params · clamp to safe ranges.
    const url = new URL(request.url);
    const batchRaw = Number(url.searchParams.get('batch'));
    const offsetRaw = Number(url.searchParams.get('offset'));
    const batch = Number.isFinite(batchRaw)
      ? Math.min(MAX_BATCH, Math.max(1, Math.floor(batchRaw)))
      : DEFAULT_BATCH;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0
      ? Math.floor(offsetRaw)
      : 0;

    const slice = SEED_ACCOUNTS.slice(offset, offset + batch);
    const nextOffset = offset + batch;
    const hasMore = nextOffset < SEED_ACCOUNTS.length;

    // Open a roster_run_log row up front. If this fails we still
    // continue · the run log is observability, not correctness.
    runLogId = await openRunLog(env, startedAt, 'seed');

    // Pre-fetch known rows for this batch in one query so we know which
    // handles are due for a (re)check. Case-insensitive match.
    const known = await loadKnownRows(env, slice);

    // ─── Per-account loop ───────────────────────────────────────────
    let accountsChecked = 0;
    let accountsAdded = 0;
    let accountsMarkedSmart = 0;
    let errors = 0;
    let capReached = false;
    const creditsBefore = await safeGetCreditsUsedToday(env);
    const perAccount = [];

    for (let i = 0; i < slice.length; i++) {
      const username = slice[i];
      if (typeof username !== 'string' || !username) continue;

      const lc = username.toLowerCase();
      const existing = known.get(lc);
      const lastChecked = existing?.last_checked_at ? Number(existing.last_checked_at) : 0;
      const dueForCheck = !existing || (startedAt - lastChecked) > RECHECK_AFTER_S;
      if (!dueForCheck) {
        perAccount.push({ username, status: 'skipped-fresh' });
        continue;
      }

      if (accountsChecked > 0) {
        try { await sleep(PER_CALL_SLEEP_MS); } catch { /* swallow */ }
      }

      // ── Smart-stats fetch ─────────────────────────────────────────
      let data, fetchErr = null;
      try {
        data = await elfaGet(env, '/v2/account/smart-stats', { username });
      } catch (e) {
        if (e instanceof CreditCapReached) {
          capReached = true;
          perAccount.push({ username, status: 'cap-reached' });
          break;
        }
        fetchErr = e;
      }

      if (fetchErr) {
        errors++;
        const status = fetchErr?.status;
        const msg = String(fetchErr?.message || fetchErr).slice(0, 200);
        const checkStatus = status === 404 ? 'not_found' : 'error';
        try {
          await upsertAccount(env, {
            username,
            smart_followers_count: null,
            follower_count: null,
            following_count: null,
            engagement_rate: null,
            is_smart: 0,
            source: existing?.source || 'seed',
            first_seen_at: existing ? null : startedAt,
            last_checked_at: startedAt,
            check_status: checkStatus,
            raw_json: safeStringify({ error: msg, status }, 1000),
          }, !!existing);
        } catch (dbErr) {
          console.warn(`build-smart-roster ${username}: error-row upsert failed`, dbErr);
        }
        perAccount.push({ username, status: checkStatus, error: msg });
        continue;
      }

      // ── Parse smart-stats response ────────────────────────────────
      let stats;
      try {
        stats = extractSmartStats(data);
      } catch (e) {
        errors++;
        const msg = String(e?.message || e).slice(0, 200);
        try {
          await upsertAccount(env, {
            username,
            smart_followers_count: null,
            follower_count: null,
            following_count: null,
            engagement_rate: null,
            is_smart: 0,
            source: existing?.source || 'seed',
            first_seen_at: existing ? null : startedAt,
            last_checked_at: startedAt,
            check_status: 'parse-error',
            raw_json: safeStringify({ error: msg, raw: data }, 4000),
          }, !!existing);
        } catch (dbErr) {
          console.warn(`build-smart-roster ${username}: parse-error upsert failed`, dbErr);
        }
        perAccount.push({ username, status: 'parse-error', error: msg });
        continue;
      }

      const isSmart = (stats.smart_followers_count || 0) > SMART_THRESHOLD ? 1 : 0;

      // ── D1 upsert ─────────────────────────────────────────────────
      try {
        await upsertAccount(env, {
          username,
          smart_followers_count: stats.smart_followers_count,
          follower_count: stats.follower_count,
          following_count: stats.following_count,
          engagement_rate: stats.engagement_rate,
          is_smart: isSmart,
          source: existing?.source || 'seed',
          first_seen_at: existing ? null : startedAt,
          last_checked_at: startedAt,
          check_status: 'ok',
          raw_json: safeStringify(data, 16_000),
        }, !!existing);
        accountsChecked++;
        if (!existing) accountsAdded++;
        if (isSmart) accountsMarkedSmart++;
        perAccount.push({
          username,
          status: 'ok',
          smart_followers_count: stats.smart_followers_count,
          is_smart: isSmart,
        });
      } catch (dbErr) {
        errors++;
        const msg = String(dbErr?.message || dbErr).slice(0, 200);
        console.warn(`build-smart-roster ${username}: upsert failed`, msg);
        perAccount.push({ username, status: 'db-error', error: msg });
      }
    }

    // ─── Wrap up ────────────────────────────────────────────────────
    const creditsAfter = await safeGetCreditsUsedToday(env);
    const creditsSpent = Math.max(0, creditsAfter - creditsBefore);

    await closeRunLog(env, runLogId, {
      ended_at: Math.floor(Date.now() / 1000),
      accounts_checked: accountsChecked,
      accounts_added: accountsAdded,
      accounts_marked_smart: accountsMarkedSmart,
      credits_spent: creditsSpent,
      errors,
    });

    let creditsUsedMonth = 0;
    let creditsRemaining = null;
    try {
      creditsUsedMonth = await getMonthlyCreditsUsed(env);
      creditsRemaining = Math.max(0, getMonthlyCreditCap() - creditsUsedMonth);
    } catch { /* swallow */ }

    return jsonResponse({
      ok: !capReached,
      startedAt,
      total_seed: SEED_ACCOUNTS.length,
      offset,
      batch,
      next_offset: nextOffset,
      has_more: hasMore && !capReached,
      processed: slice.length,
      successes: accountsChecked,
      failures: errors,
      marked_smart: accountsMarkedSmart,
      credits_used_today: creditsAfter,
      credits_used: creditsSpent,
      credits_used_this_month: creditsUsedMonth,
      credits_remaining: creditsRemaining,
      capReached,
      per_account: perAccount,
    });
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 500);
    const stack = String(e?.stack || '').slice(0, 1500);
    console.error('build-smart-roster: unhandled', msg, stack);
    if (runLogId) {
      try {
        await env.DB.prepare(
          `UPDATE roster_run_log
              SET ended_at = ?, errors = COALESCE(errors, 0) + 1
            WHERE id = ?`
        ).bind(Math.floor(Date.now() / 1000), runLogId).run();
      } catch { /* swallow · we're already in the failure path */ }
    }
    // Return 200 with error details so the caller can see what happened
    // without checking Cloudflare logs. The `ok: false` is the signal.
    return jsonResponse({
      ok: false,
      startedAt,
      error: msg,
      stack: stack || null,
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeStringify(v, maxLen) {
  try { return JSON.stringify(v).slice(0, maxLen); }
  catch { return null; }
}

async function safeGetCreditsUsedToday(env) {
  try { return await getCreditsUsedToday(env); } catch { return 0; }
}

async function openRunLog(env, startedAt, runType) {
  try {
    const ins = await env.DB.prepare(
      `INSERT INTO roster_run_log (run_type, started_at, errors)
       VALUES (?, ?, 0)`
    ).bind(runType, startedAt).run();
    return ins?.meta?.last_row_id || null;
  } catch (e) {
    console.warn('build-smart-roster: log-open failed', e);
    return null;
  }
}

async function closeRunLog(env, id, fields) {
  if (!id) return;
  try {
    await env.DB.prepare(
      `UPDATE roster_run_log
          SET ended_at = ?, accounts_checked = ?, accounts_added = ?,
              accounts_marked_smart = ?, credits_spent = ?, errors = ?
        WHERE id = ?`
    ).bind(
      fields.ended_at,
      fields.accounts_checked,
      fields.accounts_added,
      fields.accounts_marked_smart,
      fields.credits_spent,
      fields.errors,
      id,
    ).run();
  } catch (e) {
    console.warn('build-smart-roster: log-close failed', e);
  }
}

async function loadKnownRows(env, slice) {
  const known = new Map();
  if (!slice.length) return known;
  try {
    const lower = slice.map(s => String(s).toLowerCase());
    const placeholders = lower.map(() => '?').join(',');
    const rows = (await env.DB.prepare(
      `SELECT username, last_checked_at, check_status, source
         FROM smart_accounts
        WHERE LOWER(username) IN (${placeholders})`
    ).bind(...lower).all()).results || [];
    for (const r of rows) known.set(String(r.username).toLowerCase(), r);
  } catch (e) {
    console.warn('build-smart-roster: known-row preload failed', e);
  }
  return known;
}

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
