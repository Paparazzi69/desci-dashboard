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
  'pumpdotscience': 4, 'VitaRNA_DAO': 0, 'HairDAO_': 5,
  'molecule_sci': 3, 'AthenaDAO_': 3, 'paulkhls': 2, 'peptai_': 4,
  // News sources
  'Decrypt': 2, 'The Defiant': 3, 'Endpoints News': 1,
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

// ─── State + rendering ──────────────────────────────────────────────────────

const state = {
  items: [],
  filter: 'all',
  loading: true,
  fallback: null, // populated when /api/feed returns the Nitter-down fallback
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

  const filtered = applyFilter();
  if (filtered.length === 0) {
    list.innerHTML = `<div class="feed-empty">No ${state.filter === 'all' ? '' : state.filter + ' '}posts right now.</div>`;
    return;
  }

  list.innerHTML = filtered.map(item =>
    item.type === 'tweet' ? tweetCardHTML(item) : newsCardHTML(item)
  ).join('');

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
  const mount = document.getElementById('feed-banner-mount');
  if (!mount) return;
  if (state.fallback) {
    mount.innerHTML = `
      <div class="feed-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Twitter feeds are temporarily unavailable — showing news only. Click an account in the sidebar to view on X.</span>
      </div>
    `;
  } else {
    mount.innerHTML = '';
  }
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
