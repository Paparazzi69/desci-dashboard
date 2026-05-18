// Canonical catalog of DeSci projects tracked by the dashboard.
//
// `display`  · UI name (e.g. "VitaDAO").
// `ticker`   · ticker subtext rendered under the name. null for projects
//              without a tradable token.
// `category` · BIOAGENT | BIODAO | PLATFORM | IPT | MEMETIC. Drives the
//              category pill on /projects (and any future per-category
//              surface).
//
// Single source of truth for project identity. Consumed by the upcoming
// /projects landing page; the 16 IN-QUEUE rows are derived from this list
// by excluding the three projects with a shipped deep-dive page
// (SpineDAO, PeptAI, AUBRAI).

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
