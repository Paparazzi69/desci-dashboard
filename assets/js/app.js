// Main orchestration. Fetches /api/prices, renders the dashboard, and wires
// up sort / filter / drawer interactions.
//
// UX principle (see README): every external dependency degrades gracefully.
// - Stale cache on 429 → amber LIVE indicator + tooltip explanation.
// - Both APIs fail → a friendly empty state, never a blank page.

import { fmt, fmtPct, escapeHtml } from './format.js';
import { metaFor, FILTER_CHIPS, TOKEN_META } from './data.js';
import {
  sectorCardHTML, sectorCardSkeleton,
  filterChipsHTML, tokenHeaderHTML, tokenRowHTML,
  bannerHTML,
  drawerHTML,
} from './components.js';
import { mount as mountBubbleMap } from './bubblemap.js';
import { mount as mountParticleNetwork } from './particle-network.js';

const REFRESH_PRICES_MS = 60_000;
const STALE_THRESHOLD_MS = 90_000;

const state = {
  tokens: [],
  sortKey: 'mcap',
  sortDir: 'desc',
  activeFilter: 'All',
  selectedId: null,
  selectedDetail: null,
  bubbleMapCleanup: null,
  tableNetCleanup: null,    // particle network on the token table
  stripNetCleanup: null,    // particle network on the BioAgent teaser
  lastPriceFetchOk: null,   // timestamp of last successful (fresh) price fetch
  pricesStale: false,       // true if last response was served stale by the API
  pricesError: false,       // true if last fetch threw
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  document.addEventListener('keydown', onKey);
  document.getElementById('main').addEventListener('click', onMainClick);
  document.getElementById('main').addEventListener('keydown', onMainKey);
  document.getElementById('drawer-mount').addEventListener('click', onDrawerClick);
  renderShell();
  mountParticleNetworks();

  await refreshPrices();
  renderBubbleMap();

  setInterval(() => { refreshPrices().then(renderBubbleMap); }, REFRESH_PRICES_MS);
  setInterval(updateLiveIndicator, 5_000);
  setInterval(() => {
    document.getElementById('status-time').textContent =
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 30_000);
}

// ─── Data fetchers ────────────────────────────────────────────────────────────
async function refreshPrices() {
  try {
    const r = await fetch('/api/prices', { cache: 'no-store' });
    if (!r.ok) throw new Error(`prices ${r.status}`);
    const json = await r.json();
    state.tokens = Array.isArray(json.tokens) ? json.tokens : [];
    state.pricesStale = !!json.stale;
    state.pricesError = false;
    if (!json.stale) state.lastPriceFetchOk = Date.now();
  } catch (e) {
    console.warn('Price fetch failed:', e);
    state.pricesError = state.tokens.length === 0; // only flag error if we have nothing to show
  }
  renderTable();
  renderSectorSummary();
  renderFilterChips();
  renderBanner();
  updateLiveIndicator();
}

async function loadTokenDetail(id) {
  state.selectedDetail = null;
  renderDrawer();
  try {
    const r = await fetch('/api/coin/' + encodeURIComponent(id));
    if (!r.ok) throw new Error('coin ' + r.status);
    state.selectedDetail = await r.json();
  } catch (e) {
    console.warn('Coin detail failed:', e);
    state.selectedDetail = { error: true };
  }
  if (state.selectedId === id) renderDrawer();
}

// ─── Particle network backgrounds ─────────────────────────────────────────────
// Mounted once after renderShell — both surfaces are static HTML (always
// present), so we don't need to remount on data refresh. Cleanup fns are
// stored on state for symmetry with bubbleMapCleanup; only invoked if we
// ever tear these surfaces down.
function mountParticleNetworks() {
  const tableWrap = document.querySelector('.token-table-wrap');
  if (tableWrap && !state.tableNetCleanup) {
    state.tableNetCleanup = mountParticleNetwork(tableWrap, { boost: false });
  }
  const teaser = document.querySelector('.bioagent-teaser');
  if (teaser && !state.stripNetCleanup) {
    state.stripNetCleanup = mountParticleNetwork(teaser, { boost: true });
  }
}

// ─── Render: shell ────────────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('status-time').textContent =
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // Date renders today, formatted in en-US (e.g. "May 6, 2026"). Was
  // previously hardcoded and went stale a week at a time, signalling
  // "this dashboard isn't being maintained" to first-time visitors.
  document.getElementById('brand-tagline').textContent =
    `Decentralized Science · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  // Skeleton sector cards
  document.getElementById('sector-summary').innerHTML = [
    'Total Market Cap', '24h Volume', 'Sector 24h Δ', 'Dominant Token', 'Trend',
  ].map(sectorCardSkeleton).join('');
  // Empty filter chips placeholder
  document.getElementById('filter-chips').innerHTML = filterChipsHTML(state.activeFilter, {}, 0);
  document.getElementById('token-thead').innerHTML = tokenHeaderHTML(state.sortKey, state.sortDir);
  document.getElementById('token-tbody').innerHTML = `
    <div class="empty-state">
      <strong>Loading prices…</strong>
      Fetching live data from CoinGecko.
    </div>
  `;
}

// ─── Render: sector summary ───────────────────────────────────────────────────
function renderSectorSummary() {
  const el = document.getElementById('sector-summary');
  if (state.tokens.length === 0 && state.pricesError) {
    el.innerHTML = `
      <div class="empty-state" style="flex:1">
        <strong>Price feed unavailable.</strong>
        We'll retry automatically. Last attempted just now.
      </div>
    `;
    return;
  }
  if (state.tokens.length === 0) return; // keep skeletons
  const totalMcap = state.tokens.reduce((s, t) => s + (t.mcap || 0), 0);
  const totalVol = state.tokens.reduce((s, t) => s + (t.vol || 0), 0);
  // Sector-wide weighted 24h % using mcap as weight
  const wSum = state.tokens.reduce((s, t) => s + (t.mcap || 0) * (t.d1 || 0), 0);
  const sectorChange = totalMcap ? wSum / totalMcap : 0;
  const dominant = [...state.tokens].sort((a, b) => (b.mcap || 0) - (a.mcap || 0))[0];
  const dominance = dominant && totalMcap ? (dominant.mcap / totalMcap * 100).toFixed(1) : '—';
  const positives = state.tokens.filter(t => (t.d1 || 0) >= 0).length;
  const trend = sectorChange >= 1 ? 'Bullish' : sectorChange <= -1 ? 'Bearish' : 'Neutral';
  const trendAccent = sectorChange >= 1 ? 'var(--green)' : sectorChange <= -1 ? 'var(--red)' : 'var(--amber)';

  el.innerHTML = [
    sectorCardHTML('Total Market Cap', fmt(totalMcap), 'Decentralized Science sector', 'var(--green)'),
    sectorCardHTML('24h Volume', fmt(totalVol), 'All tracked tokens', 'var(--blue)'),
    sectorCardHTML('Sector 24h Δ', fmtPct(sectorChange), 'Market-cap weighted', sectorChange >= 0 ? 'var(--green)' : 'var(--red)'),
    sectorCardHTML('Dominant Token', (dominant?.symbol || '—').toUpperCase(), `${dominance}% of sector mcap`, 'var(--amber)'),
    sectorCardHTML('Trend', trend, `${positives} of ${state.tokens.length} tokens positive 24h`, trendAccent),
  ].join('');
}

// ─── Render: filters & table ──────────────────────────────────────────────────
function tokensFiltered() {
  const f = state.activeFilter;
  if (f === 'All') return state.tokens;
  if (f === 'Micro-caps') return state.tokens.filter(t => metaFor(t.id).isMicroCap || t.isMicroCap);
  return state.tokens.filter(t => (metaFor(t.id).tags || []).includes(f));
}

function tokensSorted(arr) {
  const key = state.sortKey;
  const dir = state.sortDir;
  return [...arr].sort((a, b) => {
    const av = a[key] ?? -Infinity;
    const bv = b[key] ?? -Infinity;
    return dir === 'desc' ? bv - av : av - bv;
  });
}

function renderFilterChips() {
  const counts = {};
  for (const f of FILTER_CHIPS) {
    if (f === 'All') counts[f] = state.tokens.length;
    else if (f === 'Micro-caps') counts[f] = state.tokens.filter(t => metaFor(t.id).isMicroCap || t.isMicroCap).length;
    else counts[f] = state.tokens.filter(t => (metaFor(t.id).tags || []).includes(f)).length;
  }
  document.getElementById('filter-chips').innerHTML =
    filterChipsHTML(state.activeFilter, counts, state.tokens.length);
}

function renderTable() {
  document.getElementById('token-thead').innerHTML = tokenHeaderHTML(state.sortKey, state.sortDir);
  const body = document.getElementById('token-tbody');
  if (state.tokens.length === 0 && state.pricesError) {
    body.innerHTML = `
      <div class="empty-state">
        <strong>Couldn't load prices.</strong>
        CoinGecko is unreachable. Retrying every 60 seconds.
      </div>
    `;
    return;
  }
  if (state.tokens.length === 0) {
    body.innerHTML = `<div class="empty-state"><strong>Loading…</strong></div>`;
    return;
  }
  const filtered = tokensSorted(tokensFiltered());
  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state">No tokens match this filter.</div>`;
    return;
  }
  body.innerHTML = filtered.map((t, i) => tokenRowHTML(t, i)).join('');
}

