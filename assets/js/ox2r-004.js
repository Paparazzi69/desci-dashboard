// Page-specific JS for /peptides/ox2r-004/.
// Concerns:
//   1. Sequence visualisation: generate the 18 dimmed residue boxes.
//   2. Cascade --i stamping for staggered reveals.
//   3. IntersectionObserver-driven section reveal (.observe → .in-view).
//   4. Gutter: left-edge section nav, fades in after the hero passes.
//
// All animations honour prefers-reduced-motion. The cursor-blink on the H1
// underscore is pure CSS (animation: blink). No localStorage / sessionStorage
// (storage forbidden in this stack).

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. 18 sequence boxes ───────────────────────────────────── */
  const row = document.getElementById('seqRow');
  if (row) {
    for (let i = 1; i <= 18; i++) {
      const b = document.createElement('div');
      b.className = 'seq-box';
      b.dataset.i = String(i);
      b.style.setProperty('--i', String(i - 1));
      row.appendChild(b);
    }
  }

  /* ── 2. Stamp --i for cascade order ─────────────────────────── */
  [
    '.section .sel-row > .sel-card',
    '.section .risk-grid > .risk-card',
    '.section .deeper-grid > .deeper-card',
    '.section .timeline > .tl-row',
    '.section .primer-grid > .primer-col',
  ].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.setProperty('--i', String(idx));
    });
  });

  /* ── 3. Section reveal ──────────────────────────────────────── */
  if (reduced || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.section.observe, .hero.observe').forEach((s) => s.classList.add('in-view'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    document.querySelectorAll('.section.observe, .hero.observe').forEach((s) => io.observe(s));
  }

  /* ── 4. Gutter ──────────────────────────────────────────────── */
  const gutter = document.querySelector('.pep-gutter');
  if (gutter) {
    const verts = Array.from(gutter.querySelectorAll('.vert'));
    const targets = verts.map((b) => document.getElementById(b.dataset.target)).filter(Boolean);

    const hero = document.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) {
      const showIO = new IntersectionObserver((es) => {
        es.forEach((e) => gutter.classList.toggle('is-active', !e.isIntersecting));
      }, { rootMargin: '-90% 0px 0px 0px', threshold: 0 });
      showIO.observe(hero);
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
})();
