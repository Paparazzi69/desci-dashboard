// /research — Research Pulse. Fetches /api/research-pulse and renders a live
// window into the OpenLabs commons over the static snapshot shipped in the HTML.
// /api/research-pulse 404s in local dev (Cloudflare Functions are prod-only), so
// the snapshot stays visible there. No storage. Author data is never requested.

const OL = 'https://openlabs.bio.xyz';
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n);
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderMetrics(t) {
  const set = (k, v) => document.querySelectorAll('[data-pulse="' + k + '"]').forEach((el) => {
    if (v != null) el.textContent = fmt(v);
  });
  set('claims', t.claims); set('discussions', t.discussions);
  set('contributors', t.contributors); set('topics', t.topics);
}

function renderTrending(list) {
  const el = document.getElementById('pulse-trending');
  if (!el || !Array.isArray(list) || !list.length) return;
  el.innerHTML = list.map((h, i) => {
    const meta = [];
    if (h.topic) meta.push('<span class="topic">' + esc(h.topic) + '</span>');
    if (h.project) meta.push('<span class="proj">// ' + esc(h.project) + '</span>');
    const title = h.id
      ? '<a href="' + OL + '/post/' + esc(h.id) + '" target="_blank" rel="noopener">' + esc(h.title) + ' <span class="ext" aria-hidden="true">↗</span></a>'
      : esc(h.title);
    return '<li class="pulse-row">'
      + '<span class="pulse-rank">' + String(i + 1).padStart(2, '0') + '</span>'
      + '<div class="pulse-row-body"><div class="pulse-row-title">' + title + '</div>'
      + (meta.length ? '<div class="pulse-row-meta">' + meta.join('<span>·</span>') + '</div>' : '')
      + '</div>'
      + '<div class="pulse-row-stats"><b>' + fmt(h.upvotes || 0) + '</b> up &nbsp; <b>' + fmt(h.comments || 0) + '</b> cm</div>'
      + '</li>';
  }).join('');
}

function renderProjects(list) {
  const el = document.getElementById('pulse-projects');
  if (!el || !Array.isArray(list) || !list.length) return;
  el.innerHTML = list.map((p) => {
    const title = p.id
      ? '<a href="' + OL + '/projects/' + esc(p.id) + '" target="_blank" rel="noopener">' + esc(p.title) + ' <span class="ext" aria-hidden="true">↗</span></a>'
      : esc(p.title);
    return '<div class="pulse-proj"><div class="pulse-proj-title">' + title + '</div>'
      + '<div class="pulse-proj-sum">' + esc(p.summary) + '</div></div>';
  }).join('');
}

function renderCoves(topics) {
  const el = document.getElementById('pulse-coves');
  if (!el || !Array.isArray(topics) || !topics.length) return;
  el.innerHTML = topics.map((t) =>
    '<a class="pulse-cove" href="' + OL + '/topics/' + esc(t.slug) + '" target="_blank" rel="noopener">'
    + esc(t.emoji) + ' ' + esc(t.name) + ' <span class="n">' + fmt(t.posts || 0) + '</span></a>'
  ).join('');
}

fetch('/api/research-pulse', { headers: { accept: 'application/json' } })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    if (!d || !d.totals) return;
    renderMetrics(d.totals);
    renderTrending(d.trending);
    renderProjects(d.projects);
    renderCoves(d.topics);
    const src = document.getElementById('pulse-source');
    if (src) {
      const date = (d.fetchedAt || '').slice(0, 10);
      src.innerHTML = (d.stale ? 'Cached' : 'Live')
        + ' from <a href="https://openlabs.bio.xyz" target="_blank" rel="noopener">OpenLabs</a>'
        + (date ? ' · ' + date : '');
      if (d.stale) src.dataset.state = 'stale';
    }
  })
  .catch(() => { /* dev / outage: keep the snapshot */ });
