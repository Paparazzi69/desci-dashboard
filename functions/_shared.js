// Shared helpers for Pages Functions.

// CoinGecko-listed tokens. The /api/prices endpoint queries CoinGecko's
// /coins/markets for these ids in a single call.
export const TOKEN_IDS = [
  'bio-protocol', 'vitadao', 'origintrail', 'researchcoin',
  'rifampicin', 'vitarna', 'urolithin-a', 'cryodao', 'hairdao',
];

// Tokens not on CoinGecko but live on Solana DEX pools — fetched from
// GeckoTerminal (CoinGecko's on-chain DEX product, free, no key needed).
// Map id (matches frontend TOKEN_META key) → Solana token contract address.
export const GT_TOKENS = {
  'syna': 'HA4WtRuNrjtrzAWTTjCyTZn94Jq9ggV6iraW7SndSLyz',
};

// Hardcoded mock data for the two Solana micro-caps. Returned alongside real
// CoinGecko results so the frontend gets one uniform array.
// TODO: replace with live Solana data once contract addresses are confirmed.
export const MOCK_MICROCAPS = [
  {
    id: 'mock-neuq',
    symbol: 'neuq',
    name: 'NeuralDAO',
    image: null,
    price: 0.000312,
    d1: 21.4,
    d7: 44.8,
    mcap: 89_000,
    vol: 34_200,
    spark: [0.000188, 0.000195, 0.000201, 0.000224, 0.000218, 0.000241, 0.000258, 0.000270, 0.000261, 0.000279, 0.000288, 0.000295, 0.000309, 0.000312],
    isMicroCap: true,
  },
  {
    id: 'mock-synp',
    symbol: 'synp',
    name: 'SynapseProtocol',
    image: null,
    price: 0.00187,
    d1: -8.2,
    d7: 12.1,
    mcap: 134_000,
    vol: 61_400,
    spark: [0.00142, 0.00149, 0.00158, 0.00154, 0.00161, 0.00169, 0.00163, 0.00171, 0.00178, 0.00175, 0.00181, 0.00186, 0.00191, 0.00187],
    isMicroCap: true,
  },
];

export const MOCK_DETAIL = {
  'mock-neuq': {
    sparkline_7d: [0.000188, 0.000195, 0.000201, 0.000224, 0.000218, 0.000241, 0.000258, 0.000270, 0.000261, 0.000279, 0.000288, 0.000295, 0.000309, 0.000312],
    fdv: 156_000,
    ath: 0.00071,
    atl: 0.0000088,
    description: 'NeuralDAO is an early-stage Solana-native DeSci project funding decentralized neurodegenerative-disease research. As a placeholder, this token is mocked until a live Solana data source is wired in.',
  },
  'mock-synp': {
    sparkline_7d: [0.00142, 0.00149, 0.00158, 0.00154, 0.00161, 0.00169, 0.00163, 0.00171, 0.00178, 0.00175, 0.00181, 0.00186, 0.00191, 0.00187],
    fdv: 220_000,
    ath: 0.00441,
    atl: 0.000071,
    description: 'SynapseProtocol is a Solana-based AI × DeSci coordination layer. Mocked here as a placeholder pending live data integration.',
  },
  // GeckoTerminal tokens get live price/spark/fdv from GT, but descriptions
  // are editorial — GT doesn't surface them. Keep the description here and
  // merge with live GT data in /api/coin/[id].js.
  'syna': {
    description: 'Synapse is a user-owned physiological data layer aggregating wearable and clinical data — sleep, recovery, training, body composition, and lifestyle signals — into a single scientist-reviewed dashboard. Users retain ownership of their data and choose what to share with researchers.\n\nPowered by SYNA token, the network coordinates incentives between data contributors and researchers requesting access. Token holders govern protocol direction through Synapse DAO, with emissions tied to contribution quality and research demand.\n\nCurrently in MVP phase with active integrations for Apple Health and Garmin, expanding to multimodal data (EEG, clinical records) and pilot research collaborations through 2026.',
    contract: 'HA4WtRuNrjtrzAWTTjCyTZn94Jq9ggV6iraW7SndSLyz',
    contractUrl: 'https://solscan.io/token/HA4WtRuNrjtrzAWTTjCyTZn94Jq9ggV6iraW7SndSLyz',
  },
};

// ---------- GeckoTerminal helpers ----------
//
// GT exposes on-chain DEX data for any Solana token by contract address.
// Free public API, no key, soft limit of ~30 req/min — well under what we
// need given the KV cache layer.

const GT_API = 'https://api.geckoterminal.com/api/v2';

