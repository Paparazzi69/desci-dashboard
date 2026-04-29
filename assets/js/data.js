// Editorial token metadata, keyed by CoinGecko id.
// Symbol/name/logo/price come from the API — never hardcoded here.
// Only keep classification (focus, tags, chain hint, twitter handle) and the
// micro-cap flag for tokens that need the μ treatment.
//
// Adding a token: append its CoinGecko id to TOKEN_IDS, add a metadata entry.
// Removing CoinGecko-tracked tokens that don't have entries here just means
// they render with default classification ("Uncategorized" / blue).

export const TOKEN_IDS = [
  'bio-protocol',
  'vitadao',
  'origintrail',
  'researchcoin',
  'rifampicin',
  'vitarna',
  'urolithin-a',
  'cryodao',
  'hairdao',
];

export const TOKEN_META = {
  'bio-protocol': {
    focus: 'Biotech Infra', focusColor: 'green',
    tags: ['Biotech Infra', 'IP-NFT'], chain: 'ETH',
    twitter: 'BioProtocol', website: 'bio.xyz',
  },
  'vitadao': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'IP-NFT'], chain: 'ETH',
    twitter: 'VitaDAO', website: 'vitadao.com',
  },
  'origintrail': {
    focus: 'Data Provenance', focusColor: 'blue',
    tags: ['AI-DeSci'], chain: 'ETH',
    twitter: 'origin_trail', website: 'origintrail.io',
  },
  'researchcoin': {
    focus: 'Open Science', focusColor: 'amber',
    tags: ['Biotech Infra'], chain: 'ETH',
    twitter: 'ResearchHub', website: 'researchhub.com',
  },
  'rifampicin': {
    focus: 'Drug Discovery', focusColor: 'blue',
    tags: ['Drug Discovery', 'Longevity'], chain: 'SOL',
    twitter: 'Pump_Science', website: 'pump.science',
  },
  'vitarna': {
    focus: 'RNA Research', focusColor: 'green',
    tags: ['RNA Research', 'Longevity'], chain: 'ETH',
    twitter: 'VitaRNA_DAO', website: 'vitarna.xyz',
  },
  'urolithin-a': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'Drug Discovery'], chain: 'SOL',
    twitter: 'Pump_Science', website: 'pump.science',
  },
  'cryodao': {
    focus: 'Cryonics', focusColor: 'blue',
    tags: ['Longevity'], chain: 'ETH',
    twitter: 'CryoDAO', website: 'cryodao.org',
  },
  'hairdao': {
    focus: 'Dermatology', focusColor: 'red',
    tags: ['Drug Discovery'], chain: 'ETH',
    twitter: 'HairDAO_', website: 'hairdao.xyz',
  },
  // Mocked Solana micro-caps — the server emits these with the same shape as
  // real CoinGecko entries, but flagged isMicroCap=true.
  'mock-neuq': {
    focus: 'Neuro', focusColor: 'purple',
    tags: ['Neuro', 'Micro-caps'], chain: 'SOL',
    twitter: 'NeuralDAO_', website: 'neuraldao.xyz',
    isMicroCap: true,
  },
  'mock-synp': {
    focus: 'AI-DeSci', focusColor: 'purple',
    tags: ['AI-DeSci', 'Neuro', 'Micro-caps'], chain: 'SOL',
    twitter: 'SynapseProto', website: 'synapseprotocol.ai',
    isMicroCap: true,
  },
};

// Default classification when the API surfaces a token we don't have metadata
// for — prevents the UI from going blank on unknown ids.
export const DEFAULT_META = {
  focus: 'Uncategorized', focusColor: 'blue',
  tags: [], chain: '—',
  twitter: null, website: null,
  isMicroCap: false,
};

export function metaFor(id) {
  return TOKEN_META[id] || DEFAULT_META;
}

export const FILTER_CHIPS = [
  'All', 'Longevity', 'RNA Research', 'Neuro',
  'Drug Discovery', 'IP-NFT', 'AI-DeSci', 'Micro-caps',
];
