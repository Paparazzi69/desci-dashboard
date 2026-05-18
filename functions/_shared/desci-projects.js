// Canonical catalog of DeSci projects tracked by the dashboard.
//
// `display`  · UI name (e.g. "VitaDAO").
// `ticker`   · ticker subtext rendered under the name. null for projects
//              without a tradable token.
//
// Imported by upcoming /projects landing surfaces. Keep this list as the
// single source of truth for project identity.

export const DESCI_PROJECTS = [
  { display: 'Bio Protocol', ticker: '$BIO' },
  { display: 'VitaDAO',      ticker: '$VITA' },
  { display: 'ResearchHub',  ticker: '$RSC' },
  { display: 'HairDAO',      ticker: '$HAIR' },
  { display: 'Pump.science', ticker: '$URO' },
  { display: 'AUBRAI',       ticker: '$AUBRAI' },
  { display: 'CryoDAO',      ticker: '$CRYO' },
  { display: 'CerebrumDAO',  ticker: '$NEURON' },
  { display: 'ValleyDAO',    ticker: '$GROW' },
  { display: 'AthenaDAO',    ticker: '$ATH' },
  { display: 'PsyDAO',       ticker: '$PSY' },
  { display: 'Molecule',     ticker: '$MOL' },
  { display: 'PeptAI',       ticker: '$PEPTAI' },
  { display: 'BiomeAI',      ticker: '$BIOMEAI' },
  { display: 'ClawdLab',     ticker: null },
  { display: 'Curetopia',    ticker: '$CURES' },
  { display: 'Spectruth DAO',ticker: '$IBNFT' },
  { display: 'DermaLabs',    ticker: '$SKIN' },
  { display: 'SpineDAO',     ticker: '$SPINE' },
];

export const DESCI_PROJECT_BY_DISPLAY = Object.fromEntries(
  DESCI_PROJECTS.map(p => [p.display, p])
);
