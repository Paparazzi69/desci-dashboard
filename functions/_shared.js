// Shared helpers for Pages Functions.

export const TOKEN_IDS = [
  'bio-protocol', 'vitadao', 'origintrail', 'researchcoin',
  'rifampicin', 'vitarna', 'urolithin-a', 'cryodao', 'hairdao',
];

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
  {
    id: 'synapse-neuro',
    symbol: 'syna',
    name: 'Synapse',
    image: null,
    price: 0.00094,
    d1: 5.7,
    d7: 18.3,
    mcap: 76_500,
    vol: 22_800,
    spark: [0.00071, 0.00074, 0.00078, 0.00076, 0.00081, 0.00079, 0.00083, 0.00086, 0.00084, 0.00088, 0.00090, 0.00091, 0.00093, 0.00094],
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
  'synapse-neuro': {
    sparkline_7d: [0.00071, 0.00074, 0.00078, 0.00076, 0.00081, 0.00079, 0.00083, 0.00086, 0.00084, 0.00088, 0.00090, 0.00091, 0.00093, 0.00094],
    fdv: 128_000,
    ath: 0.00211,
    atl: 0.000044,
    contract: 'HA4WtRuNrjtrzAWTTjCyTZn94Jq9ggV6iraW7SndSLyz',
    contractUrl: 'https://solscan.io/token/HA4WtRuNrjtrzAWTTjCyTZn94Jq9ggV6iraW7SndSLyz',
    description: 'Synapse is a user-owned physiological data layer aggregating wearable and clinical data — sleep, recovery, training, body composition, and lifestyle signals — into a single scientist-reviewed dashboard. Users retain ownership of their data and choose what to share with researchers.\n\nPowered by SYNA token, the network coordinates incentives between data contributors and researchers requesting access. Token holders govern protocol direction through Synapse DAO, with emissions tied to contribution quality and research demand.\n\nCurrently in MVP phase with active integrations for Apple Health and Garmin, expanding to multimodal data (EEG, clinical records) and pilot research collaborations through 2026.',
  },
};

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