async function gtFetch(path) {
  const r = await fetch(GT_API + path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`GeckoTerminal ${r.status} for ${path}`);
  return r.json();
}

// Fetch token metadata + top-pool OHLCV in parallel-friendly form.
// OHLCV rows come back newest-first as [timestamp, open, high, low, close, vol].
async function fetchGtRaw(address) {
  const tokenRes = await gtFetch(`/networks/solana/tokens/${address}`);
  const attrs = tokenRes.data?.attributes || {};
  const topPoolRel = tokenRes.data?.relationships?.top_pools?.data?.[0]?.id;
  // Pool ids look like "solana_<addr>" — strip the network prefix.
  const poolAddr = topPoolRel ? topPoolRel.replace(/^solana_/, '') : null;

  let ohlcv = [];
  if (poolAddr) {
    try {
      // limit=60 covers ~2 months of daily history — enough for ATH/ATL on
      // recently-launched tokens. Larger limits are accepted but pointless.
      const ohlcvRes = await gtFetch(
        `/networks/solana/pools/${poolAddr}/ohlcv/day?aggregate=1&limit=60`
      );
      ohlcv = ohlcvRes.data?.attributes?.ohlcv_list || [];
    } catch (e) {
      // Pool OHLCV fetch is best-effort — token info alone is still useful.
      console.warn('GT OHLCV fetch failed', e);
    }
  }
  return { attrs, ohlcv };
}

// Map a GeckoTerminal OHLCV list (newest-first) into ascending close prices,
// plus high/low arrays for ATH/ATL approximation.
function ohlcvSeries(ohlcv) {
  const asc = ohlcv.slice().reverse();
  return {
    closes: asc.map(c => Number(c[4])).filter(n => Number.isFinite(n)),
    highs: asc.map(c => Number(c[2])).filter(n => Number.isFinite(n)),
    lows: asc.map(c => Number(c[3])).filter(n => Number.isFinite(n)),
  };
}

// Returns a token entry shaped like CoinGecko /coins/markets output, suitable
// for /api/prices. d1/d7 are computed from daily-candle closes, so d1 means
// "vs previous calendar-day close" not a sliding 24h window — close enough
// for the dashboard.
export async function fetchGeckoTerminalToken(id, address) {
  const { attrs, ohlcv } = await fetchGtRaw(address);
  const { closes } = ohlcvSeries(ohlcv);
  const last = closes.length ? closes[closes.length - 1] : null;
  const d1 = closes.length >= 2
    ? ((last - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
    : null;
  const d7 = closes.length >= 8
    ? ((last - closes[closes.length - 8]) / closes[closes.length - 8]) * 100
    : null;
  return {
    id,
    symbol: (attrs.symbol || '').toLowerCase(),
    name: attrs.name || id,
    image: attrs.image_url || null,
    price: Number(attrs.price_usd) || null,
    d1,
    d7,
    // GT often returns market_cap_usd:null for new tokens — fall back to FDV
    // so the table never shows a blank cell.
    mcap: Number(attrs.market_cap_usd ?? attrs.fdv_usd) || null,
    vol: Number(attrs.volume_usd?.h24) || null,
    spark: closes,
    isMicroCap: false,
    source: 'geckoterminal',
  };
}

// Drawer detail shape — sparkline + fdv + ATH/ATL. Description is merged
// from MOCK_DETAIL by the caller (GT has no token descriptions).
export async function fetchGeckoTerminalDetail(address) {
  const { attrs, ohlcv } = await fetchGtRaw(address);
  const { closes, highs, lows } = ohlcvSeries(ohlcv);
  return {
    sparkline_7d: closes,
    fdv: Number(attrs.fdv_usd) || null,
    // ATH/ATL are within the OHLCV window (~60 days). For tokens that just
    // graduated from a launchpad this is effectively "since launch", which
    // is what we want.
    ath: highs.length ? Math.max(...highs) : null,
    atl: lows.length ? Math.min(...lows) : null,
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30',
      'access-control-allow-origin': '*',
      ...extraHeaders,
    },
  });
}

// Read a JSON value from KV; tolerate corrupt entries by returning null.
export async function kvGet(env, key) {
  if (!env.CACHE) return null;
  try { return await env.CACHE.get(key, 'json'); } catch { return null; }
}

// Write a JSON value to KV with a TTL. Pages KV requires a min ttl of 60s.
export async function kvPut(env, key, value, ttlSeconds) {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(value), {
      expirationTtl: Math.max(60, ttlSeconds),
    });
  } catch (e) {
    console.warn('KV put failed', e);
  }
}
