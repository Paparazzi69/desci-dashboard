// bubblemap.js — Canvas bubble map for the DeSci token sector.
// v2: linear horizontal layout (sorted by mcap) + gel-electrophoresis background.
//
// Background = "Lab-coded" preset:
//   1) vertical lane migration (bands drift top→bottom)
//   3) lane structure (8 faint vertical guides)
//   5) sample wells (dark slots along the top edge)
//
// Usage: mount(container, tokens, onTokenClick, tokenImages)
//   tokenImages = { [tokenId]: '/path/to/image.jpg' }
//   Each bubble = one token. Size ∝ log(mcap). Color = 24h direction.
//   Custom images render clipped to circle; fallback = text label.

const GREEN_FILL   = 'rgba(29,184,114,0.18)';
const RED_FILL     = 'rgba(180,60,40,0.15)';
const GREEN_STROKE = 'rgba(61,232,160,0.8)';
const RED_STROKE   = 'rgba(210,80,60,0.75)';
const TEXT_COLOR   = 'rgba(220,240,235,0.92)';

const MIN_R = 24;
const MAX_R = 58;
const ROW_PAD_X  = 24;   // left/right gutter inside the canvas
const BUBBLE_GAP = 18;   // fixed space between bubbles (compact cluster, no fill-to-fit)

