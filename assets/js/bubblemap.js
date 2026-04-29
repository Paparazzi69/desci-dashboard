// bubblemap.js — Canvas bubble map visualisation for the DeSci token sector.
// Usage: mount(container, tokens, onTokenClick)
// Each bubble = one token. Size ∝ sqrt(mcap). Color = 24h direction.
// Bubbles float with gentle physics; hover shows tooltip; click opens drawer.

const GREEN = 'oklch(0.78 0.19 155)';
const RED   = 'oklch(0.65 0.2 22)';
const GREEN_FILL = 'rgba(29,184,114,0.18)';
const RED_FILL   = 'rgba(180,60,40,0.15)';
const GREEN_STROKE = 'rgba(61,232,160,0.8)';
const RED_STROKE   = 'rgba(210,80,60,0.75)';
const TEXT_COLOR   = 'rgba(220,240,235,0.92)';
const TEXT_DIM     = 'rgba(140,180,170,0.75)';
const BG           = 'rgba(13,22,30,0)'; // transparent — let page bg show

const MIN_R = 28;
const MAX_R = 84;

function calcRadius(mcap, minMcap, maxMcap) {
  if (!mcap || minMcap === maxMcap) return (MIN_R + MAX_R) / 2;
  // Use log scale for better visual distribution across 3 orders of magnitude
  const logMin = Math.log(minMcap + 1);
  const logMax = Math.log(maxMcap + 1);
  const logVal = Math.log(mcap + 1);
  const t = (logVal - logMin) / (logMax - logMin);
  return MIN_R + t * (MAX_R - MIN_R);
}

function packBubbles(tokens, W, H) {
  const mcaps = tokens.map(t => t.mcap || 0).filter(Boolean);
  const minMcap = Math.min(...mcaps) || 1;
  const maxMcap = Math.max(...mcaps) || 1;

  const bubbles = tokens.map(t => ({
    ...t,
    r: calcRadius(t.mcap || 1, minMcap, maxMcap),
    x: 0, y: 0,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    targetX: 0, targetY: 0,
  }));

  // Grid pack initial positions
  const cols = Math.ceil(Math.sqrt(bubbles.length * W / H));
  const rows = Math.ceil(bubbles.length / cols);
  const cellW = W / cols;
  const cellH = H / rows;
  bubbles.forEach((b, i) => {
    b.x = (i % cols + 0.5) * cellW + (Math.random() - 0.5) * 20;
    b.y = (Math.floor(i / cols) + 0.5) * cellH + (Math.random() - 0.5) * 20;
    b.targetX = b.x;
    b.targetY = b.y;
  });

  return bubbles;
}

function resolveCollisions(bubbles) {
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i], b = bubbles[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 0.01;
      const minDist = a.r + b.r + 6;
      if (dist < minDist) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist, ny = dy / dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
      }
    }
  }
}

function clampToBounds(bubbles, W, H, pad = 8) {
  for (const b of bubbles) {
    b.x = Math.max(b.r + pad, Math.min(W - b.r - pad, b.x));
    b.y = Math.max(b.r + pad, Math.min(H - b.r - pad, b.y));
  }
}

