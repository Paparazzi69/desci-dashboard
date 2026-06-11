// /heat — 7-day leaderboard. One fetch of /api/prices, rank by d7, render
// the top 10 into the screenshot card. No auto-refresh: the page is meant
// to be loaded, screenshotted, shared.
//
// Below the card, an editorial "Why they moved" block explains notable moves
// from data/heat-notes.json — curated one-liners keyed by token id, rendered
// only while their token sits in the displayed top-10. The card stays a clean
// screenshot; the commentary is the curation layer a generic tracker can't copy.

import { fmt, fmtPct, escapeHtml } from './format.js';

async function boot() {
  // Notes are static and optional — a fetch failure must not block the board.
  const notesP = fetch('/data/heat-notes.json')
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j && j.notes) || {})
    .catch(() => ({}));
  try {
    const r = await fetch('/api/prices', { cache: 'no-store' });
    if (!r.ok) throw new Error('prices ' + r.status);
    const json = await r.json();
    render(Array.isArray(json.tokens) ? json.tokens : [], await notesP);
  } catch (e) {
    console.warn('Heat fetch failed:', e);
    document.getElementById('heat-list').innerHTML =
      '<li class="heat-empty">Price feed unreachable. Refresh in a minute.</li>';
  }
}

function render(tokens, notes) {
  const ranked = tokens
    .filter(t => typeof t.d7 === 'number')
    .sort((a, b) => b.d7 - a.d7);
  if (ranked.length === 0) {
    document.getElementById('heat-list').innerHTML =
      '<li class="heat-empty">No 7-day data in the feed right now.</li>';
    return;
  }

  const end = new Date();
  const start = new Date(Date.now() - 7 * 864e5);
  const f = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('heat-range').textContent =
    `${f(start)} - ${f(end)}, ${end.getFullYear()}`;
  document.getElementById('heat-asof').textContent =
    end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  const totalMcap = ranked.reduce((s, t) => s + (t.mcap || 0), 0);
  const wSum = ranked.reduce((s, t) => s + (t.mcap || 0) * (t.d7 || 0), 0);
  const sector = totalMcap ? wSum / totalMcap : 0;
  const positives = ranked.filter(t => (t.d7 || 0) >= 0).length;
  document.getElementById('heat-sector').innerHTML =
    `Sector, mcap-weighted: <span class="change-text" data-pos="${sector >= 0}">${fmtPct(sector)}</span> 7d`
    + ` · ${positives} of ${ranked.length} tracked tokens positive`;

  const shown = ranked.slice(0, 10);
  document.getElementById('heat-list').innerHTML = shown.map(rowHTML).join('');
  renderWhy(shown, notes || {});
}

// Editorial "why it moved" block under the card — only for displayed tokens
// that have a curated note. Empty → the section stays hidden (no layout shift
// of the screenshot card above it).
function renderWhy(shown, notes) {
  const el = document.getElementById('heat-why');
  if (!el) return;
  const items = shown
    .filter(t => notes[t.id] && notes[t.id].note)
    .map(t => {
      const n = notes[t.id];
      const sym = (t.symbol || '').toUpperCase();
      const pos = (t.d7 ?? 0) >= 0;
      const src = n.source
        ? `<a class="heat-why-src" href="${escapeHtml(n.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.sourceLabel || 'Source')} ↗</a>`
        : '';
      const date = n.date ? `<span class="heat-why-date mono">${escapeHtml(n.date)}</span>` : '';
      return `
        <li class="heat-why-item">
          <div class="heat-why-head">
            <b>${escapeHtml(sym)}</b>
            <span class="change-pill" data-pos="${pos}">${fmtPct(t.d7)}</span>
            ${date}
          </div>
          <p class="heat-why-text">${escapeHtml(n.note)} ${src}</p>
        </li>
      `;
    });
  if (items.length === 0) { el.hidden = true; return; }
  el.innerHTML =
    `<div class="heat-why-title mono">// WHY THEY MOVED</div>`
    + `<ul class="heat-why-list">${items.join('')}</ul>`;
  el.hidden = false;
}

function rowHTML(t, i) {
  const sym = (t.symbol || '').toUpperCase();
  const pos = (t.d7 ?? 0) >= 0;
  const logo = t.image
    ? `<img class="heat-logo" src="${escapeHtml(t.image)}" alt="" loading="lazy">`
    : `<span class="heat-logo heat-logo-fb">${escapeHtml(sym.slice(0, 2))}</span>`;
  return `
    <li class="heat-row">
      <span class="heat-rank mono">${String(i + 1).padStart(2, '0')}</span>
      ${logo}
      <span class="heat-id">
        <b>${escapeHtml(sym)}</b>
        <span class="heat-name">${escapeHtml(t.name || t.id)}</span>
      </span>
      <span class="change-pill" data-pos="${pos}">${fmtPct(t.d7)}</span>
      <span class="heat-mcap mono">${fmt(t.mcap)}</span>
    </li>
  `;
}

boot();
