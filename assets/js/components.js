// String-template component helpers. Each function returns an HTML string;
// the caller is responsible for inserting it into the DOM. Event handlers
// are bound centrally in app.js via delegation — keeps this file pure markup.

import { fmt, fmtPrice, fmtPct, fmtNum, escapeHtml } from './format.js';
import { sparklineSVG, largeChartSVG } from './sparkline.js';
import { metaFor, FILTER_CHIPS } from './data.js';

export function badge(label, color, small) {
  return `<span class="badge" data-color="${color}"${small ? ' data-small="true"' : ''}>${escapeHtml(label)}</span>`;
}

export function chainBadge(chain) {
  return `<span class="chain-badge">${escapeHtml(chain || '—')}</span>`;
}

export function sectorCardHTML(label, value, sub, accentVar) {
  return `
    <div class="sector-card">
      <div class="sector-card-accent" style="background:${accentVar}"></div>
      <div class="sector-card-label">${escapeHtml(label)}</div>
      <div class="sector-card-value mono">${value}</div>
      ${sub ? `<div class="sector-card-sub">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}

export function sectorCardSkeleton(label) {
  // Mirror the structure of sectorCardHTML exactly so the card height is the
  // same before and after data arrives. Previously the skeleton was missing
  // .sector-card-sub entirely, which made each card ~17px shorter on first
  // paint; multiplied across 5 cards that was ~85px of shift cascading into
  // every section below (bubble map, Token Index, BioAgent teaser) once
  // /api/prices returned. Lighthouse caught it as 0.44 CLS on the homepage.
  return `
    <div class="sector-card">
      <div class="sector-card-accent" style="background:var(--text3)"></div>
      <div class="sector-card-label">${escapeHtml(label)}</div>
      <div class="sector-card-value mono sector-card-skeleton">———</div>
      <div class="sector-card-sub">&nbsp;</div>
    </div>
  `;
}

export function filterChipsHTML(active, counts, totalCount) {
  const chips = FILTER_CHIPS.map(name => {
    const isActive = name === active;
    return `
      <button class="filter-chip" role="tab" aria-selected="${isActive}" data-filter="${escapeHtml(name)}">
        ${escapeHtml(name)}
        <span class="filter-chip-count mono">${counts[name] ?? 0}</span>
      </button>
    `;
  }).join('');
  const readout = active !== 'All'
    ? `<span class="filter-chips-readout">Showing ${counts[active] ?? 0} of ${totalCount} tokens</span>`
    : '';
  return `
    <span class="filter-chips-label">Filter</span>
    ${chips}
    ${readout}
  `;
}

export function tokenHeaderHTML(sortKey, sortDir) {
  const cols = [
    { key: null,   label: '#',       align: 'center' },
    { key: null,   label: 'Token',   align: 'left' },
    { key: 'price',label: 'Price',   align: 'right' },
    { key: 'd1',   label: '24h %',   align: 'right' },
    { key: 'd7',   label: '7d %',    align: 'right' },
    { key: 'mcap', label: 'Mkt Cap', align: 'right' },
    { key: 'vol',  label: '24h Vol', align: 'right' },
    { key: null,   label: '7d',      align: 'center' },
  ];
  return cols.map(c => {
    const sortable = !!c.key;
    const active = sortable && sortKey === c.key;
    return `
      <div class="token-th"
           role="columnheader"
           data-align="${c.align}"
           ${sortable ? `data-sortable="true" data-sortkey="${c.key}"` : ''}
           ${active ? 'data-active="true"' : ''}>
        ${escapeHtml(c.label)}
        ${sortable ? `<span class="sort-icon" data-active="${active}" data-dir="${sortDir}">
          <span class="sort-icon-up"></span>
          <span class="sort-icon-down"></span>
        </span>` : ''}
      </div>
    `;
  }).join('');
}