// ─── Render: top banner ───────────────────────────────────────────────────────
// Banners intentionally suppressed — users get 5-10 minute old data on stale
// cache, which is fine for a sector dashboard. The LIVE/STALE/OFFLINE dot in
// the header is the only signal we surface; the empty-state in renderTable
// covers the case where there's literally nothing to show.
function renderBanner() {
  const m = document.getElementById('banner-mount');
  if (m) m.innerHTML = '';
}

// ─── Render: bubble map ───────────────────────────────────────────────────────
function renderBubbleMap() {
  const el = document.getElementById('bubblemap-mount');
  if (!el) return;
  if (state.tokens.length === 0) return;
  // Build tokenImages map: API-supplied logos for every token, with custom
  // overrides from TOKEN_META.customImage. This way every bubble shows a
  // logo (uniform visual rhythm) instead of one image-bubble outlier.
  const tokenImages = {};
  for (const t of state.tokens) {
    if (t.image) tokenImages[t.id] = t.image;
  }
  for (const [id, meta] of Object.entries(TOKEN_META)) {
    if (meta.customImage) tokenImages[id] = meta.customImage; // override
  }
  // Cleanup previous instance
  if (state.bubbleMapCleanup) { state.bubbleMapCleanup(); state.bubbleMapCleanup = null; }
  state.bubbleMapCleanup = mountBubbleMap(el, state.tokens, (id) => openDrawer(id), tokenImages);
}

