// feed.js — Twitter + news reader.
// Reads /api/feed (the same endpoint the dashboard sidebar used) and renders
// items as clickable cards. Click anywhere on a card → opens its source URL
// in a new tab.

// ─── Avatar palette ──────────────────────────────────────────────────────────
// Maps known Twitter handles + news sources to a consistent color so the same
// account always gets the same avatar tint. Unknown handles fall back to a
// stable hash-derived color from the same palette.
const PALETTE = [
  { bg: 'var(--green-bg)',  fg: 'var(--green)'  },
  { bg: 'var(--amber-bg)',  fg: 'var(--amber)'  },
  { bg: 'var(--blue-bg)',   fg: 'var(--blue)'   },
  { bg: 'var(--purple-bg)', fg: 'var(--purple)' },
  { bg: 'var(--teal-bg)',   fg: 'var(--teal)'   },
  { bg: 'var(--red-bg)',    fg: 'var(--red)'    },
];

const KNOWN = {
  // Twitter handles → palette index
  'BioProtocol': 0, 'VitaDAO': 1, 'origin_trail': 2, 'ResearchHub': 1,
  'pumpdotscience': 4, 'HairDAO_': 5, 'synapseneuro_ai': 0,
  'molecule_sci': 3, 'AthenaDAO_': 3, 'paulkhls': 2, 'peptai_': 4,
  // News sources
  'Decrypt': 2, 'The Defiant': 3,
};

function colorFor(key) {
  if (key && KNOWN[key] !== undefined) return PALETTE[KNOWN[key]];
  // Stable hash → palette index for unknown keys
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(s) {
  if (!s) return '??';
  // For multi-word names ("Bio Protocol", "The Defiant") use first letter of
  // first two words. For handles use the first 2 letters.
  const parts = String(s).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(s).slice(0, 2).toUpperCase();
}

// Relative time: "2m", "1h", "1d". Falls back to date string for >7d.
function relTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60)         return Math.floor(s) + 's';
  if (s < 3600)       return Math.floor(s / 60) + 'm';
  if (s < 86400)      return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7)  return Math.floor(s / 86400) + 'd';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