export function mount(container, tokens, onTokenClick) {
  if (!tokens || tokens.length === 0) return;

  // --- DOM setup ---
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:default;';
  container.appendChild(canvas);

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position:absolute;pointer-events:none;opacity:0;transition:opacity 0.15s ease;
    background:rgba(10,20,28,0.95);border:1px solid rgba(61,232,160,0.25);
    border-radius:8px;padding:9px 13px;font-family:'Space Grotesk',sans-serif;
    font-size:12px;line-height:1.55;min-width:120px;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:10;
  `;
  container.style.position = 'relative';
  container.appendChild(tooltip);

  const dpr = window.devicePixelRatio || 1;
  let W, H, bubbles, hoveredIdx = -1, animId;

  function resize() {
    const rect = container.getBoundingClientRect();
    W = rect.width || 700;
    H = rect.height || 280;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    bubbles = packBubbles(tokens, W, H);
    for (let i = 0; i < 120; i++) {
      resolveCollisions(bubbles);
      clampToBounds(bubbles, W, H);
    }
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    bubbles.forEach((b, i) => {
      const pos24h = (b.d1 || 0) >= 0;
      const isHovered = i === hoveredIdx;
      const fillColor   = pos24h ? GREEN_FILL   : RED_FILL;
      const strokeColor = pos24h ? GREEN_STROKE  : RED_STROKE;

      ctx.save();

      // Glow on hover
      if (isHovered) {
        ctx.shadowColor = pos24h ? 'rgba(61,232,160,0.5)' : 'rgba(210,80,60,0.45)';
        ctx.shadowBlur  = 18;
      }

      // Fill
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Stroke
      ctx.lineWidth = isHovered ? 2 : 1.2;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Symbol label
      const fontSize = Math.max(10, Math.min(b.r * 0.42, 18));
      ctx.font = `600 ${fontSize}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((b.symbol || b.id || '').toUpperCase(), b.x, b.y - (b.r > 36 ? fontSize * 0.55 : 0));

      // 24h % below symbol (only if bubble big enough)
      if (b.r > 36) {
        const pct = (b.d1 ?? 0);
        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
        const pctSize = Math.max(8, fontSize * 0.72);
        ctx.font = `500 ${pctSize}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = pos24h ? 'rgba(61,232,160,0.85)' : 'rgba(210,100,80,0.85)';
        ctx.fillText(pctStr, b.x, b.y + fontSize * 0.7);
      }

      ctx.restore();
    });
  }

  let tick = 0;
  function animate() {
    tick++;
    // Gentle drift
    bubbles.forEach((b, i) => {
      // Slow sine drift per bubble
      const angle = (tick * 0.008) + i * 1.3;
      b.x += Math.sin(angle) * 0.12;
      b.y += Math.cos(angle * 0.8 + i) * 0.10;
      // Mild velocity
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.992;
      b.vy *= 0.992;
    });
    resolveCollisions(bubbles);
    clampToBounds(bubbles, W, H);
    draw();
    animId = requestAnimationFrame(animate);
  }

  function hitTest(cx, cy) {
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const dx = cx - b.x, dy = cy - b.y;
      if (dx*dx + dy*dy <= b.r*b.r) return i;
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
      const b = bubbles[idx];
      const pos = (b.d1 || 0) >= 0;
      tooltip.innerHTML = `
        <div style="font-weight:700;font-size:14px;color:#e0f0ea;margin-bottom:4px">${(b.symbol||'').toUpperCase()}</div>
        <div style="color:#6aaa99;font-size:11px;margin-bottom:6px">${b.name||b.id||''}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#e0f0ea">${fmtPriceLocal(b.price)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${pos?'#3de8a0':'#e05040'};margin-top:2px">${(b.d1>=0?'+':'')+((b.d1||0).toFixed(2))}% 24h</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#4a7a6a;margin-top:3px">Mcap ${fmtLocal(b.mcap)}</div>
      `;
      // Position tooltip — avoid edges
      let tx = cx + 14;
      let ty = cy - 10;
      const tw = 140, th = 90;
      if (tx + tw > W) tx = cx - tw - 14;
      if (ty + th > H) ty = H - th - 8;
      tooltip.style.left = tx + 'px';
      tooltip.style.top  = ty + 'px';
      tooltip.style.opacity = '1';
    } else {
      tooltip.style.opacity = '0';
    }
  }

  function onMouseLeave() {
    hoveredIdx = -1;
    canvas.style.cursor = 'default';
    tooltip.style.opacity = '0';
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const idx = hitTest(cx, cy);
    if (idx >= 0 && onTokenClick) onTokenClick(bubbles[idx].id);
  }

  // Local mini-formatters (no import needed, keep module self-contained)
  function fmtLocal(n) {
    if (!n) return '—';
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function fmtPriceLocal(p) {
    if (!p) return '—';
    if (p >= 100) return '$' + p.toFixed(2);
    if (p >= 1)   return '$' + p.toFixed(3);
    if (p >= 0.01) return '$' + p.toFixed(4);
    if (p >= 0.0001) return '$' + p.toFixed(6);
    return '$' + p.toFixed(8);
  }

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('click', onClick);

  const ro = new ResizeObserver(() => {
    resize();
    for (let i = 0; i < 80; i++) { resolveCollisions(bubbles); clampToBounds(bubbles, W, H); }
  });
  ro.observe(container);

  resize();
  animate();

  // Return cleanup fn
  return () => {
    cancelAnimationFrame(animId);
    ro.disconnect();
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('click', onClick);
  };
}
