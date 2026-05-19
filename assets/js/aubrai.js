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

  /* ── 3.5. v2 audit · scroll-progress hairline ───────────────── */
  // Fixed 2px coral hairline at viewport top, scaleX = scroll position
  // over total scroll distance. requestAnimationFrame-throttled so the
  // listener never blocks rendering. Reduced-motion still works (no
  // transition is applied; the bar just snaps to the current ratio).
  const progressEl = document.getElementById('proj-scroll-progress');
  if (progressEl) {
    let progressFrame = 0;
    const updateProgress = () => {
      progressFrame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / max));
      progressEl.style.transform = 'scaleX(' + ratio + ')';
    };
    const onScroll = () => {
      if (progressFrame) return;
      progressFrame = requestAnimationFrame(updateProgress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();
  }

  /* ── 3.6. v2 audit · mobile sticky pill + slide-down menu ───── */
  // Clones the entries from the existing .pep-gutter into a mobile-only
  // slide-down menu. Pill displays current section "//NN NAME / TOTAL"
  // and toggles the menu. IntersectionObserver keeps the pill's label
  // and the menu's .is-current marker in sync as the user scrolls.
  const mobileNav  = document.getElementById('proj-mobile-nav');
  const mobilePill = document.getElementById('proj-mobile-nav-pill');
  const mobileMenu = document.getElementById('proj-mobile-nav-menu');
  const mobileNum  = document.getElementById('proj-mobile-nav-current-num');
  const mobileName = document.getElementById('proj-mobile-nav-current-name');
  const mobileTotal = document.getElementById('proj-mobile-nav-total');
  if (mobileNav && mobilePill && mobileMenu && gutter) {
    const verts = Array.from(gutter.querySelectorAll('.vert'));
    mobileTotal && (mobileTotal.textContent = String(verts.length));

    // Populate the menu by cloning the rail's labels.
    verts.forEach((v) => {
      const num   = v.querySelector('.lbl b')?.textContent || '';
      const name  = (v.querySelector('.lbl')?.textContent || '').replace(num, '').trim();
      const slug  = v.dataset.target;
      const btn   = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item' + (slug === 'sec-10-5' ? ' is-nested' : '');
      btn.dataset.target = slug;
      btn.innerHTML = '<b>' + num + '</b><span>' + name + '</span>';
      btn.addEventListener('click', () => {
        const t = document.getElementById(slug);
        if (t) {
          window.scrollTo({
            top: t.getBoundingClientRect().top + window.scrollY,
            behavior: reduced ? 'auto' : 'smooth',
          });
        }
        mobileNav.classList.remove('is-open');
        mobilePill.setAttribute('aria-expanded', 'false');
      });
      mobileMenu.appendChild(btn);
    });

    // Toggle menu on pill click.
    mobilePill.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('is-open');
      mobilePill.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close menu when clicking outside.
    document.addEventListener('click', (e) => {
      if (!mobileNav.classList.contains('is-open')) return;
      if (!mobileNav.contains(e.target)) {
        mobileNav.classList.remove('is-open');
        mobilePill.setAttribute('aria-expanded', 'false');
      }
    });

    // Sync pill label + .is-current with current section. Reuse the
    // gutter's existing IO output rather than instantiating a second
    // observer: mirror whichever .vert just got .is-current.
    const syncPill = () => {
      const cur = gutter.querySelector('.vert.is-current');
      if (!cur) return;
      const num  = cur.querySelector('.lbl b')?.textContent || '';
      const name = (cur.querySelector('.lbl')?.textContent || '').replace(num, '').trim();
      mobileNum  && (mobileNum.textContent = num);
      mobileName && (mobileName.textContent = ' ' + name);
      mobileMenu.querySelectorAll('.item').forEach((it) => {
        it.classList.toggle('is-current', it.dataset.target === cur.dataset.target);
      });
    };
    // The MutationObserver fires every time the gutter toggles
    // .is-current on a .vert (which the existing IntersectionObserver
    // above already does). This keeps the pill in sync without
    // duplicating the IO bookkeeping.
    const mo = new MutationObserver(syncPill);
    verts.forEach((v) => mo.observe(v, { attributes: true, attributeFilter: ['class'] }));
    syncPill();

    // Reveal the pill once the masthead has scrolled out of view (same
    // criterion as the desktop gutter: first section no longer
    // intersecting the top 10% of the viewport).
    const firstSection = document.getElementById('sec-1');
    if (firstSection && 'IntersectionObserver' in window) {
      const pillShowIO = new IntersectionObserver((es) => {
        es.forEach((e) => mobileNav.classList.toggle('is-active', !e.isIntersecting));
      }, { rootMargin: '-90% 0px 0px 0px', threshold: 0 });
      pillShowIO.observe(firstSection);
    } else {
      mobileNav.classList.add('is-active');
    }
  }

  /* ── 3.7. v2 audit · // 06 sample-card click + keyboard ─────── */
  // Cards carry data-href. Clicking anywhere outside an inner <a> opens
  // that URL in a new tab. Enter/Space activate the same behavior for
  // keyboard users (cards have tabindex="0").
  document.querySelectorAll('.sample-card[data-href]').forEach((card) => {
    const href = card.dataset.href;
    const open = () => window.open(href, '_blank', 'noopener');
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      open();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('a')) return;
      e.preventDefault();
      open();
    });
  });

  /* ── 3.8. v2 audit · // 10.5 wallet click-to-copy ───────────── */
  // Each wallet card carries data-copy (the full address). Click-to-copy
  // writes the full address to clipboard, flashes a brief "copied ✓"
  // state, then reverts after 1500ms. The truncated address in the DOM
  // stays as the visible label.
  document.querySelectorAll('.wallet-card[data-copy]').forEach((card) => {
    const full = card.dataset.copy;
    const hint = card.querySelector('.copy-hint');
    let resetTimer = 0;
    const flashCopied = () => {
      card.classList.add('is-copied');
      if (hint) hint.textContent = 'copied ✓';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        card.classList.remove('is-copied');
        if (hint) hint.textContent = 'click to copy';
      }, 1500);
    };
    const doCopy = async (e) => {
      if (e && e.target.closest('a')) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(full);
        } else {
          // Fallback: hidden textarea + execCommand.
          const ta = document.createElement('textarea');
          ta.value = full;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (_) { /* ignore */ }
          document.body.removeChild(ta);
        }
        flashCopied();
      } catch { /* silent: clipboard denied */ }
    };
    card.addEventListener('click', doCopy);
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('a')) return;
      e.preventDefault();
      doCopy(e);
    });
  });

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
