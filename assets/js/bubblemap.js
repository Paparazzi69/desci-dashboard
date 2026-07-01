// bubblemap.js — SVG bubble map for the DeSci token sector.
// v3: circle packing around the centroid; radius encodes mcap (area ∝ mcap
// via sqrt), fill/ring color = 24h move. Deterministic layout per data set,
// no physics, no decorative background.
//
// Usage: mount(container, tokens, onTokenClick, tokenImages)
//   tokenImages = { [tokenId]: '/path/to/image.jpg' }
//   Each bubble is a real <a href="?token=<id>"> (tabbable, middle-clickable);
//   normal clicks are intercepted and open the drawer via onTokenClick.

const GREEN = '#24DC82';
const RED   = '#F14F52';
const MUTED = '#788B8B';

const PAD   = 6;    // px between packed circles
const R_MIN = 26;

function moveColor(chg) {
  return chg > 0.1 ? GREEN : chg < -0.1 ? RED : MUTED;
}

// ─── Packing: tangent candidates, pick the one closest to the origin ─────────
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function tangents(A, B, rn) {
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
  const r1 = A.r + rn, r2 = B.r + rn;
  if (!d || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2), mx = A.x + a * dx / d, my = A.y + a * dy / d;
  return [{ x: mx + h * dy / d, y: my - h * dx / d },
          { x: mx - h * dy / d, y: my + h * dx / d }];
}

// nodes: sorted descending by r. Mutates x/y. O(n^3) worst case, fine for n<=60.
function packSiblings(nodes) {
  const placed = [];
  for (const n of nodes) {
    if (placed.length === 0) { n.x = 0; n.y = 0; }
    else if (placed.length === 1) { n.x = placed[0].r + n.r + PAD; n.y = 0; }
    else {
      let best = null;
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++)
          for (const c of tangents(placed[i], placed[j], n.r + PAD))
            if (placed.every(q => dist(c, q) >= q.r + n.r + PAD - 0.5)) {
              const d0 = Math.hypot(c.x, c.y);
              if (!best || d0 < best.d0) best = { ...c, d0 };
            }
      if (!best) { // spiral fallback, terminates because radius grows
        for (let a = 0; ; a += 0.35) {
          const R = placed[0].r + n.r + PAD + a * 4;
          const c = { x: Math.cos(a) * R, y: Math.sin(a) * R };
          if (placed.every(q => dist(c, q) >= q.r + n.r + PAD)) { best = c; break; }
        }
      }
      n.x = best.x; n.y = best.y;
    }
    placed.push(n);
  }
  return placed;
}

// ─── Formatters / escaping ────────────────────────────────────────────────────
function fmtM(n) {
  if (!n) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}
function fmtP(p) {
  if (!p) return '—';
  if (p >= 100)    return '$' + p.toFixed(2);
  if (p >= 1)      return '$' + p.toFixed(3);
  if (p >= 0.01)   return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toFixed(8);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function slug(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '-'); }

