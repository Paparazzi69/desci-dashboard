// GET /api/prices
// Proxies CoinGecko /coins/markets in a single call with comma-separated ids,
// caches for 60s in KV, and gracefully degrades to stale cache on 429.
//
// Response shape:
//   { tokens: [...], stale: boolean, fetchedAt: ISO string }
// Token shape (matches frontend expectations):
//   { id, symbol, name, image, price, d1, d7, mcap, vol, spark, isMicroCap }

import {
  TOKEN_IDS, GT_TOKENS,
  fetchGeckoTerminalToken,
  jsonResponse, cacheGet, cachePut, kvGetStale, kvRefreshStale,
} from '../_shared.js';

const CACHE_KEY = 'prices:v1';
const FRESH_TTL_S = 300;
// When a GT token had to fall back (or is missing entirely), shorten the
// fresh-cache TTL so we retry sooner instead of locking in an incomplete
// payload for the full 5 minutes.
const FRESH_TTL_DEGRADED_S = 60;
const STALE_KEY = 'prices:stale-v1'; // longer-lived backup for 429 fallback
const STALE_TTL_S = 60 * 30; // keep a half-hour stale safety net

export async function onRequest({ env }) {
  const fresh = await cacheGet(CACHE_KEY);
  if (fresh) {
    return jsonResponse(fresh);
  }

  // Fetch CoinGecko + GeckoTerminal tokens in parallel. GT failures are
  // non-fatal — we still want the CoinGecko results to render even if GT is
  // rate-limiting us.
  const [cgResult, gtResult] = await Promise.all([
    fetchCoinGeckoMarkets(env).then(
      tokens => ({ ok: true, tokens }),
      err => ({ ok: false, err }),
    ),
    fetchAllGtTokens(env),
  ]);

  if (!cgResult.ok) {
    const err = cgResult.err;
    // CoinGecko failed → try the long-lived stale cache.
    const stale = await kvGetStale(env, STALE_KEY);
    if (stale) {
      return jsonResponse({ ...stale, stale: true, error: String(err.message || err) });
    }
    // No cache at all — return mocks + GT (whatever we got) so the UI can
    // render something on first-load failures.
    return jsonResponse({
      tokens: [...gtResult.tokens],
      stale: true,
      error: String(err.message || err),
      fetchedAt: new Date().toISOString(),
    }, 200);
  }

  const merged = [...cgResult.tokens, ...gtResult.tokens];
  const payload = {
    tokens: merged,
    // Stale = data actually missing from payload, NOT just "one GT token
    // came from KV cache". The 30-min KV cache fallback exists exactly so
    // a transient live-fetch failure doesn't degrade the response — the
    // cached values are still recent. Flagging the whole payload stale
    // every time GT rate-limits us produced a permanent STALE pill on the
    // homepage even when prices were correct. anyMissing = true only if
    // a GT token has neither live data nor cache, which is the only
    // case worth signaling to the user.
    stale: gtResult.anyMissing,
    fetchedAt: new Date().toISOString(),
  };
  // If any GT token is missing entirely (no live fetch + no cache fallback),
  // cache for a short TTL so we retry quickly. Otherwise full 5 min.
  const ttl = gtResult.anyMissing ? FRESH_TTL_DEGRADED_S : FRESH_TTL_S;
  await Promise.all([
    cachePut(CACHE_KEY, payload, ttl),
    kvRefreshStale(env, STALE_KEY, payload, STALE_TTL_S),
  ]);
  return jsonResponse(payload);
}

// Fetch all GeckoTerminal tokens in parallel. Each token is independently
// cached in KV (gt-token:<id>:v1, 30 min TTL) so a single transient GT
// failure doesn't drop the token from the prices payload — we fall back to
// the last good cached value. This was the cause of "SYNA disappears for
// 5 minutes at a time" before the fix.
async function fetchAllGtTokens(env) {
  // Skip entries with null addresses — these are placeholder slots for
  // tokens that aren't live yet (e.g. PeptAI pre-Ignition). Calling GT
  // with a null address would throw on every cron tick and clutter logs
  // until the contract address lands in GT_TOKENS.
  const entries = Object.entries(GT_TOKENS).filter(([, addr]) => addr);
  const results = await Promise.all(
    entries.map(async ([id, addr]) => {
      const cacheKey = `gt-token:${id}:v1`;
      try {
        const token = await fetchGeckoTerminalToken(id, addr);
        // Per-token cache is a stale fallback — refresh only when past
        // half its TTL so we don't burn a KV write on every cache miss.
        await kvRefreshStale(env, cacheKey, token, 60 * 30);
        return { token, stale: false, missing: false };
      } catch (e) {
        // Live fetch failed — use last good cached value if any.
        const cached = await kvGetStale(env, cacheKey);
        if (cached) {
          console.warn(`GT live fetch failed for ${id}, serving cache:`, e.message || e);
          return { token: cached, stale: true, missing: false };
        }
        console.warn(`GT live fetch failed for ${id}, no cache:`, e.message || e);
        return { token: null, stale: true, missing: true };
      }
    })
  );
  return {
    tokens: results.map(r => r.token).filter(Boolean),
    anyStale: results.some(r => r.stale),
    anyMissing: results.some(r => r.missing),
  };
}

async function fetchCoinGeckoMarkets(env) {
  const ids = TOKEN_IDS.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets`
    + `?vs_currency=usd`
    + `&ids=${encodeURIComponent(ids)}`
    + `&order=market_cap_desc`
    + `&per_page=50&page=1`
    + `&sparkline=true`
    + `&price_change_percentage=24h%2C7d`;

  const headers = { 'accept': 'application/json' };
  if (env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;

  const r = await fetch(url, { headers });
  if (r.status === 429) {
    const e = new Error('CoinGecko rate-limited (429)');
    e.code = 429;
    throw e;
  }
  if (!r.ok) {
    throw new Error(`CoinGecko ${r.status}`);
  }
  const arr = await r.json();
  // Map to our compact shape — drop fields we don't display.
  return arr.map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    image: c.image || null,
    price: c.current_price ?? null,
    d1: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
    d7: c.price_change_percentage_7d_in_currency ?? null,
    mcap: c.market_cap ?? null,
    vol: c.total_volume ?? null,
    spark: (c.sparkline_in_7d && c.sparkline_in_7d.price) || [],
    isMicroCap: false,
  }));
}