function logoCell(token) {
  if (token.image) {
    return `<div class="token-logo"><img src="${escapeHtml(token.image)}" alt="" loading="lazy"></div>`;
  }
  return `<div class="token-logo"><span class="token-logo-fallback">${escapeHtml((token.symbol || '?').slice(0, 2))}</span></div>`;
}

export function tokenRowHTML(token, idx) {
  const meta = metaFor(token.id);
  const pos24h = (token.d1 ?? 0) >= 0;
  const pos7d = (token.d7 ?? 0) >= 0;
  const isMicro = !!(meta.isMicroCap || token.isMicroCap);
  return `
    <div class="token-row" role="row" tabindex="0" data-id="${escapeHtml(token.id)}">
      <div class="token-cell-num mono" data-col="num">${idx + 1}</div>
      <div class="token-cell-name" data-col="name">
        <div class="token-name-row">
          ${logoCell(token)}
          <div class="token-name-text">
            <div class="token-symbol">
              ${escapeHtml((token.symbol || '').toUpperCase())}
              ${isMicro ? badge('μ', 'purple', true) : ''}
            </div>
            <div class="token-fullname">${escapeHtml(token.name || token.id)}</div>
          </div>
        </div>
        <div class="token-tags">
          ${badge(meta.focus, meta.focusColor, true)}
          ${chainBadge(meta.chain)}
        </div>
      </div>
      <div class="token-cell-num-data mono" data-col="price"${isMicro ? ' data-muted="true"' : ''}>${fmtPrice(token.price)}</div>
      <div class="token-cell-num-data mono" data-col="d1">
        <span class="change-pill" data-pos="${pos24h}">${fmtPct(token.d1)}</span>
      </div>
      <div class="token-cell-num-data mono" data-col="d7">
        <span class="change-text" data-pos="${pos7d}">${fmtPct(token.d7)}</span>
      </div>
      <div class="token-cell-num-data mono" data-col="mcap">${fmt(token.mcap)}</div>
      <div class="token-cell-num-data mono" data-col="vol" data-muted="true">${fmt(token.vol)}</div>
      <div class="token-cell-spark" data-col="spark">${sparklineSVG(token.spark || [], { positive: pos7d, w: 72, h: 26 })}</div>
    </div>
  `;
}

export function bannerHTML(kind, text) {
  return `<div class="banner banner-${kind}"><span class="banner-icon">${kind === 'red' ? '✕' : '⚠'}</span><span>${escapeHtml(text)}</span></div>`;
}

