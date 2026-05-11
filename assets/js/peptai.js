// Page-specific JS for /projects/peptai/.
// Concerns:
//   1. Section reveal: IntersectionObserver-driven .observe → .in-view.
//   2. Pipeline gate light-up: sequential reveal once the row scrolls in.
//   3. Donut highlight: bidirectional segment ↔ legend hover plus a
//      sweep-fill animation gated on intersection.
//   4. Drawer: right-slide panel for each agent banner. Outside-click and
//      Escape both close.
//   5. Gutter: left-edge section nav, fades in after the hero passes.
//   6. Copy buttons: clipboard write for any [data-copy] target.
//
// All animations honour prefers-reduced-motion. No localStorage / sessionStorage
// (storage forbidden in this stack).

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Stamp --i for cascade order ────────────────────────────── */
  [
    '.section .tldr-row > .tldr-card',
    '.section .why-grid > .why-block',
    '.section .stack-row > .stack-card',
    '.section .risk-grid > .risk-card',
    '.section .programs > .program-banner',
    '.section .deeper-grid > .deeper-card',
    '.section .timeline > .tl-row',
    '.section .compare > .compare-row',
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

  /* ── 2. Pipeline gate light-up ──────────────────────────────── */
  const pipeRow = document.getElementById('pipe-row');
  if (pipeRow) {
    const gates = Array.from(pipeRow.querySelectorAll('.gate'));
    if (reduced || !('IntersectionObserver' in window)) {
      gates.forEach((g) => g.classList.add('lit'));
    } else {
      const pipeIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            gates.forEach((g, i) => setTimeout(() => g.classList.add('lit'), 220 + i * 110));
            pipeIO.disconnect();
          }
        });
      }, { threshold: 0.4 });
      pipeIO.observe(pipeRow);
    }
  }

  /* ── 3. Donut highlight + sweep-fill ────────────────────────── */
  const tokeno = document.querySelector('.tokeno-vis');
  const tokenoWrap = document.querySelector('.tokeno-wrap');
  if (tokeno && tokenoWrap) {
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

    const segs = tokenoWrap.querySelectorAll('[data-seg]');
    const setHL = (key) => {
      segs.forEach((el) => el.classList.toggle('hl', el.dataset.seg === key));
      tokeno.classList.add('dim-others');
    };
    const clearHL = () => {
      segs.forEach((el) => el.classList.remove('hl'));
      tokeno.classList.remove('dim-others');
    };
    segs.forEach((el) => {
      el.addEventListener('mouseenter', () => setHL(el.dataset.seg));
      el.addEventListener('mouseleave', clearHL);
    });
  }

  /* ── 4. Drawer ──────────────────────────────────────────────── */
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const closeBtn = document.getElementById('drawerClose');
  const body = document.getElementById('drawerBody');
  const badge = document.getElementById('drawerBadge');
  const receptor = document.getElementById('drawerReceptor');

  // Sparkline grid lines: hairline rules at quartile y-positions, stroke-opacity
  // 0.1, matches descidash visual language. Drawn before the spark path so the
  // path overlays the grid.
  const sparkGrid = `
    <line x1="0" y1="14" x2="348" y2="14" stroke="#3ee07b" stroke-opacity="0.1" stroke-width="1"/>
    <line x1="0" y1="28" x2="348" y2="28" stroke="#3ee07b" stroke-opacity="0.1" stroke-width="1"/>
    <line x1="0" y1="42" x2="348" y2="42" stroke="#3ee07b" stroke-opacity="0.1" stroke-width="1"/>`;

  // Per-agent external link config. Wallet rows removed entirely (agent
  // wallet addresses not publicly disclosed). Molecule URL is only listed
  // when a public Molecule.xyz project exists for that program. Thread URL
  // is agent-specific: Agent-03 points to Paul Kohlhaas's OX2R-004 reveal
  // (more authoritative than the @peptai_ profile root); Agent-04 points
  // to the @peptai_ profile root because the receptor has not been
  // selected and no candidate thread exists yet.
  const drawerLinks = {
    '01': {
      molecule: null,
      thread: {
        url: 'https://x.com/peptai_/status/2048796641889776099?utm_source=descidash&utm_medium=project_page&utm_campaign=peptai&utm_content=agent_01',
        label: '// @peptai_ THREAD',
      },
    },
    '02': {
      molecule: 'https://molecule.xyz/projects/7079364503028251508578684509521557949079851428906896322195700714166025795915',
      thread: {
        url: 'https://x.com/peptai_/status/2050154132611514446?utm_source=descidash&utm_medium=project_page&utm_campaign=peptai&utm_content=agent_02',
        label: '// @peptai_ THREAD',
      },
    },
    '03': {
      thread: {
        url: 'https://x.com/paulkhls/status/2043824010744484016?utm_source=descidash&utm_medium=project_page&utm_campaign=peptai&utm_content=agent_03',
        label: '// PAUL OX2R-004 THREAD',
      },
    },
    '04': {
      molecule: null,
      thread: {
        url: 'https://x.com/peptai_?utm_source=descidash&utm_medium=project_page&utm_campaign=peptai&utm_content=agent_04',
        label: '// @peptai_ PROFILE',
      },
    },
  };

  const ox2rThread = drawerLinks['03'].thread;
  const ox2rContent = `
    <div class="drawer-section">
      <div class="h">// WHY THIS RECEPTOR</div>
      <p>Drug-naive ADHD patients show measurably lower <b>orexin-A/B</b> levels. <b>OX2R</b> drives arousal and attention. Every approved orexin drug is an <em>antagonist</em> for insomnia.</p>
      <p style="margin-top:10px;">PeptAI is building the <b>inverse</b>: a selective <em>agonist</em>, addressing the under-served wakefulness side of the orexin axis.</p>
    </div>

    <div class="drawer-section">
      <div class="h">// LIVE SCOREBOARD</div>
      <table class="scoreboard">
        <thead>
          <tr><th>CANDIDATE</th><th>STAGE</th><th>LAST DECISION</th><th>DATE</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="cand lead">OX2R-004</td>
            <td>G9 staging</td>
            <td>PRE-IND published<span class="tag-pip live">LIVE</span></td>
            <td>Apr 13</td>
          </tr>
          <!-- TODO: OX2R-001/-002/-003 stages pending source confirmation -->
          <tr class="tbd"><td class="cand">OX2R-003</td><td>[ TBD ]</td><td>[ TBD ]</td><td>[ TBD ]</td></tr>
          <tr class="tbd"><td class="cand">OX2R-002</td><td>[ TBD ]</td><td>[ TBD ]</td><td>[ TBD ]</td></tr>
          <tr class="tbd"><td class="cand">OX2R-001</td><td>[ TBD ]</td><td>[ TBD ]</td><td>[ TBD ]</td></tr>
        </tbody>
      </table>
    </div>

    <div class="drawer-section">
      <div class="h">// LEAD CANDIDATE</div>
      <div class="lead-card">
        <div class="l">
          <div class="id">OX2R-004</div>
          <div class="desc">// 18-RESIDUE SELECTIVE OX2R AGONIST · PRE-IND PUBLISHED</div>
        </div>
        <a href="/peptides/ox2r-004" class="btn-cta">VIEW FULL DEEP-DIVE →</a>
      </div>
    </div>

    <div class="drawer-section">
      <div class="h">// MENTION VELOCITY · OX2R-004 · 7d</div>
      <div class="spark-card">
        <div class="h-row">
          <div class="l">x mentions, 7-day rolling</div>
          <div class="v">+412%</div>
        </div>
        <svg viewBox="0 0 348 56" preserveAspectRatio="none">
          <defs>
            <linearGradient id="velg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3ee07b" stop-opacity="0.32"/>
              <stop offset="100%" stop-color="#3ee07b" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${sparkGrid}
          <path d="M 0,48 L 24,46 L 48,44 L 72,42 L 96,38 L 120,32 L 144,30 L 168,24 L 192,20 L 216,12 L 240,18 L 264,10 L 288,14 L 312,6 L 336,8 L 348,4 L 348,56 L 0,56 Z" fill="url(#velg)"/>
          <path d="M 0,48 L 24,46 L 48,44 L 72,42 L 96,38 L 120,32 L 144,30 L 168,24 L 192,20 L 216,12 L 240,18 L 264,10 L 288,14 L 312,6 L 336,8 L 348,4" fill="none" stroke="#3ee07b" stroke-width="1.5" stroke-linejoin="round"/>
          <g font-family="JetBrains Mono, monospace" font-size="7" fill="#56655e" letter-spacing="0.1em">
            <text x="0"   y="55">D-7</text>
            <text x="172" y="55">D-3</text>
            <text x="335" y="55">NOW</text>
          </g>
        </svg>
      </div>
    </div>

    <div class="drawer-section">
      <div class="h">// EXTERNAL LINKS</div>
      <div class="links-row">
        <a href="https://molecule.xyz/projects/88214997774048750483620597615402512868285098265515203121136501631773096632622"
           target="_blank" rel="noopener noreferrer"><span>// MOLECULE.XYZ / OX2R PHASE 1</span><span>↗</span></a>
        <a href="https://drive.google.com/file/d/1Kzi3OuwAwMy1vlKkcLLvxdd4YszMag41/view"
           target="_blank" rel="noopener noreferrer"><span>// PRE-IND PAPER PDF</span><span>↗</span></a>
        <a href="${ox2rThread.url}"
           target="_blank" rel="noopener noreferrer"><span>${ox2rThread.label}</span><span>↗</span></a>
      </div>
    </div>
  `;

  const tbdContent = (agent, receptorText) => {
    const cfg = drawerLinks[agent] || { molecule: null, thread: null };
    const moleculeBtn = cfg.molecule
      ? `<a href="${cfg.molecule}" target="_blank" rel="noopener noreferrer"><span>// MOLECULE.XYZ / ${agent === '02' ? 'KISS1R' : 'PROJECT'}</span><span>↗</span></a>`
      : '';
    const threadBtn = cfg.thread
      ? `<a href="${cfg.thread.url}" target="_blank" rel="noopener noreferrer"><span>${cfg.thread.label}</span><span>↗</span></a>`
      : '';
    return `
    <div class="drawer-section">
      <div class="h">// STATUS</div>
      <p>// AGENT-${agent} · ${receptorText}</p>
      <p style="margin-top:14px;color:var(--text-3);font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.08em;">
        DETAILED SCOREBOARD PENDING SOURCE CONFIRMATION. THIS DRAWER WILL POPULATE ONCE PEPTAI PUBLISHES PER-CANDIDATE GATE DATA FOR THIS AGENT.
      </p>
    </div>
    <div class="drawer-section">
      <div class="h">// EXTERNAL LINKS</div>
      <div class="links-row">
        ${moleculeBtn}
        ${threadBtn}
      </div>
    </div>
  `;
  };

  const meta = {
    '01': { receptor: 'GLP-1R',  area: 'Proof-of-pipeline validation' },
    '02': { receptor: 'KISS1R',  area: 'Reproductive hormone axis · Fertility' },
    '03': { receptor: 'OX2R',    area: 'Sleep · Narcolepsy · ADHD' },
    '04': { receptor: '[ TBD ]', area: 'Community-selected receptor' },
  };

  const open = (agent) => {
    if (!drawer || !overlay || !body || !badge || !receptor) return;
    const m = meta[agent] || meta['03'];
    badge.textContent = 'AGENT-' + agent;
    receptor.textContent = m.receptor;
    body.innerHTML = (agent === '03') ? ox2rContent : tbdContent(agent, m.area);
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    if (!drawer || !overlay) return;
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.querySelectorAll('.program-banner.is-active').forEach((b) => b.classList.remove('is-active'));
  };

  document.querySelectorAll('.program-banner').forEach((b) => {
    if (b.classList.contains('is-disabled')) return;
    b.addEventListener('click', () => {
      document.querySelectorAll('.program-banner.is-active').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      open(b.dataset.agent);
    });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); }
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (overlay) overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  /* ── 5. Gutter ──────────────────────────────────────────────── */
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

  /* ── 6. Copy buttons ────────────────────────────────────────── */
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
        console.warn('[peptai] clipboard write failed:', err);
      }
    });
  });

  /* ── 7. Live ticker hydration (best-effort, falls back gracefully) ─── */
  // /api/prices returns 404 in local dev (Cloudflare Functions only run in
  // production). The static placeholders in the hero ticker remain visible
  // and accurate. Ignition fixed-price token, no live price discovery yet.
  // Once the Base contract is live and added to GT_TOKENS, this hook will
  // start populating the FDV/24h/VOL slots.
  const ticker = document.querySelector('.hero-ticker-row');
  if (ticker) {
    fetch('/api/prices', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        const t = (json.tokens || []).find((x) => x.id === 'peptai');
        if (!t || t.price == null) return;
        // Future patch: write t.price into a live price slot if/when added.
      })
      .catch(() => { /* silent in dev */ });
  }
})();
