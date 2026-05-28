// Page-specific JS for /projects/spinedao/.
// Three concerns:
//   1. Live ticker — fetches /api/prices and patches the SPINE card.
//   2. Donut highlight — bidirectional segment ↔ legend hover.
//   3. Scroll choreography — IntersectionObserver-driven section reveal,
//      hero parallax (rAF-gated), and spine-gutter active-section tracking.
// Animations are gated behind prefers-reduced-motion.

(() => {
  /* ── 1. Live ticker ────────────────────────────────────────── */
  const ticker = document.querySelector('.ticker');
  if (ticker) hydrateTicker(ticker);

  async function hydrateTicker(el) {
    try {
      const r = await fetch('/api/prices', { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`prices ${r.status}`);
      const json = await r.json();
      const t = (json.tokens || []).find(x => x.id === 'spinedao');
      if (!t) return; // fall back to design's static placeholders
      patchTicker(el, t, json.fetchedAt);
    } catch (err) {
      console.warn('[spinedao] live ticker fetch failed:', err);
    }
  }

  // SpineDAO has a fixed 1B max supply, so FDV is meaningful even pre-fully-
  // distributed. Most CT users see the Jupiter ~$3.27M FDV figure, not the
  // ~297.87M-circulating mcap GT reports. Compute price × 1B for parity.
  const SPINE_MAX_SUPPLY = 1_000_000_000;

  function patchTicker(el, t, fetchedAt) {
    const priceEl = el.querySelector('.ticker-price');
    const fdvEl   = el.querySelector('[data-stat="fdv"] .v');
    const mcapEl  = el.querySelector('[data-stat="mcap"] .v');
    const d1El    = el.querySelector('[data-stat="d1"] .v');
    const volEl   = el.querySelector('[data-stat="vol"] .v');
    const sparkEl = el.querySelector('.ticker-spark');
    const tsEl    = el.querySelector('[data-fetched-at]');

    if (priceEl && t.price != null) priceEl.textContent = fmtPrice(t.price);
    if (fdvEl   && t.price != null) fdvEl.textContent   = fmtCompactUSD(t.price * SPINE_MAX_SUPPLY);
    if (mcapEl  && t.mcap  != null) mcapEl.textContent  = fmtCompactUSD(t.mcap);
    if (volEl   && t.vol   != null) volEl.textContent   = fmtCompactUSD(t.vol);
    if (d1El    && t.d1    != null) {
      d1El.textContent = fmtPct(t.d1);
      d1El.classList.toggle('up',   t.d1 >= 0);
      d1El.classList.toggle('down', t.d1 <  0);
    }
    if (sparkEl && Array.isArray(t.spark) && t.spark.length >= 2) {
      sparkEl.innerHTML = renderSparkline(t.spark);
    }
    if (tsEl && fetchedAt) {
      tsEl.textContent = fmtTimestamp(fetchedAt);
    }
  }

  function fmtPrice(n) {
    if (n >= 1)     return '$' + n.toFixed(3);
    if (n >= 0.01)  return '$' + n.toFixed(4);
    if (n >= 0.001) return '$' + n.toFixed(5);
    return '$' + n.toExponential(2);
  }
  function fmtCompactUSD(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
  }
  function fmtPct(n) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  }
  function fmtTimestamp(iso) {
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} · ${hh}:${mi} UTC`;
  }

  // SVG sparkline scaled to 348x36 viewBox to match the design's static path.
  function renderSparkline(values) {
    const W = 348, H = 36;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = W / (values.length - 1);
    const pad = 4;
    const usableH = H - pad * 2;
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = pad + usableH - ((v - min) / range) * usableH;
      return [x, y];
    });
    const linePath = points.map(([x, y], i) =>
      (i === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)}` : `L ${x.toFixed(1)},${y.toFixed(1)}`)
    ).join(' ');
    const fillPath = `${linePath} L ${W},${H} L 0,${H} Z`;
    return `<svg width="100%" height="36" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg-live" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3ee07b" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#3ee07b" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${fillPath}" fill="url(#sg-live)"/>
      <path d="${linePath}" fill="none" stroke="#3ee07b" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ── 2. Donut bidirectional highlight ──────────────────────── */
  const tokeno = document.querySelector('.tokeno-vis');
  const wrap = document.querySelector('.tokeno-wrap');
  if (tokeno && wrap) {
    tokeno.classList.add('js-ready');
    const svg = tokeno.querySelector('svg');

    const donutIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          tokeno.classList.add('in-view');
          donutIO.disconnect();
        }
      });
    }, { threshold: 0.35 });
    donutIO.observe(tokeno);

    const segs = wrap.querySelectorAll('[data-seg]');
    const setHL = (key) => {
      segs.forEach(el => el.classList.toggle('hl', el.dataset.seg === key));
      svg && svg.classList.add('dim-others');
    };
    const clearHL = () => {
      segs.forEach(el => el.classList.remove('hl'));
      svg && svg.classList.remove('dim-others');
    };
    segs.forEach(el => {
      el.addEventListener('mouseenter', () => setHL(el.dataset.seg));
      el.addEventListener('mouseleave', clearHL);
    });
  }

  /* ── 3. Scroll choreography (sections, parallax, gutter) ───── */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Stamp --i on each repeated child so cascade order matches index.
  [
    '.section .stat-row > .stat-card',
    '.section .bento > .bento-card',
    '.receipts-section .receipts-grid > .receipt-cell',
    '.section .team-grid > .team-card',
    '.section .timeline > .tl-row',
  ].forEach(sel => {
    document.querySelectorAll(sel).forEach((el) => {
      const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.setProperty('--i', String(idx));
    });
  });

  // Reveal sections on entry. Once is enough; we don't unobserve on exit.
  if (!reduced && 'IntersectionObserver' in window) {
    const sectionIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          sectionIO.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    document.querySelectorAll('.section.observe, .receipts-section.observe').forEach((s) => {
      sectionIO.observe(s);
    });
  } else {
    document.querySelectorAll('.section.observe, .receipts-section.observe').forEach((s) => {
      s.classList.add('in-view');
    });
  }

  // Hero parallax — vertebra glyph translates at 30% of scrollY. Only ticks
  // while hero intersects (IO + rAF, no global scroll listener).
  const hero = document.querySelector('.hero');
  const vert = document.querySelector('.vertebra-stack');
  if (hero && vert && !reduced) {
    let active = false;
    let raf = 0;
    const tick = () => {
      if (!active) return;
      const y = window.scrollY * 0.3;
      vert.style.transform = `translateY(${y}px)`;
      raf = requestAnimationFrame(tick);
    };
    const heroIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !active) { active = true; tick(); }
        else if (!e.isIntersecting) { active = false; cancelAnimationFrame(raf); }
      });
    }, { threshold: 0 });
    heroIO.observe(hero);
  }

  // Spine gutter: appears after hero leaves top, tracks current section,
  // smooth-scrolls on click.
  const gutter = document.querySelector('.spine-gutter');
  if (gutter) {
    const verts = Array.from(gutter.querySelectorAll('.vert'));
    const targets = verts
      .map((b) => document.getElementById(b.dataset.target))
      .filter(Boolean);

    if (hero) {
      const showIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          gutter.classList.toggle('is-active', !e.isIntersecting);
        });
      }, { rootMargin: '-90% 0px 0px 0px', threshold: 0 });
      showIO.observe(hero);
    } else {
      gutter.classList.add('is-active');
    }

    const activeIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        e.target.dataset.intersecting = e.isIntersecting ? '1' : '';
      });
      let current = null;
      for (const t of targets) {
        if (t.dataset.intersecting === '1') current = t;
      }
      if (!current) return;
      const id = current.id;
      verts.forEach((b) => {
        b.classList.toggle('is-current', b.dataset.target === id);
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    targets.forEach((t) => activeIO.observe(t));

    verts.forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = document.getElementById(btn.dataset.target);
        if (!t) return;
        const top = t.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* ── 4. Copy buttons (DOI + contract address) ──────────────── */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const original = btn.textContent;
        btn.textContent = 'COPIED';
        setTimeout(() => { btn.textContent = original; }, 1200);
      } catch (err) {
        console.warn('[spinedao] clipboard write failed:', err);
      }
    });
  });

  /* ── 5. Papers block (Europe PMC live) ─────────────────────── */
  const papersBlock = document.querySelector('[data-papers-project]');
  if (papersBlock) hydratePapers(papersBlock);

  async function hydratePapers(el) {
    const slug = el.dataset.papersProject;
    try {
      const r = await fetch(`/api/papers/${encodeURIComponent(slug)}`, {
        headers: { accept: 'application/json' },
      });
      if (!r.ok) throw new Error(`papers ${r.status}`);
      const json = await r.json();
      renderPapers(el, json);
    } catch (err) {
      // Leave skeleton in place — a broken-looking block is worse than a
      // quietly absent one. The section above still shows the 1,000+ count.
      console.warn('[spinedao] papers fetch failed:', err);
    }
  }

  function renderPapers(el, json) {
    const list = el.querySelector('[data-papers-list]');
    const exploreLink = el.querySelector('[data-papers-explore]');
    const papers = Array.isArray(json.papers) ? json.papers : [];
    const highlight = Array.isArray(json.highlightAuthors) ? json.highlightAuthors : [];
    if (json.exploreUrl && exploreLink) exploreLink.href = json.exploreUrl;
    if (!papers.length) {
      // EPMC returned empty — keep skeleton structure so layout doesn't shift.
      return;
    }
    list.innerHTML = papers.map(p => paperRowHtml(p, highlight)).join('');
  }

  function paperRowHtml(p, highlight) {
    const title   = escapeHtml(p.title || '');
    const authors = renderAuthors(p.authors || '', highlight);
    const journal = p.journal ? `<span class="journal">${escapeHtml(p.journal)}</span>` : '';
    const year    = p.year || '';
    const cited   = (p.citedBy > 0) ? `<span class="cited">${p.citedBy}</span> cited` : '';
    const meta    = [year, journal, cited].filter(Boolean).join(' · ');
    const href    = p.doi ? `https://doi.org/${encodeURI(p.doi)}` : '#';
    return `
      <li class="paper-row">
        <a class="paper-title-link" href="${href}" target="_blank" rel="noopener noreferrer">${title}</a>
        <div class="paper-meta">${meta}</div>
        <div class="paper-authors">${authors}</div>
      </li>
    `;
  }

  // Escape author string first, then wrap any founder name in <b>. Founder
  // names from Europe PMC are simple "Surname X" tokens with no HTML-special
  // chars, so the post-escape literal replace is safe.
  function renderAuthors(authorString, highlight) {
    let out = escapeHtml(authorString);
    for (const name of highlight) {
      const safe = escapeHtml(name);
      const re = new RegExp(`\\b${safe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      out = out.replace(re, `<b>${safe}</b>`);
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
