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
  // 2026-05-27 batch 2
  'galeon',
  // 2026-05-27 batch 3
  'pythia',
  'nova-3',
  'nanovita',
  // 2026-06-10 batch (Launch Radar): 15 verified DeSci tokens
  'quantum-biology-dao',
  'poscidondao-token',
  'genomesdao-genome',
  'molecules-of-korolchuk-ip-nft',
  'ip-tokens-of-ipnft-129',
  'vitastem',
  'rejuve-ai',
  'data-lake',
  'hydradao',
  'the-innovation-game',
  'yne',
  'cudis',
  'silencio',
  'welshare-health-token',
  'cryorat',
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
  // Galeon lives on BSC (contract 0x1d0ac23f03870f768ca005c84cbb6fb82aa884fd).
  // CoinGecko's /coins/markets is chain-agnostic so we don't need a
  // GeckoTerminal fallback — the BNB badge just renders as a label.
  'galeon': {
    focus: 'Healthcare AI', focusColor: 'blue',
    tags: ['AI-DeSci'], chain: 'BNB',
    twitter: 'Galeon_care', website: 'galeon.care',
  },
  // 2026-05-27 batch 3 — Neiry/Pump.fun rat-brain-AI experiment,
  // listed on Solana but the project itself is neuroscience DeSci.
  'pythia': {
    focus: 'Memetic Science', focusColor: 'amber',
    tags: ['AI-DeSci', 'Drug Discovery'], chain: 'SOL',
    twitter: 'neirylab', website: 'ratpythia.ai',
  },
  // Metanova Labs decentralized drug discovery on Bittensor subnet 68.
  'nova-3': {
    focus: 'Drug Discovery', focusColor: 'blue',
    tags: ['AI-DeSci', 'Drug Discovery'], chain: 'TAO',
    twitter: 'metanova_labs', website: 'metanova-labs.ai',
  },
  // NanoVita AI + nanotech health research on BSC.
  'nanovita': {
    focus: 'AI-DeSci', focusColor: 'green',
    tags: ['AI-DeSci', 'Drug Discovery'], chain: 'BNB',
    twitter: 'Nanovita_Labs', website: 'nanovitalab.com',
  },
  // ── 2026-06-10 batch (Launch Radar): 15 verified DeSci tokens ──
  // Tier 1: BIO/Molecule/VitaDAO-ecosystem DAOs + IP-tokens with named science.
  'quantum-biology-dao': {
    focus: 'Quantum Biology', focusColor: 'purple',
    tags: ['Biotech Infra'], chain: 'ETH',
    twitter: 'QuantumBioDAO', website: 'quantumbiology.xyz',
  },
  'poscidondao-token': {
    focus: 'Precision Medicine', focusColor: 'red',
    tags: ['Drug Discovery', 'IP-NFT'], chain: 'BASE',
    twitter: 'PoSciDonDAO', website: 'poscidondao.com',
  },
  'genomesdao-genome': {
    focus: 'Genomics', focusColor: 'green',
    tags: ['AI-DeSci', 'Biotech Infra'], chain: 'ETH',
    twitter: 'GenomesDAO', website: 'genomes.io',
  },
  // VitaDAO IP-NFT for Dr. Korolchuk's autophagy/longevity research.
  // Symbol VITA-FAST comes from the API; no own X handle, parent is VitaDAO.
  'molecules-of-korolchuk-ip-nft': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'IP-NFT'], chain: 'ETH',
    twitter: 'VitaDAO', website: 'vitadao.com/vita-fast',
  },
  // Percepta IP-Token (Molecule IP-NFT #129, Cerebrum/brain-health botanical).
  'ip-tokens-of-ipnft-129': {
    focus: 'Brain Health', focusColor: 'amber',
    tags: ['IP-NFT', 'Drug Discovery'], chain: 'BASE',
    twitter: 'Neuron_Percepta', website: 'cerebrumdao.com/projects/percepta-brain',
  },
  // AUBRAI stem-cell longevity IP-token (distinct from AUBRAI governance).
  'vitastem': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'AI-DeSci', 'IP-NFT'], chain: 'BASE',
    twitter: 'aubrai_', website: 'app.bio.xyz/ipts/vitastem',
  },
  'rejuve-ai': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'AI-DeSci'], chain: 'ETH',
    twitter: 'Rejuve_AI', website: 'rejuve.ai',
  },
  'data-lake': {
    focus: 'Medical Data', focusColor: 'blue',
    tags: ['AI-DeSci'], chain: 'ETH',
    twitter: 'DataLakeToken', website: 'data-lake.co',
  },
  'hydradao': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity'], chain: 'ETH',
    twitter: 'daohydra', website: 'hydradao.org',
  },
  'the-innovation-game': {
    focus: 'Research Infra', focusColor: 'green',
    tags: ['Biotech Infra', 'AI-DeSci'], chain: 'BASE',
    twitter: 'tigfoundation', website: 'tig.foundation',
  },
  // Tier 2: real-utility, carries a caveat (pump.fun launch / thin science).
  // YNE = AI auditing published papers for errors/fraud; pump.fun-launched on
  // Solana, bridged to Base. Do NOT repeat the unverified Reid Hoffman claim.
  'yne': {
    focus: 'Research Integrity', focusColor: 'green',
    tags: ['AI-DeSci'], chain: 'SOL',
    twitter: 'yesnoerror', website: 'yesnoerror.com',
  },
  // CUDIS = Solana longevity DePIN (smart ring); strong traction, thin
  // research layer vs the consumer-wearable core.
  'cudis': {
    focus: 'Longevity', focusColor: 'amber',
    tags: ['Longevity', 'AI-DeSci'], chain: 'SOL',
    twitter: 'CudisWellness', website: 'cudis.xyz',
  },
  // Silencio = DePIN citizen-science noise-pollution sensing (environmental
  // health, a looser DeSci fit than the biotech peers).
  'silencio': {
    focus: 'Environmental Health', focusColor: 'teal',
    tags: ['AI-DeSci'], chain: 'BASE',
    twitter: 'silencioNetwork', website: 'silencio.network',
  },
  'welshare-health-token': {
    focus: 'Health Data', focusColor: 'blue',
    tags: ['AI-DeSci'], chain: 'ETH',
    twitter: 'welsharehealth', website: 'welshare.health',
  },
  // CryoDAO sub-project funding rat cryopreservation-and-revival research.
  'cryorat': {
    focus: 'Cryonics', focusColor: 'blue',
    tags: ['Longevity'], chain: 'ETH',
    twitter: 'cryodao', website: 'cryorat.com',
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
