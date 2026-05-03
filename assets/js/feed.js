// feed.js — News reader. Reads /api/feed-v2 (D1-backed approved + featured
// items with editorial "your take" commentary). Featured items pin to the
// top with a "Featured" badge; otherwise sorted by publishedAt desc.

// ─── Avatar palette ──────────────────────────────────────────────────────────
const PALETTE = [
  { bg: 'var(--green-bg)',  fg: 'var(--green)'  },
  { bg: 'var(--amber-bg)',  fg: 'var(--amber)'  },
  { bg: 'var(--blue-bg)',   fg: 'var(--blue)'   },
  { bg: 'var(--purple-bg)', fg: 'var(--purple)' },
  { bg: 'var(--teal-bg)',   fg: 'var(--teal)'   },
  { bg: 'var(--red-bg)',    fg: 'var(--red)'    },
];

function colorFor(key) {
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(s) {
  if (!s) return '??';
  const parts = String(s).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(s).slice(0, 2).toUpperCase();
}

// Relative time from a unix-seconds timestamp.
function relTime(unixSec) {
  if (!unixSec) return '';
  const s = Math.max(0, Date.now() / 1000 - unixSec);
  if (s < 60)         return Math.floor(s) + 's';
  if (s < 3600)       return Math.floor(s / 60) + 'm';
  if (s < 86400)      return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7)  return Math.floor(s / 86400) + 'd';
  return new Date(unixSec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

// ─── Card builder ───────────────────────────────────────────────────────────
function newsCardHTML(item) {
  const c = colorFor(item.source);
  const ini = initials(item.source);
  const time = relTime(item.publishedAt);
  const sourceType = item.sourceType || 'media';
  const featuredBadge = item.featured
    ? '<span class="post-featured-badge">Featured</span>'
    : '';
  const summaryBlock = item.summary
    ? `<div class="post-summary">${escapeHtml(item.summary)}</div>`
    : '';
  const takeBlock = item.take
    ? `<div class="post-take">
         <span class="post-take-label">Take</span>
         <span class="post-take-text">${escapeHtml(item.take)}</span>
       </div>`
    : '';
  return `
    <a class="post-card news${item.featured ? ' featured' : ''}"
       href="${escapeHtml(item.url || '#')}"
       target="_blank" rel="noopener noreferrer">
      <div class="post-avatar" style="background:${c.bg};color:${c.fg}">${escapeHtml(ini)}</div>
      <div class="post-content">
        <div class="post-header">
          <span class="post-name">${escapeHtml(item.source || 'News')}</span>
          <span class="post-source-type post-source-type-${escapeHtml(sourceType)}">${escapeHtml(sourceType)}</span>
          ${featuredBadge}
          <span class="post-time">${escapeHtml(time)}</span>
        </div>
        <div class="post-title">${escapeHtml(item.title || '')}</div>
        ${summaryBlock}
        ${takeBlock}
      </div>
    </a>
  `;
}

// ─── State + rendering ──────────────────────────────────────────────────────
const state = {
  items: [],
  loading: true,
};

function render() {
  const list = document.getElementById('feed-list');
  if (!list) return;

  if (state.loading) {
    list.innerHTML = '<div class="feed-loading">Loading news…</div>';
    return;
  }
  if (state.items.length === 0) {
    list.innerHTML = `<div class="feed-empty">No approved items yet. Visit /admin to triage the pending queue.</div>`;
    return;
  }

  // Featured first, then by publishedAt desc.
  const sorted = state.items.slice().sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return (b.publishedAt || 0) - (a.publishedAt || 0);
  });
  list.innerHTML = sorted.map(newsCardHTML).join('');

  list.querySelectorAll('.post-card').forEach((el, i) => {
    el.style.animationDelay = `${Math.min(i, 20) * 30}ms`;
  });
}

// ─── Data fetch ─────────────────────────────────────────────────────────────
async function loadFeed() {
  state.loading = true;
  render();
  try {
    const r = await fetch('/api/feed-v2', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    state.items = Array.isArray(data.items) ? data.items : [];
    state.loading = false;
    render();
  } catch (e) {
    state.loading = false;
    state.items = [];
    const list = document.getElementById('feed-list');
    if (list) {
      list.innerHTML = `<div class="feed-empty">Couldn't load news: ${escapeHtml(e.message || e)}</div>`;
    }
  }
}

// ─── Wire up ────────────────────────────────────────────────────────────────
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
