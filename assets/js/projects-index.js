// /projects landing — motion triggers + live ticker fetch.
//
// Motion assignments (paired with projects-index.css):
//   M/01 ticker scroll        · CSS keyframe (animation-play-state honors reduce)
//   M/02 hero italic mask     · CSS keyframe on load
//   M/03 stat count-up        · this file (requestAnimationFrame)
//   M/04 card stagger fade-up · this file (IntersectionObserver + delay)
//   M/05 card hover lift      · CSS :hover
//   M/06 CTA arrow slide      · CSS :hover
//   M/07 queue row hover      · CSS :hover
//   M/08 LIVE + timestamp     · CSS keyframes
//   M/09 card click wipe      · this file (class swap + setTimeout)
//
// Reduced-motion behavior is documented per-treatment alongside each handler.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Meta strip + footer relative time ───────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }

function fmtMetaTime(d) {
  return `updated ${d.getUTCFullYear()}.${pad2(d.getUTCMonth() + 1)}.${pad2(d.getUTCDate())} · ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

function fmtRelative(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 30) return 'just now';
  if (s < 90) return '1 min ago';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

let bootTime = Date.now();

function paintMetaTime() {
  const el = document.getElementById('meta-time');
  if (el) el.textContent = fmtMetaTime(new Date());
}

function paintFooterRelative() {
  const el = document.getElementById('footer-relative');
  if (!el) return;
  el.textContent = fmtRelative(Date.now() - bootTime);
}

// ─── M/03 · stat count-up ────────────────────────────────────────────────
// Reduced-motion: each numeral snaps to final padded value, no animation.
function countUp(el) {
  const target = Number(el.dataset.countTarget);
  const pad = Number(el.dataset.countPad || 0);
  const finalText = pad ? String(target).padStart(pad, '0') : String(target);

  if (reduced || !Number.isFinite(target)) {
    el.textContent = finalText;
    return;
  }

  const duration = 1200;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3); // ease-out cubic

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const v = Math.floor(ease(t) * target);
    el.textContent = pad ? String(v).padStart(pad, '0') : String(v);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = finalText;
  }
  requestAnimationFrame(step);
}

function fireCounters() {
  document.querySelectorAll('[data-count-target]').forEach(countUp);
}

// ─── M/04 · card stagger fade-up ─────────────────────────────────────────
// Reduced-motion: cards revealed immediately on load, no transition delay.
function setupCardStagger() {
  const cards = Array.from(document.querySelectorAll('.proj-card'));
  if (!cards.length) return;

  if (reduced || !('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const idx = cards.indexOf(entry.target);
      entry.target.style.transitionDelay = `${Math.max(0, idx) * 100}ms`;
      entry.target.classList.add('is-revealed');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  cards.forEach((c) => io.observe(c));
}

// ─── M/09 · card click wipe + fade ───────────────────────────────────────
// Reduced-motion: navigate immediately, no wipe.
function setupCardClicks() {
  document.querySelectorAll('.proj-card').forEach((card) => {
    const href = card.dataset.href;
    if (!href) return;

    // Pointer cursor already set in CSS; this also enables keyboard activation.
    card.addEventListener('click', (e) => {
      // If the user clicked an actual link inside the card (CTA, secondary
      // link, etc.), let the browser handle it natively. Don't double-fire.
      if (e.target.closest('a')) return;

      if (reduced) {
        location.href = href;
        return;
      }
      if (card.classList.contains('is-exiting')) return;
      card.classList.add('is-exiting');
      setTimeout(() => { location.href = href; }, 180);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (reduced) { location.href = href; return; }
      if (card.classList.contains('is-exiting')) return;
      card.classList.add('is-exiting');
      setTimeout(() => { location.href = href; }, 180);
    });
  });
}

// ─── Ticker fetch + render ───────────────────────────────────────────────
// Universe of 12 tickers requested in the brief. Each maps to one or more
// API ids (CoinGecko id or GeckoTerminal slug as used by /api/prices). The
// 5 unmapped tickers (NEURON, GROW, SKIN, CURES) intentionally show "—":
// they're tracked in the catalog but not yet wired to a live price source.
const TICKER_UNIVERSE = [
  { sym: '$AUBRAI', ids: ['aubrai', 'aubrai-by-bio'] },
  { sym: '$PEPTAI', ids: ['peptai'] },
  { sym: '$SPINE',  ids: ['spinedao'] },
  { sym: '$BIO',    ids: ['bio-protocol'] },
  { sym: '$VITA',   ids: ['vitadao'] },
  { sym: '$RSC',    ids: ['researchcoin'] },
  { sym: '$HAIR',   ids: ['hairdao'] },
  { sym: '$CRYO',   ids: ['cryodao'] },
  { sym: '$NEURON', ids: [] },
  { sym: '$GROW',   ids: [] },
  { sym: '$SKIN',   ids: [] },
  { sym: '$CURES',  ids: [] },
];

function fmtPct(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function rowHTML(byId) {
  return TICKER_UNIVERSE.map((t) => {
    let d1 = null;
    for (const id of t.ids) {
      const tok = byId[id];
      if (tok && Number.isFinite(tok.d1)) { d1 = tok.d1; break; }
    }
    const cls = d1 === null
      ? 'pct-neutral'
      : d1 >= 0 ? 'pct-up' : 'pct-down';
    return `<span class="proj-ticker-item">`
      + `<span class="proj-ticker-sym">${escapeHtml(t.sym)}</span>`
      + `<span class="proj-ticker-pct ${cls}">${escapeHtml(fmtPct(d1))}</span>`
      + `</span>`;
  }).join('');
}

function renderTicker(tokens) {
  const byId = Object.create(null);
  (tokens || []).forEach((t) => {
    if (t && t.id) byId[t.id] = t;
  });
  const html = rowHTML(byId);
  document.querySelectorAll('[data-ticker-row]').forEach((row) => {
    row.innerHTML = html;
  });
}

// Paint a placeholder ("—") row immediately so the layout doesn't shift
// while /api/prices is in flight. The async refresh upgrades values.
function paintTickerPlaceholder() {
  renderTicker([]);
}

let lastFetch = 0;
const MIN_FETCH_INTERVAL = 15_000;

async function refreshTicker(force) {
  const now = Date.now();
  if (!force && now - lastFetch < MIN_FETCH_INTERVAL) return;
  lastFetch = now;
  try {
    const r = await fetch('/api/prices', { headers: { accept: 'application/json' } });
    if (!r.ok) return;
    const j = await r.json();
    if (j && Array.isArray(j.tokens)) renderTicker(j.tokens);
  } catch {
    // Silent — the placeholder row stays, ticker keeps scrolling.
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────
function boot() {
  bootTime = Date.now();
  paintMetaTime();
  paintFooterRelative();
  paintTickerPlaceholder();
  fireCounters();
  setupCardStagger();
  setupCardClicks();

  refreshTicker(true);
  setInterval(refreshTicker, 60_000);
  setInterval(paintFooterRelative, 60_000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      paintFooterRelative();
      refreshTicker(false);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
