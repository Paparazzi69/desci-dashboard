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
    focus: 'Longevity',
    token: '$AUBRAI', tokenNote: '150x from $269K pre-sale',
    parent: 'VitaDAO',
    launchDate: 'Aug 25, 2025',
    link: 'https://app.bio.xyz/agents/aubrai',
    desc: "Longevity AI agent built with VitaDAO & Dr. Aubrey de Grey. Trained on de Grey's unpublished lab data. Runs on ElizaOS v2 in Phala Cloud TEE.",
    stats: [
      { label: 'Token',       value: '$AUBRAI' },
      { label: 'Peak FDV',    value: '$40M' },
      { label: 'Hypotheses',  value: '1,000+' },
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
    lastSignal: { when: '3d ago', text: 'Launched VitaSTEM — first AI-enabled IP-Token, analyzing 850K+ human stem cell transcriptomes.' },
    output: '1,000+ hypotheses · 2 IP-NFTs · 2,211+ PoI',
    outputN: 1000,
  },
  {
    id: 'peptai', name: 'PeptAI', initials: 'Pe',
    status: 'live', stage: 2, stageDecimal: 2.55,
    focus: 'Drug Discovery',
    token: 'listed on bio.xyz', tokenNote: "Catalyst for BIO's 120% April rally",
    parent: 'Bio Protocol core',
    launchDate: '2025',
    link: 'https://app.bio.xyz/agents/peptai',
    desc: 'Autonomous peptide drug discovery agent. Designed OX2R-004 (novel ADHD peptide) in 24 hours for ~$1,500 wet lab cost. 8-gate validation pipeline, receptor agnostic.',
    stats: [
      { label: 'Active GPCRs',     value: 'GLP1R · KISS1R · OX2R' },
      { label: '$ / molecule',     value: '~$1,500' },
      { label: 'Validation gates', value: '8' },
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
    lastSignal: { when: '6d ago', text: 'OX2R-004 advances to wet-lab validation. Cost-per-molecule remains ~$1,500.' },
    output: 'OX2R-004 peptide · GPCR-agnostic platform',
    outputN: 850,
  },
  {
    id: 'clawdlab', name: 'ClawdLab', initials: 'Cl',
    status: 'live', stage: 3, stageDecimal: 3.5,
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
    lastSignal: { when: '9d ago', text: 'Moltbook generated 1.5M AI agents in 72 hours. ArXiv paper by Weidener et al. published.' },
    output: '6+ academic papers · 1.5M agents spawned',
    outputN: 600,
  },
  {
    id: 'biomeai', name: 'BiomeAI', initials: 'Bi',
    status: 'launching', stage: 1, stageDecimal: 1.45,
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
    lastSignal: { when: '2w ago', text: 'Minted first Microbiome Proof-of-Invention with AUBRAI. Beta cohort onboarding.' },
    output: '1 Microbiome PoI · cohort onboarding',
    outputN: 80,
  },
  {
    id: 'dermalabs', name: 'DermaLabs', initials: 'De',
    status: 'launching', stage: 1, stageDecimal: 1.4,
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
    id: 'gocart', name: 'GoCART', initials: 'Go',
    status: 'launching', stage: 1, stageDecimal: 1.55,
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
    status: 'announced', stage: 0, stageDecimal: 0.25,
    focus: 'Data Analysis',
    token: '—',
    parent: 'Bio Protocol',
    desc: 'Autonomous Python-based data analysis tool inside the Bio ecosystem. Announced infrastructure agent.',
    stats: [
      { label: 'Status', value: 'Announced' },
      { label: 'Type',   value: 'Infrastructure' },
    ],
    lastSignal: { when: '5w ago', text: 'Announced as infrastructure-tier agent. Autonomous data analysis for BioDAO outputs.' },
    output: 'Announced · infrastructure',
    outputN: 5,
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

// ─── Pipeline Lane — pucks ───────────────────────────────────────────────────
const STATUS_RANK_LANE = { live: 0, launching: 1, announced: 2 };

function buildLane() {
  const buckets = { 0: [], 1: [], 2: [], 3: [] };
  AGENTS.forEach(a => buckets[Math.floor(a.stageDecimal)].push(a));
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
      const out = a.status === 'announced' ? 'Announced' : a.output;
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

function renderAgents(list) {
  const grid = document.getElementById('agent-grid');
  // wipe everything except compact-header
  grid.querySelectorAll('.agent-card').forEach(n => n.remove());

  list.forEach(a => {
    const stageInt = Math.floor(a.stageDecimal);
    const card = document.createElement('article');
    card.className = 'agent-card';
    card.dataset.status = a.status;
    card.dataset.agentId = a.id;
    card.dataset.flash = 'false';

    const stats = (a.stats || []).map(s =>
      `<div class="agent-stat"><div class="agent-stat-label">${s.label}</div><div class="agent-stat-value">${s.value}</div></div>`
    ).join('');

    card.innerHTML = `
      <div class="agent-head">
        <div class="agent-avatar" style="background:${STAGE_BG[stageInt]};color:${STAGE_COLOR[stageInt]}">${a.initials}</div>
        <div class="agent-name-wrap">
          <div class="agent-name-row">
            <span class="agent-name">${a.name}</span>
            <span class="agent-status" data-status="${a.status}">${a.status}</span>
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

      ${a.stats ? `<div class="agent-stats">${stats}</div>` : ''}

      ${a.programmes ? programmeBlock(a.programmes) : ''}

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

      ${a.status !== 'announced' ? `<a class="agent-cta" href="${a.link || 'https://bio.xyz/'}" target="_blank" rel="noopener noreferrer">View details ↗</a>` : ''}
    `;
    grid.appendChild(card);
  });
}

// ─── Sort + view ─────────────────────────────────────────────────────────────
const STATUS_RANK = { live: 0, launching: 1, announced: 2 };

function sortAgents(key) {
  const sorted = [...AGENTS];
  switch (key) {
    case 'status':
      sorted.sort((a, b) =>
        (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (b.stageDecimal - a.stageDecimal)
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
  renderAgents(sortAgents('status'));

  const sel = document.getElementById('sort-select');
  sel.addEventListener('change', () => renderAgents(sortAgents(sel.value)));

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
