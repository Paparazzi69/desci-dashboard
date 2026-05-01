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
  'cryodao',
  'hairdao',
  'aubrai-by-bio',
  'syna',
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
    twitter: null, website: 'pump.science',
  },
  'vitarna': {
    focus: 'RNA Research', focusColor: 'green',
    tags: ['RNA Research', 'Longevity'], chain: 'ETH',
    twitter: null, website: 'vitarna.xyz',
  },
  'cryodao': {
    focus: 'Cryonics', focusColor: 'blue',
    tags: ['Longevity'], chain: 'ETH',
    twitter: null, website: 'cryodao.org',
  },
  'hairdao': {
    focus: 'Dermatology', focusColor: 'red',
    tags: ['Drug Discovery'], chain: 'ETH',
    twitter: 'HairDAO_', website: 'hairdao.xyz',
  },
  'aubrai-by-bio': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'AI-DeSci'], chain: 'BASE',
    twitter: 'Aubrai_', website: 'aubr.ai',
  },
  'syna': {
    focus: 'AI-DeSci', focusColor: 'green',
    tags: ['AI-DeSci', 'Biotech Infra'], chain: 'SOL',
    twitter: 'synapseneuro_ai', website: 'synapseneuro.org',
    customImage: '/assets/images/syna.jpg',
    trade: 'https://kickstart.easya.io/token/HA4WtRuNrjtrzAWTTjCyTZn94Jq9ggV6iraW7SndSLyz',
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
  'All', 'Longevity', 'RNA Research',
  'Drug Discovery', 'IP-NFT', 'AI-DeSci',
];
