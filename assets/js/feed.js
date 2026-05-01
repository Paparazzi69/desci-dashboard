// feed.js — News reader + featured BioAgent projects.
// Reads /api/feed (news only — Twitter via Nitter was removed; the mirror
// network was too flaky to ship as a primary signal). Featured projects
// are pinned editorial cards at the top, hardcoded below — click to expand
// project info and links.

// ─── Avatar palette ──────────────────────────────────────────────────────────
// Maps known sources/handles to a consistent palette tint so the same source
// always gets the same avatar color. Unknown keys fall back to a stable
// hash-derived index from the same palette.
const PALETTE = [
  { bg: 'var(--green-bg)',  fg: 'var(--green)'  },
  { bg: 'var(--amber-bg)',  fg: 'var(--amber)'  },
  { bg: 'var(--blue-bg)',   fg: 'var(--blue)'   },
  { bg: 'var(--purple-bg)', fg: 'var(--purple)' },
  { bg: 'var(--teal-bg)',   fg: 'var(--teal)'   },
  { bg: 'var(--red-bg)',    fg: 'var(--red)'    },
];

const KNOWN = {
  // News sources
  'Decrypt': 2, 'The Defiant': 3,
  // Featured project handles (used by featuredCardHTML via colorFor)
  'synapseneuro_ai': 0, 'peptai_': 4,
};

function colorFor(key) {
  if (key && KNOWN[key] !== undefined) return PALETTE[KNOWN[key]];
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

function renderText(text) {
  return escapeHtml(text).replace(
    /([#$][A-Za-z0-9_]+)/g,
    '<span class="post-text-tag">$1</span>'
  );
}

// ─── Card builders ──────────────────────────────────────────────────────────

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
  loading: true,
  expandedFeatured: null,
};

function render() {
  const list = document.getElementById('feed-list');
  if (!list) return;

  if (state.loading) {
    list.innerHTML = '<div class="feed-loading">Loading news…</div>';
    return;
  }

  // Featured projects always pinned at the top
  const featuredHTML = FEATURED_PROJECTS.map(p => featuredCardHTML(p)).join('');

  if (state.items.length === 0 && FEATURED_PROJECTS.length === 0) {
    list.innerHTML = `<div class="feed-empty">No news right now.</div>`;
    return;
  }

  // News-only — backend now returns news exclusively, but guard with a type
  // check anyway in case a stale cache slips through during deploy.
  const itemsHTML = state.items
    .filter(item => item.type !== 'tweet')
    .map(item => newsCardHTML(item))
    .join('');

  list.innerHTML = featuredHTML + itemsHTML;

  // Stagger the fadeUp animation
  list.querySelectorAll('.post-card').forEach((el, i) => {
    el.style.animationDelay = `${Math.min(i, 20) * 30}ms`;
  });
}

// ─── Data fetch ─────────────────────────────────────────────────────────────

async function loadFeed() {
  state.loading = true;
  render();
  try {
    const r = await fetch('/api/feed', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    state.items = data.items || data.news || [];
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