export function drawerHTML(token, detail) {
  // detail = data fetched from /api/coin/:id (may be null while loading or on error)
  const meta = metaFor(token.id);
  const pos24h = (token.d1 ?? 0) >= 0;
  const pos7d = (token.d7 ?? 0) >= 0;
  const isMicro = !!(meta.isMicroCap || token.isMicroCap);
  const longSpark = (detail && detail.sparkline_7d) || token.spark || [];

  const fdv = detail?.fdv ?? null;
  const ath = detail?.ath ?? null;
  const atl = detail?.atl ?? null;
  const description = detail?.description || null;

  const stats = [
    ['Market Cap', fmt(token.mcap)],
    ['24h Volume', fmt(token.vol)],
    ['FDV', fmt(fdv)],
    ['Holders', '—'], // CoinGecko doesn't expose holder counts
    ['ATH', fmtPrice(ath)],
    ['ATL', fmtPrice(atl)],
    ['7d Change', fmtPct(token.d7)],
    ['Vol/Mcap', token.mcap ? ((token.vol / token.mcap) * 100).toFixed(1) + '%' : '—'],
  ];

  const tagBadges = (meta.tags || [])
    .filter(t => t !== meta.focus && t !== 'Micro-caps')
    .map(t => badge(t, 'teal', true)).join('');

  const links = [];
  if (meta.twitter) links.push({ label: 'Twitter', href: `https://twitter.com/${meta.twitter}` });
  if (meta.website) links.push({ label: 'Website', href: `https://${meta.website}` });
  // Trade link (e.g. EasyA Kickstart) replaces the CoinGecko link when present.
  // Otherwise show CoinGecko for tokens with a real listing.
  if (meta.trade) {
    links.push({ label: 'Trade ↗', href: meta.trade });
  } else if (!token.isMicroCap) {
    links.push({ label: 'CoinGecko', href: `https://coingecko.com/en/coins/${token.id}` });
  }
  if (detail?.contract) links.push({ label: 'Contract ↗', href: detail.contractUrl || '#' });

  // Micro-caps without a token-specific trade URL fall back to pump.science.
  const microFallback = isMicro && !meta.trade
    ? `<a class="drawer-link drawer-link-pump" href="https://pump.science" target="_blank" rel="noopener noreferrer">pump.science ↗</a>`
    : '';
  const linksHTML = links.map(l =>
    `<a class="drawer-link" href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`
  ).join('') + microFallback;

  const descBlock = description
    ? `<div class="drawer-desc">${description.split(/\n\n+/).slice(0, 4).map(p => `<p>${sanitizeDesc(p)}</p>`).join('')}</div>`
    : (detail === null
        ? `<div class="drawer-desc"><p style="opacity:0.5">Loading description…</p></div>`
        : `<div class="drawer-desc"><p style="opacity:0.5">No description available from CoinGecko.</p></div>`);

  const logoMarkup = token.image
    ? `<img src="${escapeHtml(token.image)}" alt="">`
    : `<span class="drawer-logo-fallback">${escapeHtml((token.symbol || '??').slice(0, 2).toUpperCase())}</span>`;

  return `
    <div class="drawer-backdrop" data-drawer-close="true"></div>
    <div class="drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(token.name || token.id)} details">
      <div class="drawer-header">
        <div class="drawer-header-row">
          <div class="drawer-id">
            <div class="drawer-logo">${logoMarkup}</div>
            <div>
              <div class="drawer-symbol">${escapeHtml((token.symbol || '').toUpperCase())}</div>
              <div class="drawer-name">${escapeHtml(token.name || token.id)}</div>
            </div>
          </div>
          <button class="drawer-close" aria-label="Close" data-drawer-close="true">×</button>
        </div>
        <div class="drawer-badges">
          ${badge(meta.focus, meta.focusColor)}
          ${chainBadge(meta.chain)}
          ${isMicro ? badge('Micro-cap', 'purple', true) : ''}
          ${tagBadges}
        </div>
      </div>

      <div class="drawer-section drawer-section-first">
        <div class="drawer-price-row">
          <span class="drawer-price">${fmtPrice(token.price)}</span>
          <span class="drawer-price-delta change-text" data-pos="${pos24h}">${fmtPct(token.d1)} 24h</span>
        </div>
        <div class="drawer-price-sub">${longSpark.length >= 100 ? '7-day price' : '7-day price'} · ${pos7d ? 'up' : 'down'} ${fmtPct(token.d7)} this week</div>
        <div class="drawer-chart-wrap">${largeChartSVG(longSpark, { positive: pos7d, h: 110 })}</div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-label">Links</div>
        <div class="drawer-links">${linksHTML}</div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-label">Key Stats</div>
        <div class="stats-grid">
          ${stats.map(([l, v]) => `
            <div class="stat-cell">
              <div class="stat-cell-label">${escapeHtml(l)}</div>
              <div class="stat-cell-value">${v}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="drawer-section" style="padding-bottom:28px">
        <div class="drawer-section-label">About</div>
        ${descBlock}
      </div>
    </div>
  `;
}

// CoinGecko descriptions can contain HTML <a> tags for links — we let those
// through but strip everything else to defang any injection attempt.
function sanitizeDesc(s) {
  if (!s) return '';
  return String(s)
    // Strip all tags except <a> with href
    .replace(/<(?!\/?a(?=>|\s.*>))\/?[^>]+>/gi, '')
    // Whitelist href attribute, kill everything else on the <a>
    .replace(/<a\b([^>]*)>/gi, (_, attrs) => {
      const m = /href\s*=\s*"([^"]+)"/i.exec(attrs) || /href\s*=\s*'([^']+)'/i.exec(attrs);
      const href = m ? m[1] : '#';
      if (!/^https?:\/\//i.test(href)) return '';
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
    });
}

// ─── 24h movers strip ─────────────────────────────────────────────────────────
function moverChipHTML(token, side) {
  const pos = (token.d1 ?? 0) >= 0;
  const sym = (token.symbol || '').toUpperCase();
  const logo = token.image
    ? `<span class="mover-logo"><img src="${escapeHtml(token.image)}" alt="" loading="lazy"></span>`
    : `<span class="mover-logo mover-logo-fallback">${escapeHtml(sym.slice(0, 2))}</span>`;
  return `
    <button type="button" class="mover-chip" data-id="${escapeHtml(token.id)}" data-side="${side}"
            aria-label="${escapeHtml(sym)} ${fmtPct(token.d1)} in 24 hours, open details">
      <span class="mover-chip-id">
        ${logo}
        <span class="mover-symbol">${escapeHtml(sym)}</span>
      </span>
      <span class="change-pill" data-pos="${pos}">${fmtPct(token.d1)}</span>
    </button>
  `;
}

export function moversHTML(gainers, losers) {
  return gainers.map(t => moverChipHTML(t, 'up'))
    .concat(losers.map(t => moverChipHTML(t, 'down')))
    .join('');
}

export function moversSkeletonHTML() {
  // Mirrors moverChipHTML structure exactly (same chip height, same child
  // elements) so the strip height is identical before and after data lands.
  return Array.from({ length: 6 }, () => `
    <button type="button" class="mover-chip" disabled>
      <span class="mover-chip-id">
        <span class="mover-logo mover-logo-fallback">··</span>
        <span class="mover-symbol">———</span>
      </span>
      <span class="change-pill">——</span>
    </button>
  `).join('');
}

// ─── Catalyst calendar ────────────────────────────────────────────────────────
// Forward-looking, sourced events. Each node links to its primary source;
// the tooltip carries the source label so the provenance is visible on hover.
export function catalystsHTML(items) {
  return `
    <div class="milestones-header">
      <span class="milestones-title">Catalyst Calendar</span>
      <span class="milestones-line"></span>
      <span class="milestones-count">${items.length} upcoming · every entry sourced</span>
    </div>
    <div class="milestones-scroll">
      <div class="milestones-track" style="min-width:${Math.max(items.length * 140, 700)}px">
        <div class="milestones-track-line"></div>
        <div class="milestones-nodes">
          ${items.map(m => `
            <a class="milestone-node" href="${escapeHtml(m.source)}" target="_blank" rel="noopener noreferrer"
               aria-label="${escapeHtml(m.title)}, open source">
              <div class="milestone-date">${escapeHtml(m.date)}</div>
              <div class="milestone-dot" data-color="${escapeHtml(m.typeColor)}"></div>
              <div class="milestone-meta">
                <span class="milestone-token" data-color="${escapeHtml(m.typeColor)}">${escapeHtml(m.token)}</span>
                <span class="milestone-type" data-color="${escapeHtml(m.typeColor)}">${escapeHtml(m.type)}</span>
                <div class="milestone-title-text">${escapeHtml(m.title)}</div>
              </div>
              <div class="milestone-tooltip">
                <div class="milestone-tooltip-meta" style="color:var(--${escapeHtml(m.typeColor)})">${escapeHtml(m.type)} · ${escapeHtml(m.date)}</div>
                <div class="milestone-tooltip-title">${escapeHtml(m.title)}</div>
                <p class="milestone-tooltip-desc">${escapeHtml(m.desc)}</p>
                <div class="milestone-tooltip-src">${escapeHtml(m.sourceLabel)} ↗</div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

