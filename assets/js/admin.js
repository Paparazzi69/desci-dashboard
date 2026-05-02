// Admin UI for the news aggregator. Pulls the pending queue from
// /api/admin/pending and lets the operator approve / feature / reject
// each item. Token is bearer-auth, stored in localStorage so a refresh
// doesn't lose it.

const TOKEN_KEY = 'desci-admin-token';

const els = {
  token: document.getElementById('token-input'),
  save: document.getElementById('save-token'),
  refresh: document.getElementById('refresh'),
  status: document.getElementById('status'),
  items: document.getElementById('items'),
};

// ── Token handling ──────────────────────────────────────────────────────
function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
els.token.value = getToken();

els.save.addEventListener('click', () => {
  setToken(els.token.value.trim());
  setStatus('Token saved.');
  loadPending();
});

els.refresh.addEventListener('click', loadPending);

// ── Status line ─────────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}

// ── Loaders ─────────────────────────────────────────────────────────────
async function loadPending() {
  const token = getToken();
  if (!token) { setStatus('No token saved. Paste it above and click Save token.'); return; }

  setStatus('Loading…');
  els.items.innerHTML = '';
  try {
    const r = await fetch('/api/admin/pending', {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (r.status === 401) { setStatus('Unauthorized — token rejected.', true); return; }
    if (!r.ok) { setStatus(`Error: HTTP ${r.status}`, true); return; }
    const data = await r.json();
    renderItems(data.items || []);
    setStatus(`${data.count} pending`);
  } catch (e) {
    setStatus(`Network error: ${e.message || e}`, true);
  }
}

async function mutate(id, action, button) {
  const token = getToken();
  if (!token) { setStatus('No token saved.', true); return; }

  const card = button.closest('.item');
  const takeEl = card.querySelector('textarea');
  const takeRaw = takeEl ? takeEl.value.trim() : '';
  // Reject doesn't carry a take — pending rows have no commentary anyway,
  // and we don't want stray textarea text getting saved on hidden items.
  const take = action === 'reject' ? null : (takeRaw || null);

  // Disable all three buttons on this row while the request is in flight.
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    const r = await fetch(`/api/admin/${action}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id, take }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setStatus(`Error: ${body.error || r.status}`, true);
      card.querySelectorAll('button').forEach(b => b.disabled = false);
      // Re-run the per-card gating so Feature stays disabled if the take
      // is still empty after a failed request.
      const ta = card.querySelector('textarea');
      if (ta) ta.dispatchEvent(new Event('input'));
      return;
    }
    // Success — fade and remove the card. No full reload; remaining items stay put.
    card.classList.add('fading');
    setTimeout(() => {
      card.remove();
      const remaining = els.items.querySelectorAll('.item').length;
      setStatus(`${remaining} pending`);
      if (!remaining) renderItems([]);
    }, 150);
  } catch (e) {
    setStatus(`Network error: ${e.message || e}`, true);
    card.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

// ── Render ──────────────────────────────────────────────────────────────
const TAKE_SOFT_LIMIT = 280;

function renderItems(items) {
  if (!items.length) {
    els.items.innerHTML = '<div class="empty">Nothing pending.</div>';
    return;
  }
  els.items.innerHTML = items.map(itemHTML).join('');
  els.items.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => mutate(btn.dataset.id, btn.dataset.action, btn));
  });
  els.items.querySelectorAll('.item').forEach(wireCard);
}

function wireCard(card) {
  const ta = card.querySelector('textarea');
  if (!ta) return;
  const counter = card.querySelector('.item-take-counter');
  const featureBtn = card.querySelector('button[data-action="feature"]');
  const update = () => {
    const len = ta.value.length;
    counter.textContent = `${len} / ${TAKE_SOFT_LIMIT}`;
    counter.classList.toggle('over', len > TAKE_SOFT_LIMIT);
    // Featured items must carry a take. Approve and Reject don't care.
    featureBtn.disabled = !ta.value.trim();
    featureBtn.title = featureBtn.disabled ? 'Write a take first to feature this item' : '';
  };
  ta.addEventListener('input', update);
  update();
}

function itemHTML(it) {
  const date = new Date(it.publishedAt * 1000).toISOString().slice(0, 16).replace('T', ' ');
  return `
    <article class="item">
      <div class="item-meta">
        <span class="item-source">${esc(it.source)}</span>
        <span class="item-source-type">${esc(it.sourceType)}</span>
        <span class="item-category">${esc(it.category)}</span>
        <span>${esc(date)} UTC</span>
        ${it.author ? `<span>by ${esc(it.author)}</span>` : ''}
      </div>
      <h2 class="item-title">
        <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a>
      </h2>
      <div class="item-summary">${esc(it.summary)}</div>
      <div class="item-take">
        <textarea rows="3" placeholder="Your take (optional, required for Feature)"></textarea>
        <div class="item-take-meta">
          <span>Editorial commentary — appears below the headline on /feed</span>
          <span class="item-take-counter">0 / ${TAKE_SOFT_LIMIT}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-approve" data-action="approve" data-id="${esc(it.id)}">Approve</button>
        <button class="btn btn-feature" data-action="feature" data-id="${esc(it.id)}">Feature</button>
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(it.id)}">Reject</button>
      </div>
    </article>
  `;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Auto-load on page open if we already have a token.
if (getToken()) loadPending();
