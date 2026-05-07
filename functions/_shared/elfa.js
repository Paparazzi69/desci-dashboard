// Elfa AI client. Single ingress for every Elfa request so we can:
//   1. Enforce the monthly 19,500-credit soft cap (the bonus pool expires
//      2026-05-31 and we don't want to silently roll into PAYG billing).
//   2. Log every call (success or failure) into elfa_credit_log for the
//      admin dashboard and snapshot diagnostics.
//   3. Honor 429 Retry-After once before giving up.
//
// All other code MUST go through elfaGet or elfaPost · no direct fetch
// to api.elfa.ai elsewhere in the repo. The cap and the audit trail
// depend on it.

const ELFA_BASE = 'https://api.elfa.ai';

// Endpoints that cost more than the default 1 credit per call. Source:
// Elfa pricing docs and conservative estimates for new endpoints. Refine
// after a snapshot run lets us see the actual usage delta.
const HIGH_COST_ENDPOINTS = new Set([
  '/v2/data/trending-narratives',
  '/v2/data/event-summary',
  '/v2/chat',
  '/v2/auto-chat',
]);

// Soft cap. We have 20,000 bonus credits expiring 2026-05-31. We stop at
// 19,500 to leave a small headroom for ad-hoc admin calls and to avoid
// any chance of crossing into PAYG billing on a clock-skew edge case.
const MONTHLY_CREDIT_CAP = 19500;

// Default fetch timeout. /v2/chat is slow (5-15s typical) so callers can
// override; the default suits low-latency GETs.
const DEFAULT_TIMEOUT_MS = 15_000;

export class CreditCapReached extends Error {
  constructor(used) {
    super(`Elfa monthly credit cap reached (${used} >= ${MONTHLY_CREDIT_CAP})`);
    this.name = 'CreditCapReached';
    this.used = used;
  }
}

// Sum of credits_used in elfa_credit_log since the start of the current
// UTC month. Cheap query · idx_credit_log_called_at covers it.
export async function getMonthlyCreditsUsed(env) {
  if (!env.DB) return 0;
  const monthStart = utcMonthStartUnix();
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(credits_used), 0) AS used FROM elfa_credit_log WHERE called_at >= ?'
  ).bind(monthStart).first();
  return Number(row?.used || 0);
}

// Sum of credits_used since the start of the current UTC day. Used by
// the snapshot cron to surface a daily burn number in its response.
export async function getCreditsUsedToday(env) {
  if (!env.DB) return 0;
  const dayStart = utcDayStartUnix();
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(credits_used), 0) AS used FROM elfa_credit_log WHERE called_at >= ?'
  ).bind(dayStart).first();
  return Number(row?.used || 0);
}

export function getMonthlyCreditCap() { return MONTHLY_CREDIT_CAP; }

function utcMonthStartUnix() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
}
function utcDayStartUnix() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

function creditCostFor(path) {
  return HIGH_COST_ENDPOINTS.has(path) ? 5 : 1;
}

function buildUrl(path, params) {
  const url = new URL(ELFA_BASE + path);
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function logCall(env, row) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT INTO elfa_credit_log
         (called_at, endpoint, params, credits_used, http_status, success, error_msg)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.called_at,
      row.endpoint,
      row.params,
      row.credits_used,
      row.http_status,
      row.success ? 1 : 0,
      row.error_msg,
    ).run();
  } catch (e) {
    console.warn('elfa: credit log insert failed', e);
  }
}

function fetchWithTimeout(url, init, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// Shared transport. Pre-flight cap check, one 429 retry, defensive logging.
// `requestParams` is the JSON-stringified payload (query params for GET,
// body for POST) recorded into elfa_credit_log.params.
async function executeRequest(env, { method, path, url, init, paramsJson, timeoutMs }) {
  if (!env.ELFA_API_KEY) throw new Error('ELFA_API_KEY env var not set');

  const used = await getMonthlyCreditsUsed(env);
  const cost = creditCostFor(path);
  if (used + cost > MONTHLY_CREDIT_CAP) {
    throw new CreditCapReached(used);
  }

  const calledAt = Math.floor(Date.now() / 1000);
  let res;
  try {
    res = await fetchWithTimeout(url, init, timeoutMs);
  } catch (e) {
    await logCall(env, {
      called_at: calledAt,
      endpoint: path,
      params: paramsJson,
      credits_used: 0,            // network failure · Elfa never billed it
      http_status: null,
      success: false,
      error_msg: (e?.name === 'AbortError' ? 'timeout: ' : '') +
                 String(e?.message || e).slice(0, 500),
    });
    throw e;
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || 2;
    const waitMs = Math.min(Math.max(retryAfter, 1), 30) * 1000;
    await new Promise(r => setTimeout(r, waitMs));
    try {
      res = await fetchWithTimeout(url, init, timeoutMs);
    } catch (e) {
      await logCall(env, {
        called_at: calledAt,
        endpoint: path,
        params: paramsJson,
        credits_used: 0,
        http_status: null,
        success: false,
        error_msg: 'retry-after-fetch-failed: ' + String(e?.message || e).slice(0, 300),
      });
      throw e;
    }
  }

  if (!res.ok) {
    let body = '';
    try { body = (await res.text()).slice(0, 500); } catch { /* swallow */ }
    await logCall(env, {
      called_at: calledAt,
      endpoint: path,
      params: paramsJson,
      // 4xx/5xx still consumes a credit on most APIs · log the cost so
      // the cap stays honest.
      credits_used: cost,
      http_status: res.status,
      success: false,
      error_msg: `HTTP ${res.status}: ${body}`,
    });
    const err = new Error(`Elfa ${res.status} for ${method} ${path}: ${body}`);
    err.status = res.status;
    throw err;
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    await logCall(env, {
      called_at: calledAt,
      endpoint: path,
      params: paramsJson,
      credits_used: cost,
      http_status: res.status,
      success: false,
      error_msg: 'json-parse: ' + String(e?.message || e).slice(0, 300),
    });
    throw e;
  }

  await logCall(env, {
    called_at: calledAt,
    endpoint: path,
    params: paramsJson,
    credits_used: cost,
    http_status: res.status,
    success: true,
    error_msg: null,
  });
  return json;
}

export async function elfaGet(env, path, params = {}, opts = {}) {
  const url = buildUrl(path, params);
  let paramsJson = null;
  try { paramsJson = JSON.stringify(params || {}); } catch { /* ignore */ }
  return executeRequest(env, {
    method: 'GET',
    path,
    url,
    init: {
      method: 'GET',
      headers: {
        'x-elfa-api-key': env.ELFA_API_KEY,
        accept: 'application/json',
      },
    },
    paramsJson,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}

export async function elfaPost(env, path, body = {}, opts = {}) {
  const url = ELFA_BASE + path;
  let paramsJson = null;
  try { paramsJson = JSON.stringify(body || {}).slice(0, 4000); } catch { /* ignore */ }
  return executeRequest(env, {
    method: 'POST',
    path,
    url,
    init: {
      method: 'POST',
      headers: {
        'x-elfa-api-key': env.ELFA_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    },
    paramsJson,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}
