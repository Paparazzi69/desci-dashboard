// BioAgent Tracker — autonomous AI co-scientist registry.
// DOM rendering of an editorial dataset loaded from /data/bioagents.json at
// startup (see loadAndInit at file end). The AGENTS array drives the lane viz,
// the agent grid (card + compact views), and the sort/filter controls.
//
// Pipeline stages:
//   0 = Hypothesis (generate + mint onchain)
//   1 = Computational (in-silico validation, peptide design, docking)
//   2 = Wet Lab (synthesis + assays)
//   3 = Clinical (animal/Phase 1+ / FDA-EMA pathway / live infrastructure)
//
// stageDecimal lets us track sub-progress within a stage for sorting (e.g.
// 2.55 = mid wet-lab) without changing the integer bucket the lane uses.

// Update weekly by checking beach.science homepage. TODO: automate via Pages Function fetching beach.science and parsing counters.
const SCIENCE_BEACH_METRICS = {
  agents: 776,
  hypotheses: 6143,
  verified: 74,
  humans: 206,
  updatedAt: '2026-05-06',
  sourceUrl: 'https://beach.science',
};

let AGENTS = []; // populated from /data/bioagents.json by loadAndInit() at file end

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

// ─── CTA label ──────────────────────────────────────────────────────────────
// The modal "View on …" CTA used to hardcode "BIO.XYZ" regardless of where the
// link actually pointed (Science Beach → beach.science, Spore.fun → spore.fun,
// etc., all mislabeled). Derive the visible domain from the URL instead. Falls
// back to "VIEW SOURCE ↗" for malformed links so the button still renders.
function ctaLabel(link) {
  try {
    const url = new URL(link);
    const domain = url.hostname.replace(/^www\./, '').toUpperCase();
    return `VIEW ON ${domain} ↗`;
  } catch (_) {
    return 'VIEW SOURCE ↗';
  }
}

// ─── Pipeline Lane — pucks ───────────────────────────────────────────────────
const STATUS_RANK_LANE = { live: 0, launching: 1, announced: 2, stalled: 3 };

