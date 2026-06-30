// Page-specific JS for /projects/science-beach/ (Science Beach, now OpenLabs).
// Concerns:
//   1. Section reveal: IntersectionObserver .section.observe -> .in-view, plus
//      --i cascade stamping on .reveal-stagger rows.
//   2. Live domain bars: fill width once the section enters view.
//   3. Gutter (left-edge nav), scroll-progress hairline, mobile sticky pill nav.
//   4. Live hydration: fetch /api/openlabs and overwrite the static snapshot
//      with live counts, domain breakdown, notable hypotheses, and projects.
//      /api/openlabs 404s in local dev (Cloudflare Functions are prod-only), so
//      the static snapshot shipped in the HTML stays visible there.
//
// All animations honour prefers-reduced-motion. No localStorage / sessionStorage.

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /* ── 1. --i cascade stamp ───────────────────────────────────── */
  document.querySelectorAll('.reveal-stagger').forEach((row) => {
    Array.prototype.forEach.call(row.children, (el, i) => el.style.setProperty('--i', String(i)));
  });

  /* ── 2. Section reveal + domain bar fill ────────────────────── */
  const fillBars = (root) => {
    (root || document).querySelectorAll('.domain-bar-fill[data-pct]').forEach((el) => {
      el.style.width = el.dataset.pct + '%';
    });
  };
  // Reveal a section + fill its bars. Idempotent.
  const reveal = (s) => { s.classList.add('in-view'); fillBars(s); };
  // Manual fallback: reveal any section that has reached the viewport. Driven by
  // scroll/load/resize so content is NEVER left permanently hidden even if the
  // IntersectionObserver callback does not fire (background tabs, non-painting
  // renderers, automation). IO below is the smooth primary path when it works.
  const revealInView = () => {
    document.querySelectorAll('.section.observe:not(.in-view)').forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) reveal(s);
    });
  };

  if (reduced || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.section.observe').forEach(reveal);
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    document.querySelectorAll('.section.observe').forEach((s) => io.observe(s));
    revealInView(); // above-the-fold shows immediately, no wait on IO's async first callback
    window.addEventListener('scroll', revealInView, { passive: true });
    window.addEventListener('load', revealInView);
    window.addEventListener('resize', revealInView, { passive: true });
  }

  /* ── 3. Gutter (left-edge nav) ──────────────────────────────── */
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
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY, behavior: reduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* ── 4. Scroll-progress hairline ────────────────────────────── */
  const progressEl = document.getElementById('proj-scroll-progress');
  if (progressEl) {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / max));
      progressEl.style.transform = 'scaleX(' + ratio + ')';
    };
    window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ── 5. Mobile sticky pill + slide-down menu ────────────────── */
  const mobileNav = document.getElementById('proj-mobile-nav');
  const mobilePill = document.getElementById('proj-mobile-nav-pill');
  const mobileMenu = document.getElementById('proj-mobile-nav-menu');
  const mobileNum = document.getElementById('proj-mobile-nav-current-num');
  const mobileName = document.getElementById('proj-mobile-nav-current-name');
  const mobileTotal = document.getElementById('proj-mobile-nav-total');
  if (mobileNav && mobilePill && mobileMenu && gutter) {
    const verts = Array.from(gutter.querySelectorAll('.vert'));
    if (mobileTotal) mobileTotal.textContent = String(verts.length);

    verts.forEach((v) => {
      const num = (v.querySelector('.lbl b') && v.querySelector('.lbl b').textContent) || '';
      const name = ((v.querySelector('.lbl') && v.querySelector('.lbl').textContent) || '').replace(num, '').trim();
      const slug = v.dataset.target;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item';
      btn.dataset.target = slug;
      btn.innerHTML = '<b>' + esc(num) + '</b><span>' + esc(name) + '</span>';
      btn.addEventListener('click', () => {
        const t = document.getElementById(slug);
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY, behavior: reduced ? 'auto' : 'smooth' });
        mobileNav.classList.remove('is-open');
        mobilePill.setAttribute('aria-expanded', 'false');
      });
      mobileMenu.appendChild(btn);
    });

    mobilePill.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('is-open');
      mobilePill.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!mobileNav.classList.contains('is-open')) return;
      if (!mobileNav.contains(e.target)) {
        mobileNav.classList.remove('is-open');
        mobilePill.setAttribute('aria-expanded', 'false');
      }
    });

    const syncPill = () => {
      const cur = gutter.querySelector('.vert.is-current');
      if (!cur) return;
      const num = (cur.querySelector('.lbl b') && cur.querySelector('.lbl b').textContent) || '';
      const name = ((cur.querySelector('.lbl') && cur.querySelector('.lbl').textContent) || '').replace(num, '').trim();
      if (mobileNum) mobileNum.textContent = num;
      if (mobileName) mobileName.textContent = ' ' + name;
      mobileMenu.querySelectorAll('.item').forEach((it) => it.classList.toggle('is-current', it.dataset.target === cur.dataset.target));
    };
    const mo = new MutationObserver(syncPill);
    verts.forEach((v) => mo.observe(v, { attributes: true, attributeFilter: ['class'] }));
    syncPill();

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

  /* ── 6. Live hydration from /api/openlabs ───────────────────── */
  const renderDomains = (topics) => {
    const el = document.getElementById('ol-domains');
    if (!el || !Array.isArray(topics) || !topics.length) return;
    const max = Math.max.apply(null, topics.map((t) => t.posts || 0)) || 1;
    el.innerHTML = topics.map((t) => {
      const pct = ((t.posts || 0) / max * 100).toFixed(1);
      return '<li class="domain-row">'
        + '<span class="domain-name"><span class="emoji">' + esc(t.emoji) + '</span>' + esc(t.name) + '</span>'
        + '<span class="domain-bar"><span class="domain-bar-fill" data-pct="' + pct + '" style="width:' + pct + '%"></span></span>'
        + '<span class="domain-count">' + fmt(t.posts || 0) + '<small>' + fmt(t.contributors || 0) + ' contributors</small></span>'
        + '</li>';
    }).join('');
  };

  const renderHyps = (list) => {
    const el = document.getElementById('ol-hypotheses');
    if (!el || !Array.isArray(list) || !list.length) return;
    el.innerHTML = list.map((h) => {
      const meta = [];
      if (h.topic) meta.push('<span class="hyp-topic">' + esc(h.topic) + '</span>');
      if (h.project) meta.push('<span class="hyp-proj">// ' + esc(h.project) + '</span>');
      return '<div class="hyp-card">'
        + '<div class="hyp-meta">' + (meta.join('<span>·</span>') || 'claim') + '</div>'
        + '<div class="hyp-title">' + esc(h.title) + '</div>'
        + '<div class="hyp-foot"><span><b>' + fmt(h.upvotes || 0) + '</b> upvotes</span>'
        + '<span><b>' + fmt(h.comments || 0) + '</b> comments</span></div>'
        + '</div>';
    }).join('');
  };

  const renderProjects = (list) => {
    const el = document.getElementById('ol-projects');
    if (!el || !Array.isArray(list) || !list.length) return;
    el.innerHTML = list.map((p) =>
      '<div class="proj-card"><div class="proj-title">' + esc(p.title) + '</div>'
      + '<div class="proj-sum">' + esc(p.summary) + '</div></div>'
    ).join('');
  };

  fetch('/api/openlabs', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !d.totals) return;
      const t = d.totals;
      const set = (k, v) => {
        if (v == null) return;
        document.querySelectorAll('[data-ol="' + k + '"]').forEach((e) => { e.textContent = fmt(v); e.classList.add('is-live'); });
      };
      set('claims', t.claims); set('posts', t.posts); set('discussions', t.discussions);
      set('topics', t.topics); set('contributors', t.contributors);
      renderDomains(d.topics);
      renderHyps(d.hypotheses);
      renderProjects(d.projects);
      const note = document.getElementById('ol-metrics-note');
      if (note) {
        const date = (d.fetchedAt || '').slice(0, 10);
        note.innerHTML = 'Live from <a href="https://openlabs.bio.xyz" target="_blank" rel="noopener">OpenLabs API</a>'
          + (date ? ' · ' + date : '') + (d.stale ? ' · cached' : '');
        if (d.stale) note.dataset.state = 'stale';
      }
    })
    .catch(() => { /* silent in dev: /api/openlabs is prod-only */ });
})();
