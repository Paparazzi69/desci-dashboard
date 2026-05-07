// Shared list of DeSci projects tracked by the sentiment pipeline.
//
// `display`  · what we render in the UI (project name, e.g. "VitaDAO")
// `keywords` · array of search variants sent to /v2/data/keyword-mentions
//              with searchType=or. Multi-keyword OR is verified to work
//              by the Elfa team · a single project name often misses
//              ticker/handle/lowercase variants. Example:
//              keywords=VitaDAO,vita_dao,$VITA returns ~15x the matches
//              of "VitaDAO" alone in the same window.
// `ticker`   · displayed below the project name as small dim subtext.
//              May be null for projects without a token.
//              Also used as the single-ticker input for /v2/data/token-news
//              in the elfa-news-pulse cron.
//
// Both functions/cron/elfa-snapshot-tokens.js and functions/api/sentiment.js
// import from here so the project list lives in exactly one place.

export const DESCI_PROJECTS = [
  {
    display: 'Bio Protocol',
    keywords: ['$BIO', 'BioProtocol', 'bioprotocol', 'Bio Protocol'],
    ticker: '$BIO',
  },
  {
    display: 'VitaDAO',
    keywords: ['VitaDAO', 'vita_dao', '$VITA'],
    ticker: '$VITA',
  },
  {
    display: 'ResearchHub',
    keywords: ['ResearchHub', '$RSC', 'researchhub'],
    ticker: '$RSC',
  },
  {
    display: 'HairDAO',
    keywords: ['HairDAO', 'HairDAO_', 'hairdao'],
    ticker: '$HAIR',
  },
  {
    display: 'Pump.science',
    keywords: ['Pump.science', 'pumpdotscience', '$URO', '$RIF', 'urolithin', 'rifampicin'],
    ticker: '$URO',
  },
  {
    display: 'AUBRAI',
    keywords: ['AUBRAI', '$AUBRAI', 'Aubrai_'],
    ticker: '$AUBRAI',
  },
  {
    display: 'CryoDAO',
    keywords: ['CryoDAO', 'CryoDAOxyz', '$CRYO'],
    ticker: '$CRYO',
  },
  {
    display: 'CerebrumDAO',
    keywords: ['CerebrumDAO', 'cerebrum_dao', '$NEURON', '$CLAW'],
    ticker: '$NEURON',
  },
  {
    display: 'ValleyDAO',
    keywords: ['ValleyDAO', 'valley_dao', '$GROW'],
    ticker: '$GROW',
  },
  {
    display: 'AthenaDAO',
    keywords: ['AthenaDAO', 'athena_DAO_', 'athenabiorg'],
    ticker: '$ATH',
  },
  {
    display: 'PsyDAO',
    keywords: ['PsyDAO', 'psy_dao', '$PSY'],
    ticker: '$PSY',
  },
  {
    display: 'Molecule',
    keywords: ['Molecule_dao', 'Molecule_sci', 'IP-NFT', 'IPNFT'],
    ticker: '$MOL',
  },
  {
    display: 'PeptAI',
    keywords: ['PeptAI', 'peptai_', '$PEPT'],
    ticker: '$PEPT',
  },
  {
    display: 'BiomeAI',
    keywords: ['BiomeAI', '$BIOMEAI'],
    ticker: '$BIOMEAI',
  },
  {
    display: 'ClawdLab',
    keywords: ['ClawdLab', 'clawdlab'],
    ticker: null,
  },
  {
    display: 'Curetopia',
    keywords: ['Curetopia', '$CURES', 'CURES'],
    ticker: '$CURES',
  },
  {
    display: 'Spectruth DAO',
    keywords: ['Spectruth', 'SpectruthDAO', '$IBNFT', 'Ibonova'],
    ticker: '$IBNFT',
  },
  {
    display: 'DermaLabs',
    keywords: ['DermaLabs', '$SKIN'],
    ticker: '$SKIN',
  },
  {
    display: 'SpineDAO',
    keywords: ['SpineDAO', 'Spine_DAO', '$SPINE'],
    ticker: '$SPINE',
  },
];

// Lookup map keyed by the value we store in elfa_token_snapshots.ticker
// (which is the `display` name). Used by /api/sentiment to merge in
// the ticker subtext without a join.
export const DESCI_PROJECT_BY_DISPLAY = Object.fromEntries(
  DESCI_PROJECTS.map(p => [p.display, p])
);
