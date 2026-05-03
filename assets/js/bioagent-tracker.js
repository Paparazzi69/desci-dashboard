// BioAgent Tracker — autonomous AI co-scientist registry.
// Pure data + DOM rendering. No external API; the dataset is editorial and
// updated weekly. Read directly: AGENTS array drives the lane viz, the agent
// grid (card + compact views), and the sort/filter controls.
//
// Pipeline stages:
//   0 = Hypothesis (generate + mint onchain)
//   1 = Computational (in-silico validation, peptide design, docking)
//   2 = Wet Lab (synthesis + assays)
//   3 = Clinical (animal/Phase 1+ / FDA-EMA pathway / live infrastructure)
//
// stageDecimal lets us track sub-progress within a stage for sorting (e.g.
// 2.55 = mid wet-lab) without changing the integer bucket the lane uses.

const AGENTS = [
  {
    id: 'aubrai', name: 'AUBRAI', initials: 'Au',
    status: 'live', stage: 2, stageDecimal: 2.35,
    chain: 'base', displayOrder: 2,
    focus: 'Longevity',
    token: '$AUBRAI', tokenNote: '150x from $269K pre-sale',
    parent: 'VitaDAO',
    launchDate: 'Aug 25, 2025',
    link: 'https://app.bio.xyz/agents/aubrai',
    desc: "Longevity AI agent built with VitaDAO & Dr. Aubrey de Grey. Trained on de Grey's unpublished lab data. Runs on ElizaOS v2 in Phala Cloud TEE.",
    stats: [
      { label: 'Token',       value: '$AUBRAI' },
      { label: 'Sale FDV',    value: '$269K → $40M (150x)' },
      { label: 'Hypotheses',  value: '1,000+ (934+ verified)' },
      { label: 'PoI minted',  value: '2,211+' },
      { label: 'IP-NFTs',     value: '2' },
      { label: 'Funding',     value: '$900K+' },
    ],
    programmes: {
      head: ['Programme', 'Output', 'Status'],
      rows: [
        { name: 'Hypothesis Mint', sub: 'bio.xyz onchain', gates: [1,1,1,1,1,1,1,2], stage: 'WL', note: '1,000+ minted · 934+ verified' },
        { name: 'IP-NFT Pipeline', sub: 'VitaDAO IP',      gates: [1,1,1,1,1,1,2,0], stage: 'WL', note: '2 IP-NFTs minted' },
        { name: 'VitaSTEM',        sub: '850K+ stem cell transcriptomes', gates: [1,1,1,1,2,0,0,0], stage: 'CO', note: 'Just launched · IP-Token' },
        { name: 'RMR2 (mouse rejuv.)', sub: 'de Grey collab', gates: [1,1,1,2,0,0,0,0], stage: 'WL', note: 'Active · wet lab phase' },
      ],
    },
    lastSignal: { when: 'Oct 2025', text: 'Launched VitaSTEM IP-Token — first AI-enabled IP-Token in DeSci.' },
    output: '1,000+ hypotheses · 2,211+ PoI · 2 IP-NFTs · $900K+ funding',
    outputN: 1000,
  },
  {
    id: 'peptai', name: 'PeptAI', initials: 'Pe',
    status: 'live', stage: 2, stageDecimal: 2.55,
    chain: 'base', displayOrder: 1,
    focus: 'Drug Discovery',
    token: 'listed on bio.xyz', tokenNote: "Catalyst for BIO's 120% April rally",
    parent: 'Bio Protocol core',
    launchDate: '2025',
    link: 'https://app.bio.xyz/agents/peptai',
    desc: 'Head agent coordinating 4 target-scoped sub-agents for autonomous peptide drug discovery. 9-gate validation pipeline. Wet lab via Adaptyv Bio paid machine-to-machine over x402.',
    stats: [
      { label: 'Active GPCRs',     value: 'GLP1R · KISS1R · OX2R' },
      { label: '$ / molecule',     value: '~$1,500' },
      { label: 'Validation gates', value: '9 (G1–G8 + WL)' },
      { label: 'Lead candidate',   value: 'OX2R-004' },
    ],
    programmes: {
      head: ['Programme', 'Gate Progress', 'Status'],
      rows: [
        { name: 'KISS1R', sub: 'Fertility',  gates: [1,1,1,1,1,1,1,1,2,0], stage: 'G8/WL', note: '3 passed · 7 in progress' },
        { name: 'OX2R',   sub: 'ADHD',       gates: [1,1,1,1,1,1,2,0,0,0], stage: 'G6',    note: 'OX2R-004 designed in 24h' },
        { name: 'GLP-1R', sub: 'Metabolic',  gates: [1,1,1,1,2,0,0,0,3,0], stage: 'G4',    note: '10 candidates · 3 dropped' },
      ],
      gateLayout: 'long',
    },
    saleData: {
      title: 'Ignition Sale (LIVE · ends ~May 13, 2026)',
      rows: [
        ['Launch FDV',          '$1,000,000 USDC'],
        ['Token Price',         '$0.10 USDC'],
        ['Fundraising Goal',    '$50,000 USDC (100% reached)'],
        ['Oversubscription',    '12.5x ($624,039 USDC committed)'],
        ['Max per user',        '$10,000 USDC'],
        ['BioXP contributed',   '388,530,386'],
        ['Participants',        '682'],
      ],
    },
    fleet: {
      title: 'Fleet Structure · 4 target-scoped sub-agents',
      agents: [
        { name: 'Agent-01 → GLP-1R',  domain: 'Metabolic',         desc: '$30B+/year approved drugs (semaglutide, tirzepatide, liraglutide). Calibrates against ChEMBL; AlphaFold + Boltz2 + PRODIGY + LiteFold MD; G1–G8 viability screens. Survivors synthesize at Adaptyv Bio.' },
        { name: 'Agent-02 → KISS1R',  domain: 'Reproductive hormone signaling', desc: 'Fertility & hypogonadism. Underexplored target with therapeutic potential. Same gate stack as Agent-01.' },
        { name: 'Agent-03 → OX2R',    domain: 'Novel ADHD peptide agonist', desc: 'Opposite direction from approved orexin drugs (small-molecule antagonists for insomnia). Documented orexin hypofunction in drug-naive ADHD children. Runs G1–G8 before wet lab. OX2R-004 lead candidate.' },
        { name: 'Agent-04 → Community', domain: 'DAO-governed target', desc: 'Awaiting selection. Once chosen, the agent calibrates gates against available binding data and begins the 9-gate pipeline.' },
      ],
    },
    architectureNote: 'Wet lab execution at Adaptyv Bio paid machine-to-machine via x402 protocol. Every gate decision, tool call, pass and failure publishes openly on Molecule Labs. The fleet scales with budget.',
    lastSignal: { when: 'May 2026', text: 'Ignition Sale LIVE — 12.5x oversubscribed, 682 participants, $624K USDC committed.' },
    output: 'OX2R-004 peptide · 4-agent fleet · Ignition 12.5x oversubscribed',
    outputN: 850,
  },
  {
    id: 'clawdlab', name: 'ClawdLab', initials: 'Cl',
    status: 'live', stage: 3, stageDecimal: 3.5,
    chain: 'multi', displayOrder: 8,
    focus: 'Research Platform',
    token: 'infrastructure', tokenNote: 'Not token-based',
    parent: 'Molecule / Bio Protocol',
    launchDate: '2026',
    link: 'https://github.com/bio-xyz/ClawdLab',
    desc: 'Autonomous scientific research platform derived from OpenClaw framework (179K GitHub stars). Companion: beach.science public research commons.',
    stats: [
      { label: 'GitHub',           value: 'bio-xyz/ClawdLab' },
      { label: 'Papers (14d)',     value: '6+' },
      { label: 'AI agents spawned', value: '1.5M / 72h' },
      { label: 'ArXiv',            value: 'Feb 2026' },
    ],
    programmes: {
      head: ['Capability', 'Coverage', 'Status'],
      rows: [
        { name: 'Hypothesis tooling',   sub: 'OpenClaw API',       gates: [1,1,1,1,1,1,1,1], stage: 'OK', note: 'Full coverage' },
        { name: 'In-silico chain',      sub: 'Compute scheduler',  gates: [1,1,1,1,1,1,1,1], stage: 'OK', note: 'Full coverage' },
        { name: 'Wet lab integrations', sub: 'Robotic protocols',  gates: [1,1,1,1,1,1,1,1], stage: 'OK', note: 'Partner labs' },
        { name: 'Clinical handoff',     sub: 'BioDAO outputs',     gates: [1,1,1,1,1,1,1,1], stage: 'OK', note: 'Via partner DAOs' },
      ],
    },
    lastSignal: { when: 'Mar 2026', text: 'Science Beach launched — 1000+ hypotheses, 59 AI agents, 55 humans. Moltbook spawned 1.5M agents in 72h.' },
    output: '6+ academic papers · 1.5M agents spawned · Science Beach',
    outputN: 600,
  },
  {
    id: 'biomeai', name: 'BiomeAI', initials: 'Bi',
    status: 'live', stage: 1, stageDecimal: 1.55,
    chain: 'base', displayOrder: 7,
    focus: 'Microbiome',
    token: 'upcoming',
    parent: 'MicrobiomeDAO',
    link: 'https://app.bio.xyz/agents/biomeai',
    desc: 'Collaborative gut health discovery through N=10 model. Logs food, supplements, habits — AI spots patterns specific to your microbiome group.',
    stats: [
      { label: 'Token',      value: 'upcoming' },
      { label: 'Focus',      value: 'Gut · IBD · IBS' },
      { label: 'PoI minted', value: '1 (with AUBRAI)' },
      { label: 'Model',      value: 'N=10 cohort' },
    ],
    programmes: {
      head: ['Programme', 'Progress', 'Status'],
      rows: [
        { name: 'P.O.O.P agent',    sub: 'Habit tracking',  gates: [1,1,1,1,2,0,0,0], stage: 'CO', note: 'Beta' },
        { name: 'Microbiome PoI',   sub: 'AUBRAI co-mint',  gates: [1,1,1,1,1,1,2,0], stage: 'CO', note: 'First-of-kind' },
        { name: 'Data marketplace', sub: 'Patient data',    gates: [1,1,2,0,0,0,0,0], stage: 'HY', note: 'Spec phase' },
      ],
    },
    lastSignal: { when: 'Active', text: 'Pay-to-compute microbiome data marketplace active. 1 PoI minted (with AUBRAI — first Microbiome PoI).' },
    output: '1 Microbiome PoI · pay-to-compute marketplace live',
    outputN: 80,
  },
  {
    id: 'dermalabs', name: 'DermaLabs', initials: 'De',
    status: 'launching', stage: 1, stageDecimal: 1.4,
    chain: 'ethereum', displayOrder: 11,
    focus: 'Skincare',
    token: '$SKIN',
    parent: 'Bio Protocol',
    link: 'https://app.bio.xyz/agents/dermalabs',
    desc: 'Dermatologist-led science meets community-powered skincare research. Decentralized trials + AI imaging, bridged to consumer via Biofy commerce layer.',
    stats: [
      { label: 'Token',    value: '$SKIN' },
      { label: 'Method',   value: 'AI imaging + DCT' },
      { label: 'Commerce', value: 'Biofy' },
      { label: 'Stage',    value: 'Computational' },
    ],
    programmes: {
      head: ['Programme', 'Progress', 'Status'],
      rows: [
        { name: 'Imaging classifier',    sub: 'Skin condition CV', gates: [1,1,1,1,2,0,0,0], stage: 'CO', note: 'Active training' },
        { name: 'Decentralized trials',  sub: 'Community cohort',  gates: [1,1,2,0,0,0,0,0], stage: 'HY', note: 'Recruiting' },
        { name: 'Biofy commerce',        sub: 'Consumer bridge',   gates: [1,1,1,2,0,0,0,0], stage: 'CO', note: 'Integration' },
      ],
    },
    lastSignal: { when: '3w ago', text: '$SKIN announced. First BioAgent targeting consumer skincare validation.' },
    output: 'Pre-launch · imaging in training',
    outputN: 40,
  },
  {
    id: 'gocart', name: 'GoCART Therapeutics', initials: 'Go',
    status: 'launching', stage: 1, stageDecimal: 1.55,
    chain: 'tbd', displayOrder: 12,
    focus: 'Oncology',
    token: '—',
    parent: 'Bio Protocol',
    link: 'https://app.bio.xyz/agents/gocart',
    desc: 'Next-gen safer cell therapies for cancer. Biological AND-gate — a two-key safety system activating only on cancer cells. Addresses CAR-T off-target toxicity.',
    stats: [
      { label: 'Modality', value: 'CAR-T' },
      { label: 'Tech',     value: 'Biological AND-gate' },
      { label: 'Stage',    value: 'Pre-clinical' },
      { label: 'Token',    value: '—' },
    ],
    programmes: {
      head: ['Programme', 'Progress', 'Status'],
      rows: [
        { name: 'AND-gate construct', sub: 'Dual-target activation', gates: [1,1,1,1,1,2,0,0], stage: 'CO', note: 'In design' },
        { name: 'Off-target screen',  sub: 'Safety validation',      gates: [1,1,1,2,0,0,0,0], stage: 'CO', note: 'Computational' },
      ],
    },
    lastSignal: { when: '4w ago', text: 'Roadmap published. Pre-clinical AND-gate construct in computational design.' },
    output: 'Pre-clinical · AND-gate in design',
    outputN: 30,
  },
  {
    id: 'd1ckgpt', name: 'D1ckGPT', initials: 'D1',
    status: 'launching', stage: 0, stageDecimal: 0.6,
    chain: 'base', displayOrder: 13,
    focus: "Men's Health",
    token: '—',
    parent: 'Bio Protocol',
    link: 'https://app.bio.xyz/agents/d1ckgpt',
    desc: "Men's health BioAgent assessing biological age and guiding reversal. Trained on 600+ clinician-curated studies with its own Decentralized Knowledge Graph.",
    stats: [
      { label: 'Studies ingested', value: '600+' },
      { label: 'Stack',            value: 'DKG' },
      { label: 'Stage',            value: 'Hypothesis' },
      { label: 'Token',            value: '—' },
    ],
    programmes: {
      head: ['Programme', 'Progress', 'Status'],
      rows: [
        { name: 'Bio-age model', sub: 'Clinician-curated', gates: [1,1,1,2,0,0,0,0], stage: 'HY', note: '600+ studies' },
        { name: 'DKG ingest',    sub: 'Self-improving',    gates: [1,1,2,0,0,0,0,0], stage: 'HY', note: 'Every chat trains' },
      ],
    },
    lastSignal: { when: '5w ago', text: "DKG architecture announced. Every interaction enhances the agent's intelligence." },
    output: '600+ studies ingested · DKG live',
    outputN: 20,
  },
  // Announced / on the radar — ghost cards
  {
    id: 'neuropath', name: 'NeuroPath Navigator', initials: 'Ne',
    status: 'announced', stage: 0, stageDecimal: 0.2,
    chain: 'tbd', displayOrder: 14,
    focus: 'PTSD Diagnostics',
    token: 'announced',
    parent: 'Spectruth DAO',
    desc: 'Epigenetic biomarkers + clinical data for PTSD diagnostics. Announced direction by Spectruth DAO; spec phase.',
    stats: [
      { label: 'Status', value: 'Announced' },
      { label: 'Stage',  value: 'Spec' },
    ],
    lastSignal: { when: '6w ago', text: 'Announced direction in BioDAO roadmap. No mainnet activity yet.' },
    output: 'Announced · spec phase',
    outputN: 5,
  },
  {
    id: 'brainhealth', name: 'Brain Health Agent', initials: 'Br',
    status: 'announced', stage: 0, stageDecimal: 0.15,
    chain: 'tbd', displayOrder: 15,
    focus: 'Neuroscience',
    token: '—',
    parent: 'Bio Protocol',
    desc: 'Confirmed in Bio Protocol roadmap post $6.9M raise. Targets neurodegenerative + cognitive health.',
    stats: [
      { label: 'Status',          value: 'Roadmap' },
      { label: 'Funding context', value: '$6.9M raise' },
    ],
    lastSignal: { when: '7w ago', text: 'Confirmed in roadmap post $6.9M raise. Form factor TBD.' },
    output: 'Roadmap confirmed',
    outputN: 5,
  },
  {
    id: 'bios', name: 'BIOS Data Agent', initials: 'BI',
    status: 'live', stage: 3, stageDecimal: 3.4,
    chain: 'multi', displayOrder: 10,
    excludeFromLane: true,
    focus: 'Infrastructure / Bioinformatics',
    token: 'pay-per-query',
    parent: 'Bio Protocol AI',
    desc: 'Universal AI Scientist — pay-per-query bioinformatics utility. Powers other BioAgents with on-demand scientific intelligence. Used by researchers from Harvard, Stanford, Pfizer.',
    stats: [
      { label: 'Type',       value: 'Infrastructure' },
      { label: 'Benchmark',  value: '#1 BixBench V50' },
      { label: 'Users',      value: 'Harvard · Stanford · Pfizer' },
      { label: 'Token',      value: 'pay-per-query' },
    ],
    lastSignal: { when: 'Mar 2026', text: 'Hit #1 on BixBench Verified 50 benchmark — universal AI scientist live for any BioAgent.' },
    output: '#1 BixBench V50 · powers BioAgent fleet',
    outputN: 700,
  },
  {
    id: 'vitastem', name: 'VitaSTEM', initials: 'VS',
    status: 'live', stage: 2, stageDecimal: 2.1,
    chain: 'base', displayOrder: 5,
    focus: 'Longevity / Stem Cells',
    token: '$VITASTEM',
    parent: 'VitaDAO via AUBRAI',
    launchDate: 'Oct 2025',
    link: 'https://app.bio.xyz/agents/vitastem',
    desc: 'Stem Cell Rejuvenation IP-Token — first AI-generated IP-Token in DeSci history. 20% of supply held by AUBRAI itself. Analyzing 850K+ human stem cell transcriptomes.',
    stats: [
      { label: 'Token',          value: '$VITASTEM' },
      { label: 'Transcriptomes', value: '850K+' },
      { label: 'AUBRAI holds',   value: '20% of supply' },
      { label: 'Type',           value: 'AI-generated IPT' },
    ],
    lastSignal: { when: 'Oct 2025', text: 'First AI-enabled IP-Token launched.' },
    output: '850K+ transcriptomes · first AI-generated IPT',
    outputN: 300,
  },
  {
    id: 'holilabs', name: 'Holi Labs', initials: 'Ho',
    status: 'live', stage: 2, stageDecimal: 2.2,
    chain: 'base', displayOrder: 6,
    focus: 'Brain Health / BDNF',
    token: '$HOLI',
    parent: 'Holi Collective',
    launchDate: 'Dec 2025',
    link: 'https://app.bio.xyz/agents/holilabs',
    desc: 'Fitness × Neuroscience BioAgent — Berlin GymLab BDNF trial. Olympic gold-medalist Robert Harting involved. 12-week protocol with blood draws.',
    stats: [
      { label: 'Trial',         value: 'GymLab Berlin' },
      { label: 'Participants',  value: '100' },
      { label: 'Workouts',      value: '4,300+' },
      { label: 'BDNF draws',    value: '200' },
      { label: 'Ignition FDV',  value: '$500K' },
      { label: 'Raise',         value: '$100K' },
    ],
    lastSignal: { when: 'Dec 2025', text: 'GymLab BDNF trial active in Berlin — 12-week protocol underway.' },
    output: 'Berlin trial active · 100 participants · 4,300+ workouts',
    outputN: 250,
  },
  {
    id: 'vitarna', name: 'VitaRNA', initials: 'VR',
    status: 'live', stage: 3, stageDecimal: 3.2,
    chain: 'base', displayOrder: 3,
    focus: 'Gene Therapy',
    token: '$VITARNA',
    parent: 'VitaDAO',
    launchDate: '2025',
    link: 'https://app.bio.xyz/agents/vitarna',
    desc: 'mRNA Gene Therapy IP-Token — first DeSci drug to enter UAE clinical dosing. Peaked at ~$27M MC from $300K initial raise.',
    stats: [
      { label: 'Token',         value: '$VITARNA' },
      { label: 'Initial raise', value: '$300K' },
      { label: 'Peak MC',       value: '~$27M' },
      { label: 'Status',        value: 'UAE clinical dosing' },
    ],
    lastSignal: { when: '2025', text: 'Dosing patients in UAE clinical trial — first DeSci drug in clinic.' },
    output: 'UAE clinical dosing · first DeSci drug in clinic',
    outputN: 500,
  },
  {
    id: 'percepta', name: 'Percepta / CLAW', initials: 'Pc',
    status: 'live', stage: 3, stageDecimal: 3.1,
    chain: 'base', displayOrder: 4,
    focus: "Brain Health / Alzheimer's",
    token: '$CLAW',
    parent: 'CerebrumDAO',
    link: 'https://app.bio.xyz/agents/percepta',
    desc: "Brain Health Supplement IP-Token — Cat's Claw extract PTI-00703 + MemorTea targeting $8.6B Alzheimer's market. Phase 2 human trial approved.",
    stats: [
      { label: 'Token',     value: '$CLAW' },
      { label: 'Extract',   value: 'PTI-00703 + MemorTea' },
      { label: 'TAM',       value: '$8.6B' },
      { label: 'Bio Treasury', value: '$80K Phase 2' },
      { label: 'MC',        value: '~$126K' },
    ],
    lastSignal: { when: 'Active', text: 'Phase 2 human trial approved, $80K funded by Bio Treasury.' },
    output: 'Phase 2 human trial approved · $80K Bio Treasury',
    outputN: 200,
  },
  {
    id: 'curetopia', name: 'Curetopia', initials: 'Cu',
    status: 'live', stage: 1, stageDecimal: 1.3,
    chain: 'solana', displayOrder: 9,
    focus: 'Rare Disease',
    token: '$CURES',
    parent: 'Curetopia / VibeBio',
    launchDate: 'Mar 2025',
    link: 'https://app.bio.xyz/agents/curetopia',
    desc: '40 inherited metabolic diseases — Y Combinator alum Dr. Ethan Perlstein leading. Only Solana-native BioDAO in the Bio Protocol ecosystem. First target: AARS2.',
    stats: [
      { label: 'Token',       value: '$CURES' },
      { label: 'Raised',      value: '$1.77M' },
      { label: 'Diseases',    value: '40 inherited metabolic' },
      { label: 'First target', value: 'AARS2' },
      { label: 'Lead',        value: 'Dr. Ethan Perlstein (YC)' },
    ],
    lastSignal: { when: 'Mar 2025', text: 'TGE completed, $1.77M raised — only Solana-native BioDAO in Bio Protocol ecosystem.' },
    output: '$1.77M raised · AARS2 first target',
    outputN: 150,
  },
  {
    id: 'beeard', name: 'BeeARD (PsyDAO)', initials: 'Be',
    status: 'announced', stage: 0, stageDecimal: 0.18,
    chain: 'tbd', displayOrder: 16,
    focus: 'Psychedelics',
    token: 'TBD',
    parent: 'PsyDAO',
    desc: 'Psychedelics Discovery Agent — discovered novel psilocybin derivative. Announced by PsyDAO.',
    stats: [
      { label: 'Status', value: 'Announced' },
      { label: 'Domain', value: 'Novel psilocybin derivatives' },
    ],
    lastSignal: { when: 'Announced', text: 'Discovered novel psilocybin derivative.' },
    output: 'Announced · novel psilocybin derivative',
    outputN: 5,
  },
  {
    id: 'pumpscience', name: 'Pump.science (RIF/URO)', initials: 'Pu',
    status: 'stalled', stage: 2, stageDecimal: 2.0,
    chain: 'solana', displayOrder: 17,
    focus: 'Longevity / Anti-aging',
    token: '$RIF · $URO',
    parent: 'Molecule / Solana Foundation',
    link: 'https://pump.science',
    desc: 'Memecoin × Science Experiments. Mouse experiments ongoing but no new token launches planned. EGS launch failed (refunded 91.87% of raised SOL). Platform frozen until full audit.',
    stats: [
      { label: 'Tokens',     value: '$RIF · $URO' },
      { label: 'RIF vs ATH', value: '−96.3% ($0.248 Nov 2024)' },
      { label: 'EGS launch', value: 'Failed · 91.87% refunded' },
      { label: 'Status',     value: 'Frozen pending audit' },
    ],
    lastSignal: { when: '2026', text: 'Platform frozen. Focus on RIF/URO mouse experiments only. No new compounds until audit.' },
    output: 'Frozen · RIF/URO mouse trials only',
    outputN: 50,
  },
];