function buildLane() {
  const buckets = { 0: [], 1: [], 2: [], 3: [] };
  // Lane is exclusive to the BioAgents segment — IPTs and cross-ecosystem
  // entries are intentionally filtered out so the visualization stays
  // focused on the AI-co-scientist pipeline it was designed for.
  AGENTS.forEach(a => {
    if (a.excludeFromLane) return;
    if (a.segment !== 'bioagent') return;
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
          <div style="color:var(--text2);font-size:10px;line-height:1.5">Last signal · ${a.lastSignal.when} · ${a.lastSignal.text}</div>
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
    // Plain 3-column variant: row is [col1, col2, col3] (no gates/stage/note).
    // Used by entries that just want a flat table (e.g. Science Beach top
    // researchers) without the gate-progress visualization.
    if (Array.isArray(r)) {
      return `
        <div class="programme-row programme-row--plain">
          <div class="programme-name">${r[0] || ''}</div>
          <div class="programme-plain-cell">${r[1] || ''}</div>
          <div class="programme-plain-cell">${r[2] || ''}</div>
        </div>
      `;
    }
    const gates = (r.gates || []).map(g => {
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
          <span class="last-signal-time">${a.lastSignal.when}</span> · ${a.lastSignal.text}
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
        <span class="last-signal-time">${a.lastSignal.when}</span> · ${a.lastSignal.text}
      </div>
    </div>

    ${a.link ? `<a class="agent-cta agent-cta--external" href="${a.link}" target="_blank" rel="noopener noreferrer">${ctaLabel(a.link)}</a>` : ''}
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

function sortAgents(key, source = AGENTS) {
  const sorted = [...source];
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

// ─── Segment tabs (Stage 2) ─────────────────────────────────────────────────
// Maps the URL/click param ↔ the per-agent `segment` field. Tabs are the
// outer slice of the dataset; sort/grouping then applies inside each slice.
//
// "Platforms" is the infrastructure layer (research platform, public commons,
// shared API) where agents and research live. "Adjacent" replaces the old
// "Cross-ecosystem" label, but keeps the original `cross-ecosystem` segment
// value so per-entry data stays untouched.
const TAB_TO_SEGMENT = {
  bioagents: 'bioagent',
  ipts: 'ipt',
  platforms: 'platform',
  adjacent: 'cross-ecosystem',
};
const SEGMENT_TO_TAB = {
  bioagent: 'bioagents',
  ipt: 'ipts',
  platform: 'platforms',
  'cross-ecosystem': 'adjacent',
};
// Backward-compat for old direct links that used ?tab=cross.
const TAB_ALIASES = { cross: 'adjacent' };
// Section header text shown above the agent grid for each tab. Status-group
// headers (LIVE/LAUNCHING/...) are unaffected.
const TAB_HEADER_LABEL = {
  bioagents: 'Agents',
  ipts: 'IPTs / Compounds',
  platforms: 'Platforms',
  adjacent: 'Projects',
};
let currentTab = 'bioagents';

function getCurrentSegmentList() {
  const segment = TAB_TO_SEGMENT[currentTab] || 'bioagent';
  return AGENTS.filter(a => a.segment === segment);
}

function renderForCurrentTab() {
  const sortKey = (document.getElementById('sort-select') || {}).value || 'status';
  const list = sortAgents(sortKey, getCurrentSegmentList());
  renderAgents(list, { groupByStatus: sortKey === 'status' });
  // Pipeline lane is only meaningful for BioAgents — hide on other tabs.
  const isBioAgentsTab = currentTab === 'bioagents';
  const lane = document.querySelector('.lane-section');
  if (lane) lane.hidden = !isBioAgentsTab;
  // Same treatment for any explainer/stack section that describes the
  // BioAgent workflow specifically (How BioAgents Work, Architecture /
  // Framework / Onchain Actions cards). They'd misframe IPTs and
  // cross-ecosystem entries as if those follow the BioAgent value chain.
  document.querySelectorAll('[data-bioagent-only]').forEach(el => {
    el.hidden = !isBioAgentsTab;
  });
}

function updateTabCounts() {
  const counts = AGENTS.reduce((acc, a) => {
    acc[a.segment] = (acc[a.segment] || 0) + 1;
    return acc;
  }, {});
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const seg = TAB_TO_SEGMENT[btn.dataset.tab];
    const slot = btn.querySelector('.tracker-tab-count');
    if (slot && seg) slot.textContent = counts[seg] || 0;
  });
}

function setTab(tab, opts = {}) {
  if (TAB_ALIASES[tab]) tab = TAB_ALIASES[tab];
  if (!TAB_TO_SEGMENT[tab]) tab = 'bioagents';
  currentTab = tab;
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    btn.classList.toggle('is-active', active);
  });
  // Section header above the grid swaps per tab (Agents / IPTs / Platforms /
  // Projects). Hardcoded "Agents" used to lie on every tab.
  const headerLabel = document.getElementById('grid-section-label');
  if (headerLabel) headerLabel.textContent = TAB_HEADER_LABEL[tab] || 'Agents';
  // Sector activity banner is scoped to the Platforms tab only — those metrics
  // belong to Science Beach, not the whole tracker. Showing it everywhere
  // misleads visitors into reading 776 agents / 6,143 hypotheses as global.
  const banner = document.getElementById('sector-activity');
  if (banner) banner.hidden = tab !== 'platforms';
  // Keep the agent-grid (the single tabpanel) labelled by the active tab.
  const grid = document.getElementById('agent-grid');
  if (grid) grid.setAttribute('aria-labelledby', `tab-${tab}`);
  renderForCurrentTab();
  if (opts.updateUrl !== false) {
    const url = new URL(window.location.href);
    if (tab === 'bioagents') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    history.replaceState(null, '', url.toString());
  }
}

function wireTabs() {
  updateTabCounts();
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
  // honor ?tab=… on initial load. setTab() handles aliases (?tab=cross →
  // adjacent) and unknown values (fall back to bioagents).
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  setTab(urlTab || 'bioagents', { updateUrl: false });
}

// ─── Sector activity banner ─────────────────────────────────────────────────
// Renders SCIENCE_BEACH_METRICS into the always-visible header banner above
// the segment tabs. Inline metrics with comma-separated thousands; source
// line includes a clickable beach.science link.
function renderSectorActivity() {
  const metricsEl = document.getElementById('sector-activity-metrics');
  const sourceEl = document.getElementById('sector-activity-source');
  if (!metricsEl || !sourceEl) return;
  const m = SCIENCE_BEACH_METRICS;
  const items = [
    { label: 'Agents',     value: m.agents },
    { label: 'Hypotheses', value: m.hypotheses },
    { label: 'Verified',   value: m.verified },
    { label: 'Humans',     value: m.humans },
  ];
  metricsEl.innerHTML = items.map(it => `
    <div class="sector-activity-metric">
      <span class="sector-activity-metric-value">${it.value.toLocaleString('en-US')}</span>
      <span class="sector-activity-metric-label">${it.label}</span>
    </div>
  `).join('');
  sourceEl.innerHTML = `Live metrics from Science Beach · <a href="${m.sourceUrl}" target="_blank" rel="noopener">beach.science</a> · updated ${m.updatedAt}`;
}

function init() {
  renderSectorActivity();
  buildLane();
  wireAgentModal();
  wireTabs(); // sets initial tab + renders the right segment

  const sel = document.getElementById('sort-select');
  sel.addEventListener('change', renderForCurrentTab);

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

function showTrackerError() {
  const grid = document.getElementById('agent-grid');
  if (grid) grid.innerHTML =
    '<div style="padding:48px 24px;text-align:center;font-family:\'JetBrains Mono\',monospace;' +
    'font-size:13px;line-height:1.9;color:var(--text,#cbd5d1)">' +
    'Could not load the agent registry. Refresh in a moment.<br>' +
    '<span style="opacity:0.55;font-size:11px">// could not load /data/bioagents.json</span></div>';
}

// Load the editorial dataset, then run the existing init(). A visible error
// state (not a silent blank page) if the file is missing or malformed.
function loadAndInit() {
  fetch('/data/bioagents.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error('empty dataset');
      AGENTS = data;
      init();
    })
    .catch(function () { showTrackerError(); });
}

document.addEventListener('DOMContentLoaded', loadAndInit);
