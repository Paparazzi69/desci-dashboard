// Canonical catalog of DeSci projects tracked by the dashboard.
//
// `display`  · UI name (e.g. "VitaDAO").
// `ticker`   · ticker subtext rendered under the name. null for projects
//              without a tradable token.
// `category` · BIOAGENT | BIODAO | PLATFORM | IPT | MEMETIC. Drives the
//              category pill on /projects (and any future per-category
//              surface).
//
// Single source of truth for project identity.

export const DESCI_PROJECTS = [
  { display: 'Bio Protocol', ticker: '$BIO',     category: 'PLATFORM' },
  { display: 'VitaDAO',      ticker: '$VITA',    category: 'BIODAO' },
  { display: 'ResearchHub',  ticker: '$RSC',     category: 'PLATFORM' },
  { display: 'HairDAO',      ticker: '$HAIR',    category: 'BIODAO' },
  { display: 'Pump.science', ticker: '$URO',     category: 'MEMETIC' },
  { display: 'AUBRAI',       ticker: '$AUBRAI',  category: 'BIOAGENT' },
  { display: 'CryoDAO',      ticker: '$CRYO',    category: 'BIODAO' },
  { display: 'CerebrumDAO',  ticker: '$NEURON',  category: 'BIODAO' },
  { display: 'ValleyDAO',    ticker: '$GROW',    category: 'BIODAO' },
  { display: 'AthenaDAO',    ticker: '$ATH',     category: 'BIODAO' },
  { display: 'PsyDAO',       ticker: '$PSY',     category: 'BIODAO' },
  { display: 'Molecule',     ticker: '$MOL',     category: 'PLATFORM' },
  { display: 'PeptAI',       ticker: '$PEPTAI',  category: 'BIOAGENT' },
  { display: 'BiomeAI',      ticker: '$BIOMEAI', category: 'BIOAGENT' },
  { display: 'ClawdLab',     ticker: null,       category: 'BIOAGENT' },
  { display: 'Curetopia',    ticker: '$CURES',   category: 'IPT' },
  { display: 'Spectruth DAO',ticker: '$IBNFT',   category: 'IPT' },
  { display: 'DermaLabs',    ticker: '$SKIN',    category: 'BIODAO' },
  { display: 'SpineDAO',     ticker: '$SPINE',   category: 'BIODAO' },
];

export const DESCI_PROJECT_BY_DISPLAY = Object.fromEntries(
  DESCI_PROJECTS.map(p => [p.display, p])
);

// Card metadata for the four shipped deep-dive pages, surfaced on the
// /projects landing.
//
// `takeaway`       · italic primary-takeaway line shown above the bullets
// `chain_label`    · uppercased chain name for tokenized projects,
//                    falls back to category word for non-token entries
// `read_minutes`   · word-count / 200, rounded to nearest integer
// `sources_count`  · unique external <a href> domains in the deep-dive
//                    page (same-origin and infrastructure links excluded)
//
// Numbers are derived from each /projects/<slug>/index.html and need to
// be recomputed if those pages change materially. Values are mirrored
// into projects/index.html (no build step on this site, so the static
// template duplicates them). See projects/index.html "MONOSTRIP" markers.
export const SHIPPED_CARD_META = {
  'science-beach': {
    display:       'Science Beach',
    takeaway:      'The substrate every other DeSci project builds on.',
    chain_label:   'PLATFORM',
    read_minutes:  4,
    sources_count: 5,
  },
  'spinedao': {
    display:       'SpineDAO',
    takeaway:      'Five practicing spine surgeons built four products for their own operating rooms.',
    chain_label:   'SOLANA',
    read_minutes:  4,
    sources_count: 9,
  },
  'peptai': {
    display:       'PeptAI',
    takeaway:      'Designed a peptide drug in 24 hours. Published when it failed at gate six.',
    chain_label:   'BASE',
    read_minutes:  7,
    sources_count: 6,
  },
  'aubrai': {
    display:       'AUBRAI',
    takeaway:      "Aubrey de Grey's lab, instantiated as an agent.",
    chain_label:   'BASE',
    read_minutes:  16,
    sources_count: 12,
  },
};