// Avatar tint by pipeline stage (per design: avatar color = stage, not identity).
const STAGE_COLOR = [
  'var(--purple)', // 0 Hypothesis
  'var(--blue)',   // 1 Computational
  'var(--teal)',   // 2 Wet Lab — teal so green stays distinct for "live"
  'var(--green)',  // 3 Clinical / infrastructure
];
const STAGE_BG = [
  'var(--purple-bg)',
  'var(--blue-bg)',
  'var(--teal-bg)',
  'var(--green-bg)',
];
const STAGE_LABEL = ['Hypothesis', 'Computational', 'Wet Lab', 'Clinical'];

// ─── Chain badge ────────────────────────────────────────────────────────────
const CHAIN_LABEL = {
  base: 'Base', solana: 'Solana', ethereum: 'Ethereum', multi: 'Multi', tbd: 'TBD',
};
function chainBadge(chain) {
  if (!chain) return '';
  const key = CHAIN_LABEL[chain] ? chain : 'tbd';
  return `<span class="chain-badge chain-${key}">${CHAIN_LABEL[key]}</span>`;
}

// ─── Pipeline Lane — pucks ───────────────────────────────────────────────────
const STATUS_RANK_LANE = { live: 0, launching: 1, announced: 2, stalled: 3 };

function buildLane() {
  const buckets = { 0: [], 1: [], 2: [], 3: [] };
  AGENTS.forEach(a => {
    if (a.excludeFromLane) return;
    buckets[Math.floor(a.stageDecimal)].push(a);
  });
  Object.values(buckets).forEach(b =>
    b.sort((x, y) => STATUS_RANK_LANE[x.status] - STATUS_RANK_LANE[y.status])
  );

  for (let stageInt = 0; stageInt < 4; stageInt++) {
    const col = document.querySelector(`[data-stage-pucks="${stageInt}"]`);
    const countEl = document.querySelector(`[data-stage-count="${stageInt}"]`);
    if (!col || !countEl) continue;
    col.innerHTML = '';
    const list = buckets[stageInt];
    countEl.textContent = list.length;
    countEl.dataset.pop = list.some(a => a.status === 'live') ? 'true' : 'false';

    list.forEach(a => {
      const puck = document.createElement('div');
      puck.className = 'lane-puck';
      puck.dataset.status = a.status;
      puck.style.color = STAGE_COLOR[stageInt];
      const out = a.status === 'announced' ? 'Announced'
                : a.status === 'stalled'   ? 'Stalled'
                : a.output;
      puck.innerHTML = `
        <div class="lane-puck-avatar" style="background:${STAGE_BG[stageInt]};color:${STAGE_COLOR[stageInt]}">${a.initials}</div>
        <div class="lane-puck-body">
          <span class="lane-puck-name">${a.name}</span>
          <span class="lane-puck-output">${out}</span>
        </div>
        <span class="lane-puck-status" data-status="${a.status}"></span>
        <div class="lane-tooltip">
          <div class="lane-tooltip-meta" style="color:${STAGE_COLOR[stageInt]}">${a.status} · ${STAGE_LABEL[stageInt]}</div>
          <div style="color:var(--text);font-weight:500;margin-bottom:3px">${a.name}</div>
          <div style="color:var(--text2);font-size:10px;line-height:1.5">Last signal · ${a.lastSignal.when} — ${a.lastSignal.text}</div>
        </div>
      `;
      puck.addEventListener('click', () => {
        const el = document.querySelector(`[data-agent-id="${a.id}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.dataset.flash = 'true';
        setTimeout(() => { el.dataset.flash = 'false'; }, 1600);
      });
      col.appendChild(puck);
    });
  }
}

// ─── Programme/gate block (shared markup) ────────────────────────────────────
// gates: array of state ints — 0 pending, 1 passed, 2 active, 3 failed.
function programmeBlock(p) {
  if (!p) return '';
  const head = `<div class="programmes-head"><span>${p.head[0]}</span><span>${p.head[1]}</span><span>${p.head[2]}</span></div>`;
  const rows = p.rows.map(r => {
    const gates = r.gates.map(g => {
      const map = { 0: 'pending', 1: 'passed', 2: 'active', 3: 'failed' };
      return `<span class="gate" data-state="${map[g] || 'pending'}"></span>`;
    }).join('');
    return `
      <div class="programme-row">
        <div class="programme-name">${r.name}<small>${r.sub || ''}</small></div>
        <div class="programme-bar">${gates}<span class="programme-stage">${r.stage}</span></div>
        <div class="programme-note">${r.note || ''}</div>
      </div>
    `;
  }).join('');
  return `<div class="programmes">${head}${rows}</div>`;
}

// ─── Sale data block ─────────────────────────────────────────────────────────
function saleDataBlock(s) {
  if (!s) return '';
  const rows = s.rows.map(([k, v]) => `
    <div class="sale-row"><span class="sale-key">${k}</span><span class="sale-val">${v}</span></div>
  `).join('');
  return `
    <div class="sale-data">
      <div class="sale-data-title">${s.title}</div>
      ${rows}
    </div>
  `;
}

// ─── Fleet structure block ───────────────────────────────────────────────────
function fleetBlock(f) {
  if (!f) return '';
  const items = f.agents.map(a => `
    <div class="fleet-agent">
      <div class="fleet-agent-head">
        <span class="fleet-agent-name">${a.name}</span>
        <span class="fleet-agent-domain">${a.domain}</span>
      </div>
      <div class="fleet-agent-desc">${a.desc}</div>
    </div>
  `).join('');
  return `
    <div class="fleet">
      <div class="fleet-title">${f.title}</div>
      ${items}
    </div>
  `;
}

// ─── Architecture note ───────────────────────────────────────────────────────
function architectureNoteBlock(text) {
  if (!text) return '';
  return `<div class="architecture-note"><span class="architecture-note-label">Architecture</span><div>${text}</div></div>`;
}

// ─── Agent cards — render ────────────────────────────────────────────────────
function pipPips(stageInt, status) {
  const cells = [];
  for (let i = 0; i < 4; i++) {
    let s = 'pending';
    if (status === 'announced') s = 'pending';
    else if (i < stageInt) s = 'done';
    else if (i === stageInt) s = 'active';
    cells.push(`<span class="pip" data-state="${s}"></span>`);
  }
  return `<div class="pips">${cells.join('')}</div>`;
}

function renderAgents(list, opts = {}) {
  const grid = document.getElementById('agent-grid');
  // wipe agent cards and any prior section headers
  grid.querySelectorAll('.agent-card, .status-section-header').forEach(n => n.remove());

  const showHeaders = opts.groupByStatus !== false;
  let lastStatus = null;

  // pre-compute status counts so the headers can show "(N)"
  const counts = list.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});

  list.forEach(a => {
    if (showHeaders && a.status !== lastStatus) {
      const header = document.createElement('div');
      header.className = 'status-section-header';
      header.dataset.status = a.status;
      header.innerHTML = `
        <span class="status-section-label" data-status="${a.status}">${STATUS_LABEL[a.status] || a.status.toUpperCase()}</span>
        <span class="status-section-count">(${counts[a.status]})</span>
        <span class="status-section-line"></span>
      `;
      grid.appendChild(header);
      lastStatus = a.status;
    }

    const stageInt = Math.floor(a.stageDecimal);
    const card = document.createElement('article');
    card.className = 'agent-card';
    card.dataset.status = a.status;
    card.dataset.agentId = a.id;
    card.dataset.flash = 'false';

    // Card view: only the top 4 stats so every card stays the same height.
    // Heavier blocks (saleData, programmes, fleet, architectureNote, full
    // stat list) live in the modal opened by the View Details button.
    const topStats = (a.stats || []).slice(0, 4).map(s =>
      `<div class="agent-stat"><div class="agent-stat-label">${s.label}</div><div class="agent-stat-value">${s.value}</div></div>`
    ).join('');

    card.innerHTML = `
      <div class="agent-head">
        <div class="agent-avatar" style="background:${STAGE_BG[stageInt]};color:${STAGE_COLOR[stageInt]}">${a.initials}</div>
        <div class="agent-name-wrap">
          <div class="agent-name-row">
            <span class="agent-name">${a.name}</span>
            <span class="agent-status" data-status="${a.status}">${a.status}</span>
            ${chainBadge(a.chain)}
          </div>
          <div class="agent-sub">
            <span>${a.focus}</span>
            <span class="agent-sub-sep">·</span>
            <span>${a.parent}</span>
            ${a.token && a.token !== '—' ? `<span class="agent-sub-sep">·</span><span>${a.token}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- compact-only inline cells (only show in compact view) -->
      <span class="compact-only compact-status"><span class="agent-status" data-status="${a.status}">${a.status}</span></span>
      <span class="compact-only compact-focus">${a.focus}</span>
      <span class="compact-only compact-token">${a.token || '—'}</span>
      <span class="compact-only compact-stage">
        <span class="compact-pips">${pipPips(stageInt, a.status).replace('class="pips"', 'class="compact-pips-inner"')}</span>
        ${STAGE_LABEL[stageInt]}
      </span>
      <span class="compact-only compact-output">${a.outputN > 0 ? a.outputN.toLocaleString() : '—'}</span>

      <div class="agent-desc">${a.desc}</div>

      ${topStats ? `<div class="agent-stats">${topStats}</div>` : ''}

      <div class="pip-row">
        ${pipPips(stageInt, a.status)}
        <span class="pip-stage-name">${STAGE_LABEL[stageInt]}</span>
      </div>

      <div class="last-signal">
        <span class="last-signal-label">Last signal</span>
        <div>
          <span class="last-signal-time">${a.lastSignal.when}</span> — ${a.lastSignal.text}
        </div>
      </div>

      <button class="agent-cta" type="button" data-open-agent="${a.id}">View details →</button>
    `;
    grid.appendChild(card);
  });
}

// ─── Agent detail modal ─────────────────────────────────────────────────────
function renderAgentDetail(a) {
  const stageInt = Math.floor(a.stageDecimal);
  const allStats = (a.stats || []).map(s =>
    `<div class="agent-stat"><div class="agent-stat-label">${s.label}</div><div class="agent-stat-value">${s.value}</div></div>`
  ).join('');

  return `
    <div class="agent-modal-head">
      <div class="agent-avatar" style="background:${STAGE_BG[stageInt]};color:${STAGE_COLOR[stageInt]}">${a.initials}</div>
      <div class="agent-name-wrap">
        <div class="agent-name-row">
          <span class="agent-name" id="agent-modal-title">${a.name}</span>
          <span class="agent-status" data-status="${a.status}">${a.status}</span>
          ${chainBadge(a.chain)}
        </div>
        <div class="agent-sub">
          <span>${a.focus}</span>
          <span class="agent-sub-sep">·</span>
          <span>${a.parent}</span>
          ${a.token && a.token !== '—' ? `<span class="agent-sub-sep">·</span><span>${a.token}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="agent-desc">${a.desc}</div>

    ${allStats ? `<div class="agent-stats agent-stats--full">${allStats}</div>` : ''}

    ${a.saleData ? saleDataBlock(a.saleData) : ''}

    ${a.programmes ? programmeBlock(a.programmes) : ''}

    ${a.fleet ? fleetBlock(a.fleet) : ''}

    ${a.architectureNote ? architectureNoteBlock(a.architectureNote) : ''}

    <div class="pip-row">
      ${pipPips(stageInt, a.status)}
      <span class="pip-stage-name">${STAGE_LABEL[stageInt]}</span>
    </div>

    <div class="last-signal">
      <span class="last-signal-label">Last signal</span>
      <div>
        <span class="last-signal-time">${a.lastSignal.when}</span> — ${a.lastSignal.text}
      </div>
    </div>

    ${a.link ? `<a class="agent-cta agent-cta--external" href="${a.link}" target="_blank" rel="noopener noreferrer">View on bio.xyz ↗</a>` : ''}
  `;
}

function openAgentModal(agentId) {
  const a = AGENTS.find(x => x.id === agentId);
  if (!a) return;
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  modal.querySelector('.agent-modal-content').innerHTML = renderAgentDetail(a);
  modal.hidden = false;
  // small delay so the [hidden] removal commits before we trigger the
  // transition — otherwise the modal pops in without fading.
  requestAnimationFrame(() => modal.dataset.open = 'true');
  document.body.style.overflow = 'hidden';
}

function closeAgentModal() {
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  modal.dataset.open = 'false';
  // wait for the fade-out before flipping [hidden] back on so the
  // transition isn't cut short
  setTimeout(() => { modal.hidden = true; }, 160);
  document.body.style.overflow = '';
}

function wireAgentModal() {
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  // close on backdrop / × button
  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeAgentModal();
  });
  // ESC key closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeAgentModal();
  });
  // delegate "View details" clicks from the grid
  const grid = document.getElementById('agent-grid');
  if (grid) {
    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-open-agent]');
      if (btn) openAgentModal(btn.dataset.openAgent);
    });
  }
}

// ─── Sort + view ─────────────────────────────────────────────────────────────
const STATUS_RANK = { live: 0, launching: 1, announced: 2, stalled: 3 };
const STATUS_LABEL = { live: 'LIVE', launching: 'LAUNCHING', announced: 'ANNOUNCED', stalled: 'STALLED' };

function sortAgents(key) {
  const sorted = [...AGENTS];
  switch (key) {
    case 'status':
      sorted.sort((a, b) =>
        (STATUS_RANK[a.status] - STATUS_RANK[b.status])
        || ((a.displayOrder ?? 99) - (b.displayOrder ?? 99))
        || (b.stageDecimal - a.stageDecimal)
      );
      break;
    case 'stage':
      sorted.sort((a, b) => b.stageDecimal - a.stageDecimal);
      break;
    case 'output':
      sorted.sort((a, b) => b.outputN - a.outputN);
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

function init() {
  buildLane();
  renderAgents(sortAgents('status'), { groupByStatus: true });
  wireAgentModal();

  const sel = document.getElementById('sort-select');
  sel.addEventListener('change', () => renderAgents(
    sortAgents(sel.value),
    { groupByStatus: sel.value === 'status' }
  ));

  const grid = document.getElementById('agent-grid');
  const bCard = document.getElementById('view-card');
  const bComp = document.getElementById('view-compact');
  function setView(v) {
    grid.dataset.view = v;
    bCard.setAttribute('aria-pressed', v === 'card');
    bComp.setAttribute('aria-pressed', v === 'compact');
  }
  bCard.addEventListener('click', () => setView('card'));
  bComp.addEventListener('click', () => setView('compact'));

  const now = new Date();
  const fmt = now.toUTCString().replace('GMT', 'UTC');
  const statusTime = document.getElementById('status-time');
  if (statusTime) statusTime.textContent = fmt.slice(5, 16);
  const footerDate = document.getElementById('footer-date');
  if (footerDate) footerDate.textContent = now.toISOString().slice(0, 10);

  // re-layout lane on resize so puck Y positions track the lane
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(buildLane, 120);
  });
}

document.addEventListener('DOMContentLoaded', init);
