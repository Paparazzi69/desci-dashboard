// particle-network.js — Particle network background for DeSci Dashboard
// Subtle knowledge-graph aesthetic: drifting particles connected by lines when nearby.
//
// Usage:
//   import { mount as mountParticleNetwork } from './particle-network.js';
//   const cleanup = mountParticleNetwork(containerEl, { boost: false });
//   // later: cleanup();
//
// Container REQUIREMENTS:
//   - position: relative (or absolute/fixed); the canvas is appended absolute-inset:0
//   - overflow: hidden recommended
//   - children that should sit ABOVE the network must have position:relative; z-index:1
//
// Options:
//   boost   — true for the BioAgent strip (denser + brighter), false for the token table
//
// Config baked in: density=medium, speed=calm, color=green+accent (~70% green / 20% teal / 10% blue).

const DENSITY = 0.00018;     // particles per px² for non-boosted surfaces
const BOOST_MULT = 1.6;      // strip gets 1.6× particles
const SPEED = 0.18;          // calm preset
const LINK_DIST = 80;        // base connect distance (px)
const LINK_DIST_BOOST = 90;
const LINE_MAX_A = 0.18;
const LINE_MAX_A_BOOST = 0.32;
const POINT_ALPHA = 0.55;
const POINT_ALPHA_BOOST = 0.85;

function pickHue() {
  // green + accent: ~70% green, ~20% teal, ~10% blue
  const r = Math.random();
  if (r < 0.70) return 155; // green
  if (r < 0.90) return 190; // teal
  return 240;               // blue
}

export function mount(container, opts = {}) {
  const boost = !!opts.boost;
  const linkDist = boost ? LINK_DIST_BOOST : LINK_DIST;
  const lineMaxA = boost ? LINE_MAX_A_BOOST : LINE_MAX_A;
  const pointAlpha = boost ? POINT_ALPHA_BOOST : POINT_ALPHA;
  const densityMult = boost ? BOOST_MULT : 1;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  // Ensure container can host an absolutely-positioned child
  const cs = getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'relative';
  container.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let W = 0, H = 0, particles = [], rafId = 0;
  let visible = true;

  function targetCount() {
    return Math.max(8, Math.round(W * H * DENSITY * densityMult));
  }

  function spawn(initial) {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r: 0.9 + Math.random() * 1.2,
      hue: pickHue(),
      a: 0.5 + Math.random() * 0.4,
    };
  }

  function init() {
    particles = [];
    const n = targetCount();
    for (let i = 0; i < n; i++) particles.push(spawn(true));
  }

  function resize() {
    const r = container.getBoundingClientRect();
    W = r.width; H = r.height;
    if (W === 0 || H === 0) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }

  function frame() {
    if (!visible) { rafId = requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, W, H);

    // Update positions
    for (const p of particles) {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < SPEED * 0.3) {
        p.vx += (Math.random() - 0.5) * SPEED * 0.4;
        p.vy += (Math.random() - 0.5) * SPEED * 0.4;
      }
      const maxSp = SPEED * 1.6;
      if (sp > maxSp) { p.vx *= maxSp / sp; p.vy *= maxSp / sp; }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
    }

    // Draw connecting lines (O(n²) — fine at this density, ~25-50 particles)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > linkDist * linkDist) continue;
        const d = Math.sqrt(d2);
        const t = 1 - d / linkDist;
        const hue = (a.hue + b.hue) / 2;
        ctx.strokeStyle = `oklch(0.72 0.16 ${hue} / ${(t * lineMaxA).toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Draw points
    for (const p of particles) {
      ctx.fillStyle = `oklch(0.78 0.18 ${p.hue} / ${(p.a * pointAlpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(frame);
  }

  // Pause when offscreen — saves CPU on long-scrolling pages
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }, { rootMargin: '100px' });
  io.observe(container);

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  resize();
  rafId = requestAnimationFrame(frame);

  return function cleanup() {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    io.disconnect();
    canvas.remove();
  };
}
