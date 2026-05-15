// Page-specific JS for /projects/aubrai/.
// Concerns:
//   1. Section reveal: IntersectionObserver-driven .observe -> .in-view.
//   2. Gutter: left-edge section nav, fades in after the first section passes.
//   3. Live FDV hydration: fetch /api/prices and write into the TL;DR card if
//      the GeckoTerminal lookup for the aubrai id succeeded. Static "May 2026
//      snapshot" fallback stays in the DOM until then.
//
// All animations honour prefers-reduced-motion. No localStorage / sessionStorage
// (storage forbidden in this stack).

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Stamp --i for cascade order ────────────────────────────── */
  [
    '.section .tldr-row > .tldr-card',
    '.section .stat-row > .stat-cell',
    '.section .stack-row > .stack-card',
    '.section .risk-grid > .risk-card',
    '.section .deeper-grid > .deeper-card',
    '.section .timeline > .tl-row',
    '.section .compare > .compare-row',
    '.section .team-grid > .team-card',
    '.section .org-tri > .org-box',
    '.section .flywheel-row > .fly-step',
    '.section .sample-stack > .sample-card',
    '.section .arc-row > .arc-node',
    '.section .onchain-row > .wallet-card',
    '.section .rmr2-list li',
    '.section .tech-row > .tech-cell',
    '.section .bench-list li',
  ].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.setProperty('--i', String(idx));
    });
  });

  /* ── 1. Section reveal ──────────────────────────────────────── */
  if (reduced || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.section.observe').forEach((s) => s.classList.add('in-view'));
  } else {
    const sectionIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          sectionIO.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    document.querySelectorAll('.section.observe').forEach((s) => sectionIO.observe(s));
  }

  /* ── 2. Donut sweep-fill (token distribution) ───────────────── */
  const tokeno = document.querySelector('.tokeno-vis');
  if (tokeno) {
    if (reduced || !('IntersectionObserver' in window)) {
      tokeno.classList.add('in-view');
    } else {
      const donutIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            tokeno.classList.add('in-view');
            donutIO.disconnect();
          }
        });
      }, { threshold: 0.35 });
      donutIO.observe(tokeno);
    }
  }

  /* ── 3. Gutter ──────────────────────────────────────────────── */
  const gutter = document.querySelector('.pep-gutter');
  if (gutter) {
    const verts = Array.from(gutter.querySelectorAll('.vert'));
    const targets = verts.map((b) => document.getElementById(b.dataset.target)).filter(Boolean);

    const first = document.querySelector('#sec-1');
    if (first && 'IntersectionObserver' in window) {
      const showIO = new IntersectionObserver((es) => {
        es.forEach((e) => gutter.classList.toggle('is-active', !e.isIntersecting));
      }, { rootMargin: '-90% 0px 0px 0px', threshold: 0 });
      showIO.observe(first);
    } else {
      gutter.classList.add('is-active');
    }

    if ('IntersectionObserver' in window) {
      const activeIO = new IntersectionObserver((es) => {
        es.forEach((e) => { e.target.dataset.intersecting = e.isIntersecting ? '1' : ''; });
        let cur = null;
        for (const t of targets) if (t.dataset.intersecting === '1') cur = t;
        if (!cur) return;
        verts.forEach((b) => b.classList.toggle('is-current', b.dataset.target === cur.id));
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      targets.forEach((t) => activeIO.observe(t));
    }

    verts.forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = document.getElementById(btn.dataset.target);
        if (!t) return;
        window.scrollTo({
          top: t.getBoundingClientRect().top + window.scrollY,
          behavior: reduced ? 'auto' : 'smooth',
        });
      });
    });
  }

  /* ── 4. Live FDV hydration ──────────────────────────────────── */
  // Fetch /api/prices, pick the aubrai entry, write a "~$X.XM" string into
  // [data-aubrai-fdv]. /api/prices returns 404 in local dev (Cloudflare
  // Functions only run in production), so the static snapshot fallback that
  // ships in the HTML stays visible. In production the GT lookup against
  // the Base contract drives a live number.
  const fdvEl = document.querySelector('[data-aubrai-fdv]');
  if (fdvEl) {
    fetch('/api/prices', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        const t = (json.tokens || []).find((x) => x.id === 'aubrai');
        if (!t || t.fdv == null) return;
        const m = t.fdv / 1_000_000;
        fdvEl.textContent = '~$' + m.toFixed(2) + 'M';
        fdvEl.classList.add('is-live');
      })
      .catch(() => { /* silent in dev */ });
  }
})();