// ─── Render: drawer ───────────────────────────────────────────────────────────
function renderDrawer() {
  const m = document.getElementById('drawer-mount');
  if (!state.selectedId) { m.innerHTML = ''; return; }
  const token = state.tokens.find(t => t.id === state.selectedId);
  if (!token) { m.innerHTML = ''; return; }
  m.innerHTML = drawerHTML(token, state.selectedDetail);
}

// ─── Live indicator state machine ─────────────────────────────────────────────
function updateLiveIndicator() {
  const dot = document.getElementById('live-dot');
  const orb = dot.querySelector('.live-dot-orb');
  const label = dot.querySelector('.live-dot-label');
  let stateStr = 'live';
  let labelText = 'LIVE';
  let title = 'Live data';

  if (state.pricesError && state.tokens.length === 0) {
    stateStr = 'error';
    labelText = 'OFFLINE';
    title = 'Price feed unreachable';
  } else if (state.pricesStale || (state.lastPriceFetchOk && Date.now() - state.lastPriceFetchOk > STALE_THRESHOLD_MS)) {
    stateStr = 'stale';
    labelText = 'STALE';
    title = 'Showing cached data';
  } else if (state.lastPriceFetchOk === null) {
    stateStr = 'loading';
    labelText = 'LOADING';
    title = 'Fetching prices';
  }
  dot.dataset.state = stateStr;
  label.textContent = labelText;
  dot.title = title;
}

// ─── Event delegation ─────────────────────────────────────────────────────────
function onMainClick(e) {
  // Filter chip
  const chip = e.target.closest('.filter-chip');
  if (chip) {
    state.activeFilter = chip.dataset.filter;
    renderFilterChips();
    renderTable();
    return;
  }
  // Sortable header
  const th = e.target.closest('.token-th[data-sortable="true"]');
  if (th) {
    const key = th.dataset.sortkey;
    if (state.sortKey === key) state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
    else { state.sortKey = key; state.sortDir = 'desc'; }
    renderTable();
    return;
  }
  // Token row
  const row = e.target.closest('.token-row');
  if (row) {
    openDrawer(row.dataset.id);
    return;
  }
}

function onMainKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    const row = e.target.closest('.token-row');
    if (row) {
      e.preventDefault();
      openDrawer(row.dataset.id);
    }
  }
}

function onDrawerClick(e) {
  if (e.target.closest('[data-drawer-close="true"]')) closeDrawer();
}

function onKey(e) {
  if (e.key === 'Escape' && state.selectedId) closeDrawer();
}

function openDrawer(id) {
  state.selectedId = id;
  state.selectedDetail = null;
  renderDrawer();
  loadTokenDetail(id);
}

function closeDrawer() {
  state.selectedId = null;
  state.selectedDetail = null;
  renderDrawer();
}

boot();