// ─── Bubble markup ────────────────────────────────────────────────────────────
function bubbleSVG(n, tokenImages) {
  const chg  = n.d1 || 0;
  const col  = moveColor(chg);
  const fillA = (0.10 + 0.20 * Math.min(Math.abs(chg) / 15, 1)).toFixed(2);
  const showPct = n.r >= 48;
  const logoR = n.r * 0.275;
  const logoY = showPct ? -n.r * 0.18 : 0;
  const pct = `${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`;
  const id = slug(n.id || n.symbol || '');
  const logo = tokenImages[n.id];
  const emphasis = Math.abs(chg) > 5
    ? ` style="filter:drop-shadow(0 0 6px ${col})"` : '';

  const inner = logo
    ? `<circle r="${(n.r * 0.36).toFixed(1)}" cy="${logoY.toFixed(1)}"
             fill="var(--surface, #111820)" fill-opacity="0.55"/>
      <clipPath id="bmclip-${id}"><circle r="${logoR.toFixed(1)}" cy="${logoY.toFixed(1)}"/></clipPath>
      <image href="${esc(logo)}" x="${(-logoR).toFixed(1)}" y="${(logoY - logoR).toFixed(1)}"
             width="${(logoR * 2).toFixed(1)}" height="${(logoR * 2).toFixed(1)}"
             clip-path="url(#bmclip-${id})" opacity="0.9"/>`
    : `<text y="${logoY.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
             font-family="'Space Grotesk', sans-serif" font-weight="700"
             font-size="${Math.max(10, n.r * 0.32).toFixed(1)}" fill="${col}"
             >${esc((n.symbol || n.id || '').toUpperCase())}</text>`;

  return `
  <a href="?token=${encodeURIComponent(n.id)}" class="bub" data-id="${esc(n.id)}"
     aria-label="${esc(n.name || n.id)}: ${pct} 24h">
    <g transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})"${emphasis}>
      <circle class="bub-ring" r="${n.r.toFixed(1)}" fill="${col}" fill-opacity="${fillA}"
              stroke="${col}" stroke-width="3" stroke-opacity="0.95"
              ${n.mcap > 0 ? '' : 'stroke-dasharray="6 6"'}/>
      ${inner}
      ${showPct ? `<text y="${(n.r * 0.58).toFixed(1)}" text-anchor="middle"
             font-family="'JetBrains Mono', ui-monospace, monospace" font-weight="700"
             font-size="${(n.r * 0.32).toFixed(1)}" fill="${col}">${pct}</text>` : ''}
    </g>
  </a>`;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function mount(container, tokens, onTokenClick, tokenImages = {}) {
  if (!tokens || tokens.length === 0) return () => {};

  container.innerHTML = '';
  container.style.position = 'relative';

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position:absolute;pointer-events:none;opacity:0;transition:opacity 0.15s ease;
    background:rgba(10,20,28,0.95);border:1px solid rgba(61,232,160,0.25);
    border-radius:8px;padding:9px 13px;font-family:'Space Grotesk',sans-serif;
    font-size:12px;line-height:1.55;min-width:130px;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:10;
  `;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;';
  container.appendChild(wrap);
  container.appendChild(tooltip);

  let lastW = 0, lastH = 0;

  function render() {
    const rect = container.getBoundingClientRect();
    const W = rect.width  || 700;
    const H = rect.height || 360;
    lastW = W; lastH = H;

    const R_MAX = window.innerWidth < 640 ? 80 : Math.min(120, H * 0.22);

    // Radii: area ∝ mcap. Missing/zero mcap → R_MIN, excluded from mcapMax.
    const capped = tokens.filter(t => t.mcap > 0);
    const mcapMax = Math.max(1, ...capped.map(t => t.mcap));
    const nodes = tokens
      .map(t => ({ ...t, r: t.mcap > 0 ? R_MIN + (R_MAX - R_MIN) * Math.sqrt(t.mcap / mcapMax) : R_MIN }))
      .sort((a, b) => b.r - a.r);

    const placed = packSiblings(nodes);

    const minX = Math.min(...placed.map(p => p.x - p.r)) - 24;
    const maxX = Math.max(...placed.map(p => p.x + p.r)) + 24;
    const minY = Math.min(...placed.map(p => p.y - p.r)) - 24;
    const maxY = Math.max(...placed.map(p => p.y + p.r)) + 24;

    wrap.innerHTML = `
    <style>
      .bub { cursor: pointer; outline: none; }
      .bub .bub-ring { transition: stroke-opacity 0.15s ease; }
      .bub:hover .bub-ring, .bub:focus-visible .bub-ring { stroke-opacity: 1; }
    </style>
    <svg viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}"
         width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
         role="img" aria-label="Sector bubble map: size is market cap, color is the 24h move">
      ${placed.map(n => bubbleSVG(n, tokenImages)).join('')}
    </svg>`;

    const svg = wrap.querySelector('svg');
    svg.addEventListener('click', onClick);
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseleave', onMouseLeave);
  }

  const byId = new Map(tokens.map(t => [t.id, t]));

  function onClick(e) {
    const a = e.target.closest('a.bub');
    if (!a) return;
    // Let modified clicks (new tab etc.) follow the real ?token= link
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (onTokenClick) onTokenClick(a.getAttribute('data-id'));
  }

  function onMouseMove(e) {
    const a = e.target.closest('a.bub');
    if (!a) { tooltip.style.opacity = '0'; return; }
    const b = byId.get(a.getAttribute('data-id'));
    if (!b) { tooltip.style.opacity = '0'; return; }
    const pos = (b.d1 || 0) >= 0;
    tooltip.innerHTML = `
      <div style="font-weight:700;font-size:14px;color:#e0f0ea;margin-bottom:4px">${esc(b.symbol || b.id || '')}</div>
      <div style="color:#6aaa99;font-size:11px;margin-bottom:6px">${esc(b.name || b.id || '')}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#e0f0ea">${fmtP(b.price)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${pos ? '#3de8a0' : '#e05040'};margin-top:2px">${(b.d1 >= 0 ? '+' : '') + ((b.d1 || 0).toFixed(2))}% 24h</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#4a7a6a;margin-top:3px">Mcap ${fmtM(b.mcap)}</div>
    `;
    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    let tx = cx + 14, ty = cy - 10;
    const tw = 150, th = 95;
    if (tx + tw > rect.width) tx = cx - tw - 14;
    if (ty + th > rect.height) ty = rect.height - th - 8;
    tooltip.style.left    = tx + 'px';
    tooltip.style.top     = ty + 'px';
    tooltip.style.opacity = '1';
  }

  function onMouseLeave() {
    tooltip.style.opacity = '0';
  }

  const ro = new ResizeObserver(() => {
    const rect = container.getBoundingClientRect();
    if (Math.abs(rect.width - lastW) > 1 || Math.abs(rect.height - lastH) > 1) render();
  });
  ro.observe(container);

  render();

  return () => {
    ro.disconnect();
  };
}