// ─── Image preloader ──────────────────────────────────────────────────────────
function preloadImages(tokenImages = {}) {
  const entries = Object.entries(tokenImages);
  if (entries.length === 0) return Promise.resolve(new Map());
  // No crossOrigin — CoinGecko's CDN doesn't return ACAO headers, so anonymous
  // requests fail. Tainted canvas is fine since we only drawImage (never read
  // pixels via getImageData), so SOP doesn't bite us.
  const promises = entries.map(([id, src]) =>
    new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve([id, img]);
      img.onerror = () => resolve(null);
      img.src = src;
    })
  );
  return Promise.all(promises).then(results =>
    new Map(results.filter(Boolean))
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function calcRadius(mcap, minMcap, maxMcap, scale = 1) {
  if (!mcap || minMcap === maxMcap) return ((MIN_R + MAX_R) / 2) * scale;
  const logMin = Math.log(minMcap + 1);
  const logMax = Math.log(maxMcap + 1);
  const logVal = Math.log(mcap + 1);
  const t = (logVal - logMin) / (logMax - logMin);
  return (MIN_R + t * (MAX_R - MIN_R)) * scale;
}

// Linear layout: sort by mcap desc, lay out left→right with size scaled to fit.
function packLinear(tokens, W, H) {
  const mcaps = tokens.map(t => t.mcap || 0).filter(Boolean);
  const minMcap = Math.min(...mcaps) || 1;
  const maxMcap = Math.max(...mcaps) || 1;

  // Sort biggest first so largest bubble anchors the left
  const sorted = [...tokens].sort((a, b) => (b.mcap || 0) - (a.mcap || 0));

  // First pass at unscaled radii
  let radii = sorted.map(t => calcRadius(t.mcap || 1, minMcap, maxMcap, 1));

  // Required total width at scale 1
  const requiredW = (W) => {
    const totalDiameter = radii.reduce((s, r) => s + r * 2, 0);
    const totalGap = BUBBLE_GAP * (radii.length - 1);
    return totalDiameter + totalGap + ROW_PAD_X * 2;
  };
  const usable = W;
  let scale = Math.min(1, usable / requiredW(W));
  // Don't shrink below 0.55× — better to clip the smallest tail than make everything tiny
  scale = Math.max(scale, 0.55);
  radii = sorted.map(t => calcRadius(t.mcap || 1, minMcap, maxMcap, scale));

  // Vertical centerline (bias slightly down to leave room for sample wells row)
  const cy = H * 0.55;

  // Walk left→right with a fixed compact gap (do NOT distribute slack).
  // Left-anchored cluster matches the original demo aesthetic — bubbles read as
  // a sorted ranking, not a stretched-to-fit row. Empty space on the right is
  // intentional canvas where the gel bg shows through.
  const bubbles = [];
  let x = ROW_PAD_X;

  sorted.forEach((t, i) => {
    const r = radii[i];
    x += r;
    bubbles.push({
      ...t,
      r,
      x,
      y: cy,
      vx: 0, vy: 0,
    });
    x += r + BUBBLE_GAP;
  });

  // Hide bubbles that overflow the canvas (rare, only on extremely narrow viewports)
  return bubbles.filter(b => b.x - b.r >= -2 && b.x + b.r <= W + 2);
}

// ─── Gel background renderer ─────────────────────────────────────────────────
function createGelBackground(getDims) {
  const LANES = 8;
  // Calm activity preset: ~5 bands at half speed → meditative, low-distraction
  const TARGET_BAND_COUNT = 5;
  const SPEED_MULT = 0.5;
  let bands = [];

  function laneCenters(W) {
    const pad = 8;
    const usable = W - pad * 2;
    const step = usable / LANES;
    const out = [];
    for (let i = 0; i < LANES; i++) out.push(pad + step * (i + 0.5));
    return out;
  }
  function pickHue() {
    // 60% green, 25% teal, 15% red — mirrors data palette
    const r = Math.random();
    if (r < 0.60) return 155;
    if (r < 0.85) return 190;
    return 25;
  }
  function spawnBand(W, initial = false) {
    const lanes = laneCenters(W);
    const laneIdx = Math.floor(Math.random() * lanes.length);
    const { H } = getDims();
    return {
      laneIdx,
      laneSpan: 0.55 + Math.random() * 0.35,
      y: initial ? Math.random() * H : -14,
      h: 4 + Math.random() * 4,
      speed: 0.18 + Math.random() * 0.32,
      hue: pickHue(),
      intensity: 0.55 + Math.random() * 0.45,
    };
  }
  function init() {
    const { W } = getDims();
    bands = [];
    for (let i = 0; i < TARGET_BAND_COUNT; i++) bands.push(spawnBand(W, true));
  }

  function drawLanes(ctx, W, H) {
    const step = (W - 16) / LANES;
    ctx.strokeStyle = 'rgba(140,180,200,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= LANES; i++) {
      const x = 8 + step * i;
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }

  function drawWells(ctx, W) {
    const step = (W - 16) / LANES;
    const wellW = step * 0.55;
    const wellH = 6;
    const y = 4;
    for (let i = 0; i < LANES; i++) {
      const lx = 8 + step * (i + 0.5);
      // dark well slot
      ctx.fillStyle = 'rgba(0,8,12,0.85)';
      ctx.fillRect(lx - wellW / 2, y, wellW, wellH);
      // top edge highlight
      ctx.fillStyle = 'rgba(110,140,155,0.18)';
      ctx.fillRect(lx - wellW / 2, y, wellW, 0.8);
      // soft green glow at bottom edge
      ctx.fillStyle = 'rgba(61,232,160,0.05)';
      ctx.fillRect(lx - wellW / 2 - 1, y + wellH, wellW + 2, 2);
    }
  }

  function drawBands(ctx, W, H) {
    const stepW = (W - 16) / LANES;
    const lanes = laneCenters(W);
    for (const b of bands) {
      b.y += b.speed * 0.55 * SPEED_MULT;
      const fadeIn  = Math.min(1, (b.y + 14) / 30);
      const fadeOut = (b.y / H) > 0.75
        ? Math.max(0, 1 - ((b.y / H) - 0.75) / 0.25) : 1;
      const alpha = b.intensity * fadeIn * fadeOut;
      const lx = lanes[b.laneIdx];
      const bw = stepW * b.laneSpan;

      // soft glow envelope
      const g = ctx.createLinearGradient(0, b.y - b.h * 2, 0, b.y + b.h * 2);
      g.addColorStop(0,   `oklch(0.6 0.15 ${b.hue} / 0)`);
      g.addColorStop(0.5, `oklch(0.72 0.18 ${b.hue} / ${alpha * 0.42})`);
      g.addColorStop(1,   `oklch(0.6 0.15 ${b.hue} / 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(lx - bw / 2, b.y - b.h * 2, bw, b.h * 4);

      // crisp band core
      ctx.fillStyle = `oklch(0.78 0.18 ${b.hue} / ${alpha * 0.55})`;
      ctx.fillRect(lx - bw / 2, b.y - b.h * 0.4, bw, b.h * 0.8);

      // bright highlight pixel
      ctx.fillStyle = `oklch(0.92 0.1 ${b.hue} / ${alpha * 0.7})`;
      ctx.fillRect(lx - bw / 2, b.y - 0.5, bw, 1);
    }
    // recycle expired bands
    for (let i = bands.length - 1; i >= 0; i--) {
      if (bands[i].y > H + 6) bands[i] = spawnBand(W, false);
    }
    while (bands.length < TARGET_BAND_COUNT) bands.push(spawnBand(W, false));
  }

  function draw(ctx) {
    const { W, H } = getDims();
    drawLanes(ctx, W, H);
    drawBands(ctx, W, H);
    drawWells(ctx, W);
  }

  return { init, draw };
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function drawImageBubble(ctx, img, x, y, r, strokeColor, glowBlur, isHovered) {
  // Clip to the bubble circle and draw the image
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const scale = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);

  // Subtle dark scrim — keeps light-background logos legible against the gel bands
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  // Edge vignette — fades to dark at the rim, sharper logos in the centre
  const vignette = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  // Coloured ring on top (with glow when hovered)
  ctx.save();
  if (isHovered) {
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur  = glowBlur;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = isHovered ? 2.5 : 1.8;
  ctx.stroke();
  ctx.restore();
}

function drawTextBubble(ctx, b, isHovered, fillColor, strokeColor, glowBlur) {
  ctx.save();
  // Transparent interior — symbol + colored ring only, gel bg shows through
  if (isHovered) {
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur  = glowBlur;
  }
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.lineWidth   = isHovered ? 2.5 : 2;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Symbol only — no % overlay
  const fontSize = Math.max(10, Math.min(b.r * 0.46, 16));
  ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
  ctx.fillStyle    = strokeColor;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((b.symbol || b.id || '').toUpperCase(), b.x, b.y);
  ctx.restore();
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function mount(container, tokens, onTokenClick, tokenImages = {}) {
  if (!tokens || tokens.length === 0) return () => {};

  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:default;';
  container.appendChild(canvas);

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position:absolute;pointer-events:none;opacity:0;transition:opacity 0.15s ease;
    background:rgba(10,20,28,0.95);border:1px solid rgba(61,232,160,0.25);
    border-radius:8px;padding:9px 13px;font-family:'Space Grotesk',sans-serif;
    font-size:12px;line-height:1.55;min-width:130px;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:10;
  `;
  container.style.position = 'relative';
  container.appendChild(tooltip);

  const dpr = window.devicePixelRatio || 1;
  let W, H, bubbles, hoveredIdx = -1, animId;
  let imageMap = new Map();

  preloadImages(tokenImages).then(map => { imageMap = map; });

  // Gel background — bands need W/H, get them lazily
  const bg = createGelBackground(() => ({ W, H }));

  function resize() {
    const rect = container.getBoundingClientRect();
    W = rect.width  || 700;
    H = rect.height || 280;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    bubbles = packLinear(tokens, W, H);
    bg.init();
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // background first
    bg.draw(ctx);

    // bubbles on top
    bubbles.forEach((b, i) => {
      const pos24h     = (b.d1 || 0) >= 0;
      const isHovered  = i === hoveredIdx;
      const fillColor  = pos24h ? GREEN_FILL  : RED_FILL;
      const strokeColor = pos24h ? GREEN_STROKE : RED_STROKE;
      const glowBlur   = isHovered ? 18 : 0;

      const tokenId = b.id || (b.symbol || '').toLowerCase();
      const img = imageMap.get(tokenId);

      if (img) {
        drawImageBubble(ctx, img, b.x, b.y, b.r, strokeColor, glowBlur, isHovered);
      } else {
        drawTextBubble(ctx, b, isHovered, fillColor, strokeColor, glowBlur);
      }
    });
  }

  function animate() {
    // Bubbles are static — only the gel background animates.
    draw();
    animId = requestAnimationFrame(animate);
  }

  function hitTest(cx, cy) {
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const dx = cx - b.x, dy = cy - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) return i;
    }
    return -1;
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const idx = hitTest(cx, cy);
    hoveredIdx = idx;
    canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';

    if (idx >= 0) {
      const b   = bubbles[idx];
      const pos = (b.d1 || 0) >= 0;
      tooltip.innerHTML = `
        <div style="font-weight:700;font-size:14px;color:#e0f0ea;margin-bottom:4px">${esc(b.symbol || b.id || '')}</div>
        <div style="color:#6aaa99;font-size:11px;margin-bottom:6px">${esc(b.name || b.id || '')}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#e0f0ea">${fmtP(b.price)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${pos ? '#3de8a0' : '#e05040'};margin-top:2px">${(b.d1 >= 0 ? '+' : '') + ((b.d1 || 0).toFixed(2))}% 24h</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#4a7a6a;margin-top:3px">Mcap ${fmtM(b.mcap)}</div>
      `;
      let tx = cx + 14, ty = cy - 10;
      const tw = 150, th = 95;
      if (tx + tw > W) tx = cx - tw - 14;
      if (ty + th > H) ty = H - th - 8;
      tooltip.style.left    = tx + 'px';
      tooltip.style.top     = ty + 'px';
      tooltip.style.opacity = '1';
    } else {
      tooltip.style.opacity = '0';
    }
  }

  function onMouseLeave() {
    hoveredIdx = -1;
    canvas.style.cursor   = 'default';
    tooltip.style.opacity = '0';
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const idx  = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (idx >= 0 && onTokenClick) onTokenClick(bubbles[idx].id || bubbles[idx].symbol);
  }

  // Self-contained formatters
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

  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('click',      onClick);

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  resize();
  animate();

  return () => {
    cancelAnimationFrame(animId);
    ro.disconnect();
    canvas.removeEventListener('mousemove',  onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('click',      onClick);
  };
}
