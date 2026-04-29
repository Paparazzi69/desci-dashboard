// GET /api/coin/:id
// Drawer detail endpoint. Proxies CoinGecko /coins/{id} and returns a compact
// shape (description + extended stats) cached for 5 minutes per id.
//
// Mocked Solana micro-caps short-circuit to MOCK_DETAIL — they have no real
// CoinGecko entries yet.

import { MOCK_DETAIL, jsonResponse, kvGet, kvPut } from '../../_shared.js';

const TTL_S = 5 * 60;

export async function onRequest({ env, params }) {
  const id = params.id;
  if (!id) return jsonResponse({ error: 'missing id' }, 400);

  if (MOCK_DETAIL[id]) {
    return jsonResponse(MOCK_DETAIL[id]);
  }

  const cacheKey = `coin:${id}:v1`;
  const cached = await kvGet(env, cacheKey);
  if (cached) return jsonResponse(cached);

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}`
      + `?localization=false`
      + `&tickers=false`
      + `&market_data=true`
      + `&community_data=false`
      + `&developer_data=false`
      + `&sparkline=true`;
    const headers = { 'accept': 'application/json' };
    if (env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;

    const r = await fetch(url, { headers });
    if (!r.ok) {
      // Stale cache check — if we have anything stored, serve it.
      const stale = await kvGet(env, cacheKey + ':stale');
      if (stale) return jsonResponse({ ...stale, stale: true });
      return jsonResponse({ error: `CoinGecko ${r.status}` }, 502);
    }
    const data = await r.json();
    const platforms = data.platforms || {};
    const ethAddr = platforms['ethereum'];
    const solAddr = platforms['solana'];
    const contract = ethAddr || solAddr || null;
    const contractUrl = ethAddr
      ? `https://etherscan.io/token/${ethAddr}`
      : solAddr
        ? `https://solscan.io/token/${solAddr}`
        : null;

    const payload = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      description: (data.description && data.description.en) || '',
      sparkline_7d: (data.market_data && data.market_data.sparkline_7d && data.market_data.sparkline_7d.price) || [],
      fdv: data.market_data?.fully_diluted_valuation?.usd ?? null,
      ath: data.market_data?.ath?.usd ?? null,
      atl: data.market_data?.atl?.usd ?? null,
      contract,
      contractUrl,
    };
    await kvPut(env, cacheKey, payload, TTL_S);
    await kvPut(env, cacheKey + ':stale', payload, 60 * 60); // 1h stale safety net
    return jsonResponse(payload);
  } catch (err) {
    const stale = await kvGet(env, cacheKey + ':stale');
    if (stale) return jsonResponse({ ...stale, stale: true });
    return jsonResponse({ error: String(err.message || err) }, 502);
  }
}
