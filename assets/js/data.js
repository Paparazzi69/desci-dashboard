// Editorial token metadata, keyed by CoinGecko id.
// Symbol/name/logo/price come from the API — never hardcoded here.
// Only keep classification (focus, tags, chain hint, twitter handle) and the
// micro-cap flag for tokens that need the μ treatment.
//
// Adding a token: append its CoinGecko id to TOKEN_IDS, add a metadata entry.
// Removing CoinGecko-tracked tokens that don't have entries here just means
// they render with default classification ("Uncategorized" / blue).

// NOTE: this client-side list is currently unused by app.js (which iterates
// state.tokens from /api/prices directly). Kept for documentation parity
// with the server-side TOKEN_IDS in functions/_shared.js — same ids except
// AUBRAI which is fetched via GeckoTerminal (id 'aubrai', see GT_TOKENS).
export const TOKEN_IDS = [
  'bio-protocol',
  'vitadao',
  'origintrail',
  'researchcoin',
  'rifampicin',
  'vitarna',
  'cryodao',
  'hairdao',
  'aubrai',
  'syna',
  // 2026-05-27 batch
  'cerebrum-dao',
  'valleydao',
  'athenadao',
  'axondao-governance-token',
  'urolithin-a',
  'curetopia',
  'biomeai',
  'psydao',
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
    // Project rebranded its X handle in May 2026: HairDAO_ → anagenxyz.
    twitter: 'anagenxyz', website: 'hairdao.xyz',
  },
  // Key matches GeckoTerminal id ('aubrai') in _shared.js GT_TOKENS.
  // Was 'aubrai-by-bio' (CoinGecko id) until dedupe-token-index PR dropped
  // the CG fetch for AUBRAI to avoid double-listing it in the Token Index.
  'aubrai': {
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
  // ── 2026-05-27 batch: 8 additional DeSci tokens (>$100K mcap) ──
  'cerebrum-dao': {
    focus: 'Brain Health', focusColor: 'amber',
    tags: ['Longevity', 'IP-NFT'], chain: 'ETH',
    twitter: 'CerebrumDAO', website: 'cerebrumdao.com',
  },
  'valleydao': {
    focus: 'Synbio', focusColor: 'green',
    tags: ['Drug Discovery'], chain: 'ETH',
    twitter: 'valley_dao', website: 'valleydao.com',
  },
  'athenadao': {
    focus: 'Women’s Health', focusColor: 'red',
    tags: ['Drug Discovery', 'IP-NFT'], chain: 'ETH',
    twitter: 'AthenaDAO_', website: 'athenadao.co',
  },
  'axondao-governance-token': {
    focus: 'Biomedical Data', focusColor: 'blue',
    tags: ['AI-DeSci'], chain: 'ETH',
    twitter: 'AxonDAO', website: 'axondao.io',
  },
  'urolithin-a': {
    focus: 'Drug Discovery', focusColor: 'blue',
    tags: ['Drug Discovery', 'Longevity'], chain: 'SOL',
    twitter: 'pumpdotscience', website: 'pump.science',
  },
  'curetopia': {
    focus: 'Rare Disease', focusColor: 'amber',
    tags: ['IP-NFT', 'Drug Discovery'], chain: 'SOL',
    twitter: 'CuretopiaDAO', website: 'curetopia.bio',
  },
  'biomeai': {
    focus: 'Microbiome', focusColor: 'green',
    tags: ['AI-DeSci', 'Longevity'], chain: 'BASE',
    twitter: 'biomeai_', website: 'biome.ai',
  },
  'psydao': {
    focus: 'Psychedelics', focusColor: 'amber',
    tags: ['Drug Discovery', 'IP-NFT'], chain: 'ETH',
    twitter: 'psy_dao', website: 'psydao.io',
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
