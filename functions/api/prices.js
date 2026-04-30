// GET /api/prices
// Proxies CoinGecko /coins/markets in a single call with comma-separated ids,
// caches for 60s in KV, and gracefully degrades to stale cache on 429.
//
// Response shape:
//   { tokens: [...], stale: boolean, fetchedAt: ISO string }
// Token shape (matches frontend expectations):
//   { id, symbol, name, image, price, d1, d7, mcap, vol, spark, isMicroCap }

import {
  TOKEN_IDS, MOCK_MICROCAPS, GT_TOKENS,
  fetchGeckoTerminalToken,
  jsonResponse, kvGet, kvPut,
} from '../_shared.js';

const CACHE_KEY = 'prices:v1';
const FRESH_TTL_S = 300;
const STALE_KEY = 'prices:stale-v1'; // longer-lived backup for 429 fallback
const STALE_TTL_S = 60 * 30; // keep a half-hour stale safety net

export async function onRequest({ env }) {
  const fresh = await kvGet(env, CACHE_KEY);
  if (fresh) {
    return jsonResponse(fresh);
  }

  // Fetch CoinGecko + GeckoTerminal tokens in parallel. GT failures are
  // non-fatal — we still want the CoinGecko results to render even if GT is
  // rate-limiting us.
  const [cgResult, gtTokens] = await Promise.all([
    fetchCoinGeckoMarkets(env).then(
      tokens => ({ ok: true, tokens }),
      err => ({ ok: false, err }),
    ),
    fetchAllGtTokens(),
  ]);

  if (!cgResult.ok) {
    const err = cgResult.err;
    // CoinGecko failed → try the long-lived stale cache.
    const stale = await kvGet(env, STALE_KEY);
    if (stale) {
      return jsonResponse({ ...stale, stale: true, error: String(err.message || err) });
    }
    // No cache at all — return mocks + GT (whatever we got) so the UI can
    // render something on first-load failures.
    return jsonResponse({
      tokens: [...gtTokens, ...MOCK_MICROCAPS],
      stale: true,
      error: String(err.message || err),
      fetchedAt: new Date().toISOString(),
    }, 200);
  }

  const merged = [...cgResult.tokens, ...gtTokens, ...MOCK_MICROCAPS];
  const payload = {
    tokens: merged,
    stale: false,
    fetchedAt: new Date().toISOString(),
  };
  await Promise.all([
    kvPut(env, CACHE_KEY, payload, FRESH_TTL_S),
    kvPut(env, STALE_KEY, payload, STALE_TTL_S),
  ]);
  return jsonResponse(payload);
}

// Fetch all GeckoTerminal tokens in parallel. Per-token errors are swallowed
// so one missing token doesn't blank out the others.
async function fetchAllGtTokens() {
  const entries = Object.entries(GT_TOKENS);
  const settled = await Promise.allSettled(
    entries.map(([id, addr]) => fetchGeckoTerminalToken(id, addr))
  );
  return settled
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
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
