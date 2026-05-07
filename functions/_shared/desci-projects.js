// Shared list of DeSci projects tracked by the sentiment pipeline.
//
// `display`  · what we render in the UI (project name, e.g. "VitaDAO")
// `keyword`  · what we send to /v2/data/keyword-mentions. Project names
//              return better-quality results than $tickers (which Elfa's
//              ticker filter has trouble disambiguating from noise).
// `ticker`   · displayed below the project name as small dim subtext.
//              May be null for projects without a token.
//
// Both functions/cron/elfa-snapshot-tokens.js and functions/api/sentiment.js
// import from here so the project list lives in exactly one place.

export const DESCI_PROJECTS = [
  { display: 'Bio Protocol',   keyword: '$BIO',          ticker: '$BIO' },
  { display: 'VitaDAO',        keyword: 'VitaDAO',       ticker: '$VITA' },
  { display: 'ResearchHub',    keyword: 'ResearchHub',   ticker: '$RSC' },
  { display: 'HairDAO',        keyword: 'HairDAO',       ticker: '$HAIR' },
  { display: 'Pump.science',   keyword: 'Pump.science',  ticker: '$URO' },
  { display: 'AUBRAI',         keyword: 'AUBRAI',        ticker: '$AUBRAI' },
  { display: 'CryoDAO',        keyword: 'CryoDAO',       ticker: '$CRYO' },
  { display: 'CerebrumDAO',    keyword: 'CerebrumDAO',   ticker: '$NEURON' },
  { display: 'ValleyDAO',      keyword: 'ValleyDAO',     ticker: '$GROW' },
  { display: 'AthenaDAO',      keyword: 'AthenaDAO',     ticker: '$ATH' },
  { display: 'PsyDAO',         keyword: 'PsyDAO',        ticker: '$PSY' },
  { display: 'Molecule',       keyword: 'Molecule DAO',  ticker: '$MOL' },
  { display: 'PeptAI',         keyword: 'PeptAI',        ticker: '$PEPT' },
  { display: 'BiomeAI',        keyword: 'BiomeAI',       ticker: '$BIOMEAI' },
  { display: 'ClawdLab',       keyword: 'ClawdLab',      ticker: null },
  { display: 'Curetopia',      keyword: 'Curetopia',     ticker: '$CURES' },
  { display: 'Spectruth DAO',  keyword: 'Spectruth',     ticker: '$IBNFT' },
  { display: 'DermaLabs',      keyword: 'DermaLabs',     ticker: '$SKIN' },
];

// Lookup map keyed by the value we store in elfa_token_snapshots.ticker
// (which is now the `display` name). Used by /api/sentiment to merge in
// the ticker subtext without a join.
export const DESCI_PROJECT_BY_DISPLAY = Object.fromEntries(
  DESCI_PROJECTS.map(p => [p.display, p])
);
