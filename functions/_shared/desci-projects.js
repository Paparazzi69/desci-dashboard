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
//
// Editor's guide for the keywords array:
// Keywords use comma-separated OR matching via searchType=or on Elfa
// keyword-mentions. Aim for 3-6 variations per project covering:
// project name, X handle without @, $TICKER, and aliases or secondary
// accounts. Test new keywords with an Elfa probe before adding.
//
// IMPORTANT: avoid generic tokens or single English words as keywords.
// $GROW, $CLAW, $SKIN, $HAIR, $ATH all produced false positives in
// production (memecoin posts, GStack tool mentions, artist posts).
// Use specific project names and handles only. Tickers OK only when
// they are unique strings like $BIO, $VITA, $RSC, $AUBRAI, $PEPTAI.
//
// Note: Elfa indexes mentions selectively. Pre-launch projects with
// no FDV and small caps under $2.5M FDV may be under-indexed regardless
// of keyword coverage. This is a data limitation, not a bug. Compensate
// via the discovery cron which adds all DeSci-active authors to the
// roster regardless of smart status.

export const DESCI_PROJECTS = [
  {
    display: 'Bio Protocol',
    keywords: ['$BIO', 'BioProtocol', 'BioProtocolEco', 'bio.xyz'],
    ticker: '$BIO',
  },
  {
    display: 'VitaDAO',
    keywords: ['VitaDAO', 'vita_dao', 'vitadao'],
    ticker: '$VITA',
  },
  {
    display: 'ResearchHub',
    keywords: ['ResearchHub', '$RSC', 'researchhub'],
    ticker: '$RSC',
  },
  {
    // $HAIR dropped · historically caught Arsenal noise.
    display: 'HairDAO',
    keywords: ['HairDAO', 'HairDAO_'],
    ticker: '$HAIR',
  },
  {
    // $URO and $RIF dropped from keywords · the IPT names urolithin and
    // rifampicin are specific enough on their own.
    display: 'Pump.science',
    keywords: ['Pump.science', 'pumpdotscience', 'urolithin', 'rifampicin'],
    ticker: '$URO',
  },
  {
    display: 'AUBRAI',
    keywords: ['AUBRAI', 'Aubrai_', '$AUBRAI'],
    ticker: '$AUBRAI',
  },
  {
    // $CRYO dropped · low-volume false-positive risk on the bare ticker.
    display: 'CryoDAO',
    keywords: ['CryoDAO', 'CryoDAOxyz'],
    ticker: '$CRYO',
  },
  {
    // $CLAW dropped · caught GStack/Garry-Tan tool mentions ("claw/hermes").
    // $NEURON also dropped · ambiguous outside DeSci context.
    display: 'CerebrumDAO',
    keywords: ['CerebrumDAO', 'cerebrum_dao'],
    ticker: '$NEURON',
  },
  {
    // $GROW dropped · 1.4K false-positive mentions from memecoin posts
    // ("grow massively") and a top mention from @ACXtrades that's a
    // memecoin shill, not DeSci.
    display: 'ValleyDAO',
    keywords: ['ValleyDAO', 'valley_dao'],
    ticker: '$GROW',
  },
  {
    // $ATH dropped · historically caught Aethir noise.
    // athenabiorg removed · belongs to a different org.
    display: 'AthenaDAO',
    keywords: ['AthenaDAO', 'athena_DAO_'],
    ticker: '$ATH',
  },
  {
    // $PSY and psy_dao dropped · the project handle "PsyDAO" is unique enough.
    display: 'PsyDAO',
    keywords: ['PsyDAO'],
    ticker: '$PSY',
  },
  {
    // IP-NFT and IPNFT dropped from keywords · sector terms catch too
    // much non-Molecule chatter. Project handles only.
    display: 'Molecule',
    keywords: ['Molecule_dao', 'Molecule_sci'],
    ticker: '$MOL',
  },
  {
    // $PEPTAI is unique enough to keep · BioProtocolEco kept because it
    // was the verified source of the "$PEPTAI Ignition Sale" tweet.
    // OX2R-004 added so the lead candidate's mentions feed the project's
    // sentiment row even when posts skip the parent ticker. kisspeptin is
    // the Agent-02 receptor name, also unique enough to attribute to PeptAI.
    display: 'PeptAI',
    keywords: ['PeptAI', 'peptai_', '$PEPTAI', 'BioProtocolEco', 'OX2R-004', 'kisspeptin'],
    ticker: '$PEPTAI',
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
    // Generic 'CURES' (no $) dropped · word, not a ticker. $CURES is
    // unique enough on Elfa to keep.
    display: 'Curetopia',
    keywords: ['Curetopia', '$CURES'],
    ticker: '$CURES',
  },
  {
    // $IBNFT dropped · ambiguous. Project handles only.
    display: 'Spectruth DAO',
    keywords: ['Spectruth', 'SpectruthDAO', 'Ibonova'],
    ticker: '$IBNFT',
  },
  {
    // $SKIN dropped · 342 mentions in production were unrelated artist
    // posts. DermaLabs as a name is specific enough.
    display: 'DermaLabs',
    keywords: ['DermaLabs'],
    ticker: '$SKIN',
  },
  {
    // $SPINE dropped · ambiguous English word. Handles only.
    display: 'SpineDAO',
    keywords: ['SpineDAO', 'Spine_DAO'],
    ticker: '$SPINE',
  },
];

// Lookup map keyed by the value we store in elfa_token_snapshots.ticker
// (which is the `display` name). Used by /api/sentiment to merge in
// the ticker subtext without a join.
export const DESCI_PROJECT_BY_DISPLAY = Object.fromEntries(
  DESCI_PROJECTS.map(p => [p.display, p])
);