// Render hashtags / cashtags as styled spans inline. We don't link them out
// since clicking the card already navigates to the original.
function renderText(text) {
  return escapeHtml(text).replace(
    /([#$][A-Za-z0-9_]+)/g,
    '<span class="post-text-tag">$1</span>'
  );
}

// ─── Card builders ──────────────────────────────────────────────────────────

function tweetCardHTML(item) {
  const c = colorFor(item.handle);
  const ini = initials(item.handle || item.name);
  const time = relTime(item.timestamp);
  const verifiedSvg = item.verified
    ? `<svg class="post-verified" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>`
    : '';
  return `
    <a class="post-card tweet" href="${escapeHtml(item.url || '#')}"
       target="_blank" rel="noopener noreferrer">
      <div class="post-avatar" style="background:${c.bg};color:${c.fg}">${escapeHtml(ini)}</div>
      <div class="post-content">
        <div class="post-header">
          <span class="post-name">${escapeHtml(item.name || item.handle || '')}</span>
          ${verifiedSvg}
          <span class="post-handle">@${escapeHtml(item.handle || '')}</span>
          <span class="post-time">${escapeHtml(time)}</span>
        </div>
        <div class="post-text">${renderText(item.text || '')}</div>
      </div>
    </a>
  `;
}

function newsCardHTML(item) {
  const c = colorFor(item.source);
  const ini = initials(item.source);
  const time = relTime(item.timestamp);
  return `
    <a class="post-card news" href="${escapeHtml(item.url || '#')}"
       target="_blank" rel="noopener noreferrer">
      <div class="post-avatar" style="background:${c.bg};color:${c.fg}">${escapeHtml(ini)}</div>
      <div class="post-content">
        <div class="post-header">
          <span class="post-name">${escapeHtml(item.source || 'News')}</span>
          <span class="post-news-badge">News</span>
          <span class="post-time">${escapeHtml(time)}</span>
        </div>
        <div class="post-text">${escapeHtml(item.text || '')}</div>
      </div>
    </a>
  `;
}

// ─── Featured projects ─────────────────────────────────────────────────────
// Pinned editorial cards at the top of the feed. Click to expand project
// details with links — works like the token drawer on the main dashboard.

const FEATURED_PROJECTS = [
  {
    id: 'peptai',
    name: 'PeptAI',
    handle: 'peptai_',
    text: 'PeptAI agent is now live on BIO Protocol — AI-powered peptide drug discovery meets decentralized science.',
    description: 'PeptAI is an AI-driven peptide therapeutics discovery platform built within the BIO Protocol ecosystem. Uses machine learning models to accelerate peptide drug candidate identification, reducing the traditional discovery timeline from years to months. Currently operating as a BIO Agent with on-chain governance and funding.',
    focus: 'AI-DeSci',
    focusColor: 'teal',
    links: [
      { label: 'BIO Agent', href: 'https://app.bio.xyz/agents/peptai' },
      { label: 'Website', href: 'https://peptai.xyz/' },
      { label: 'Twitter', href: 'https://x.com/peptai_' },
    ],
  },
];

function featuredCardHTML(project) {
  const c = colorFor(project.handle);
  const ini = initials(project.name);
  const expanded = state.expandedFeatured === project.id;
  const chevron = expanded
    ? '<svg class="featured-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
    : '<svg class="featured-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  return `
    <div class="post-card featured${expanded ? ' expanded' : ''}" data-featured-id="${escapeHtml(project.id)}">
      <div class="post-avatar" style="background:${c.bg};color:${c.fg}">${escapeHtml(ini)}</div>
      <div class="post-content">
        <div class="post-header">
          <span class="post-name">${escapeHtml(project.name)}</span>
          <span class="post-handle">@${escapeHtml(project.handle)}</span>
          <span class="post-featured-badge">Featured</span>
          ${chevron}
        </div>
        <div class="post-text">${renderText(project.text)}</div>
        ${expanded ? featuredDetailHTML(project) : ''}
      </div>
    </div>
  `;
}

function featuredDetailHTML(project) {
  const linksHTML = project.links.map(l =>
    `<a class="featured-link" href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}<span class="featured-link-arrow">↗</span></a>`
  ).join('');
  return `
    <div class="featured-detail">
      <div class="featured-desc">${escapeHtml(project.description)}</div>
      <div class="featured-meta">
        <span class="featured-focus" data-color="${escapeHtml(project.focusColor)}">${escapeHtml(project.focus)}</span>
      </div>
      <div class="featured-links">${linksHTML}</div>
    </div>
  `;
}

// ─── State + rendering ──────────────────────────────────────────────────────

const state = {
  items: [],
  filter: 'all',
  loading: true,
  fallback: null,
  expandedFeatured: null,
};

function applyFilter() {
  if (state.filter === 'all') return state.items;
  return state.items.filter(i => i.type === state.filter);
}

function render() {
  const list = document.getElementById('feed-list');
  if (!list) return;

  if (state.loading) {
    list.innerHTML = '<div class="feed-loading">Loading feed…</div>';
    return;
  }

  // Counts
  const tweets = state.items.filter(i => i.type === 'tweet').length;
  const news   = state.items.filter(i => i.type === 'news').length;
  setText('count-all',   `· ${state.items.length}`);
  setText('count-tweet', tweets ? `· ${tweets}` : '');
  setText('count-news',  news ? `· ${news}` : '');

  // Featured projects — always pinned at top regardless of filter
  const featuredHTML = FEATURED_PROJECTS.map(p => featuredCardHTML(p)).join('');

  const filtered = applyFilter();
  if (filtered.length === 0 && FEATURED_PROJECTS.length === 0) {
    list.innerHTML = `<div class="feed-empty">No ${state.filter === 'all' ? '' : state.filter + ' '}posts right now.</div>`;
    return;
  }

  const itemsHTML = filtered.map(item =>
    item.type === 'tweet' ? tweetCardHTML(item) : newsCardHTML(item)
  ).join('');

  list.innerHTML = featuredHTML + itemsHTML;

  // Stagger the fadeUp animation
  list.querySelectorAll('.post-card').forEach((el, i) => {
    el.style.animationDelay = `${Math.min(i, 20) * 30}ms`;
  });
}

function renderRailAccounts() {
  const wrap = document.getElementById('feed-rail-accounts');
  if (!wrap) return;
  // Distinct handles from the current items
  const seen = new Map();
  for (const it of state.items) {
    if (it.type === 'tweet' && it.handle && !seen.has(it.handle)) {
      seen.set(it.handle, it.name || it.handle);
    }
  }
  if (state.fallback?.accounts) {
    for (const h of state.fallback.accounts) {
      if (!seen.has(h)) seen.set(h, h);
    }
  }
  const handles = Array.from(seen.entries()).slice(0, 8);
  if (handles.length === 0) {
    wrap.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:var(--text3)">—</div>';
    return;
  }
  wrap.innerHTML = handles.map(([handle, name]) => {
    const c = colorFor(handle);
    return `
      <a class="feed-rail-account" href="https://x.com/${escapeHtml(handle)}"
         target="_blank" rel="noopener noreferrer">
        <div class="post-avatar" style="width:28px;height:28px;font-size:9px;background:${c.bg};color:${c.fg}">${escapeHtml(initials(handle))}</div>
        <div>
          <div class="feed-rail-account-name">${escapeHtml(name)}</div>
          <div class="feed-rail-account-handle">@${escapeHtml(handle)}</div>
        </div>
      </a>
    `;
  }).join('');
}

function renderBanner() {
  // Banner intentionally suppressed — when Nitter RSS is down we still render
  // the news items + featured projects + sidebar accounts, which is enough
  // for users to navigate. No need to surface infra hiccups.
  const mount = document.getElementById('feed-banner-mount');
  if (mount) mount.innerHTML = '';
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

// ─── Data fetch ─────────────────────────────────────────────────────────────

async function loadFeed() {
  state.loading = true;
  render();
  try {
    const r = await fetch('/api/feed', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    if (data.fallback) {
      // RSS down — show news only + banner pointing to X.com profiles
      state.items = (data.news || []).slice();
      state.fallback = data;
    } else {
      state.items = data.items || [];
      state.fallback = null;
    }
    state.loading = false;
    render();
    renderBanner();
    renderRailAccounts();
  } catch (e) {
    state.loading = false;
    state.items = [];
    const list = document.getElementById('feed-list');
    if (list) {
      list.innerHTML = `<div class="feed-empty">Couldn't load feed: ${escapeHtml(e.message || e)}</div>`;
    }
  }
}

// ─── Wire up ────────────────────────────────────────────────────────────────

document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p === pill);
      p.setAttribute('aria-selected', p === pill ? 'true' : 'false');
    });
    state.filter = pill.dataset.filter;
    render();
  });
});

// Featured card expand/collapse
document.getElementById('feed-list').addEventListener('click', (e) => {
  const card = e.target.closest('.post-card.featured');
  if (!card) return;
  // Let links inside the expanded detail navigate normally
  if (e.target.closest('a.featured-link')) return;
  e.preventDefault();
  const id = card.dataset.featuredId;
  state.expandedFeatured = state.expandedFeatured === id ? null : id;
  render();
});

const refreshBtn = document.getElementById('feed-refresh');
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('spinning');
    refreshBtn.disabled = true;
    await loadFeed();
    refreshBtn.classList.remove('spinning');
    refreshBtn.disabled = false;
  });
}

loadFeed();
