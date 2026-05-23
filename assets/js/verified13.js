// The Verified 13: DeSci Sector Comparison.
//
// Single source of truth: /data/verified13.yaml. Nothing on this page is
// hardcoded; every project value, source, and date is read from that file at
// runtime. A reviewer changes any number on the page by editing only the YAML.
//
// The site has no build step, so the YAML is fetched and parsed in the browser
// by the small block-parser below (no framework, no dependency). The parser
// covers the subset this file uses: 2-space-indented block maps, block
// sequences (scalar items and "- key: value" mapping items), scalars, the
// tilde (~) null marker, and true/false booleans.

(function () {
  'use strict';

  // ─── Minimal block-YAML parser ────────────────────────────────────────────
  function parseYAML(text) {
    const rows = text.replace(/\r\n/g, '\n').replace(/\t/g, '  ').split('\n');
    const lines = [];
    for (const raw of rows) {
      if (/^\s*#/.test(raw)) continue; // full-line comment
      if (/^\s*$/.test(raw)) continue; // blank line
      const body = raw.replace(/^ +/, '');
      lines.push({ indent: raw.length - body.length, text: body });
    }
    let i = 0;

    function scalar(s) {
      s = s.trim();
      if (s === '' || s === '~' || s === 'null') return null;
      if (s === 'true') return true;
      if (s === 'false') return false;
      const q = s[0];
      if ((q === '"' || q === "'") && s[s.length - 1] === q) return s.slice(1, -1);
      return s;
    }
    function parseMap(indent) {
      const obj = {};
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.indent !== indent || ln.text.startsWith('- ')) break;
        const ci = ln.text.indexOf(':');
        if (ci === -1) { i++; continue; }
        const key = ln.text.slice(0, ci).trim();
        const rest = ln.text.slice(ci + 1).trim();
        if (rest === '') {
          i++;
          obj[key] = (i < lines.length && lines[i].indent > indent)
            ? parseNode(lines[i].indent) : null;
        } else {
          obj[key] = scalar(rest);
          i++;
        }
      }
      return obj;
    }
    function parseSeq(indent) {
      const arr = [];
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.indent !== indent || !ln.text.startsWith('- ')) break;
        const after = ln.text.slice(2);
        if (after.indexOf(':') !== -1) {
          // mapping item: re-seat the first key one level in, then parse a map
          lines[i] = { indent: indent + 2, text: after };
          arr.push(parseMap(indent + 2));
        } else {
          arr.push(scalar(after));
          i++;
        }
      }
      return arr;
    }
    function parseNode(indent) {
      if (i >= lines.length) return null;
      return lines[i].text.startsWith('- ') ? parseSeq(indent) : parseMap(indent);
    }
    return lines.length ? parseNode(lines[0].indent) : {};
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const NO_DATA = 'no verified data';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Transparency is the one quality axis. Colour is driven by the tier field.
  const TIER_CLASS = {
    'failures': 'pill-green',
    'peer-reviewed': 'pill-blue',
    'on-chain': 'pill-blue',
    'pr-only': 'pill-amber',
  };
  // Best (strongest signal) first for the transparency sort.
  const TIER_RANK = { 'failures': 0, 'peer-reviewed': 1, 'on-chain': 2, 'pr-only': 3 };

  const TYPE_LABEL = { agent: 'Agents', dao: 'DAOs', platform: 'Platforms', infrastructure: 'Infrastructure' };
  const TYPE_ORDER = ['agent', 'dao', 'platform', 'infrastructure'];

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  // Parse a treasury figure into a number for sorting. Non-numeric figures
  // (fee-burn, frozen, blank) return null and sort last.
  function treasuryValue(figure) {
    if (figure == null) return null;
    const m = String(figure).match(/([\d,]+(?:\.\d+)?)\s*([kmb])?/i);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(n)) return null;
    const u = (m[2] || '').toLowerCase();
    if (u === 'k') n *= 1e3; else if (u === 'm') n *= 1e6; else if (u === 'b') n *= 1e9;
    return n;
  }

  // Parse "May 2026" / "2026" / "Nov 2024" into a sortable YYYYMM integer.
  function verifiedValue(s) {
    if (s == null) return null;
    const str = String(s).toLowerCase();
    const ym = str.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/);
    if (ym) return parseInt(ym[2], 10) * 100 + MONTHS[ym[1]];
    const y = str.match(/(\d{4})/);
    if (y) return parseInt(y[1], 10) * 100;
    return null;
  }

  function emptySpan() { return '<span class="empty">' + NO_DATA + '</span>'; }
  function textOrEmpty(v) { return v == null ? emptySpan() : esc(v); }

  const RISK_SVG =
    '<svg width="14" height="13" viewBox="0 0 16 14" fill="none" aria-hidden="true">' +
    '<path d="M8 1.5 L14.5 13 L1.5 13 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>' +
    '<line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    '<circle cx="8" cy="11" r="0.8" fill="currentColor"/></svg>';

  // ─── Row markup ──────────────────────────────────────────────────────────────
  function transparencyPill(t) {
    if (!t || t.value == null) return emptySpan();
    const cls = TIER_CLASS[t.tier] || 'pill-neutral';
    return '<span class="pill ' + cls + '">' + esc(t.value) + '</span>';
  }
  function ipPill(ip) {
    if (!ip || ip.value == null) return emptySpan();
    return '<span class="pill pill-neutral">' + esc(ip.value) + '</span>';
  }
  function treasuryCell(tr) {
    if (!tr) return emptySpan();
    const figure = tr.figure;
    const frozen = figure != null && String(figure).trim().toLowerCase() === 'frozen';
    let html = '';
    html += figure == null
      ? emptySpan()
      : '<span class="tr-figure mono' + (frozen ? ' frozen' : '') + '">' + esc(figure) + '</span>';
    if (tr.type != null) html += '<span class="tr-type">' + esc(tr.type) + '</span>';
    if (tr.stale) {
      html += '<span class="tr-stale">stale' + (tr.date != null ? ', ' + esc(tr.date) : '') + '</span>';
    }
    return html;
  }
  function sourceRow(label, block) {
    const src = block ? block.source : null;
    const date = block ? block.date : null;
    return '<div class="source-row">' +
      '<span class="source-metric">' + esc(label) + '</span>' +
      '<span class="source-citation">' + textOrEmpty(src) + '</span>' +
      '<span class="source-date' + (date == null ? ' empty' : '') + '">' +
      (date == null ? NO_DATA : esc(date)) + '</span>' +
      '</div>';
  }

  function rowHTML(p) {
    const tRank = TIER_RANK[p.transparency && p.transparency.tier];
    const trVal = treasuryValue(p.treasury && p.treasury.figure);
    const vVal = verifiedValue(p.last_verified);

    // Project cell
    let projName = '<span class="proj-name">' + esc(p.name) + '</span>';
    if (p.ticker != null) projName += '<span class="proj-ticker mono">' + esc(p.ticker) + '</span>';
    const riskMark = p.risk_flag
      ? '<div class="risk-warn" title="' + esc(p.risk_note || 'Documented incident') + '">' + RISK_SVG + '</div>'
      : '';

    // Detail: cost to result
    const cost = p.cost_to_result || {};
    const costBody = cost.value == null ? emptySpan() : esc(cost.value);

    // Detail: stack chips
    const stack = Array.isArray(p.stack) ? p.stack.filter(x => x != null) : [];
    const stackHTML = stack.length
      ? '<ul class="stack-list">' + stack.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>'
      : emptySpan();

    // Detail: risk note block (flagged projects)
    const riskBlock = (p.risk_flag && p.risk_note != null)
      ? '<div class="risk-block">' + RISK_SVG +
        '<div class="risk-text"><b>Risk flag</b>' + esc(p.risk_note) + '</div></div>'
      : '';

    // Detail: sources, one line per metric
    const sources =
      sourceRow('Transparency', p.transparency) +
      sourceRow('IP model', p.ip_model) +
      sourceRow('Treasury', p.treasury) +
      sourceRow('Cost to result', p.cost_to_result);

    // Verified stamp
    const stale = !!p.last_verified_stale;
    const stamp = '<span class="verified-stamp ' + (stale ? 'stale' : 'fresh') + '"><span class="dot"></span>' +
      (stale ? 'Stale, last verified ' : 'Last verified ') + (p.last_verified != null ? esc(p.last_verified) : NO_DATA) +
      '</span>';

    // Desktop row uses the existing 5-column grid of cells.
    const desktopBlock =
      '<div class="row-main row-grid d-row">' +
        '<div class="cell cell-project">' +
          riskMark +
          '<div class="proj-info">' +
            '<div class="proj-name-row">' + projName + '</div>' +
            '<div class="proj-category">' + textOrEmpty(p.category) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cell">' + transparencyPill(p.transparency) + '</div>' +
        '<div class="cell">' + ipPill(p.ip_model) + '</div>' +
        '<div class="cell cell-treasury">' + treasuryCell(p.treasury) + '</div>' +
        '<div class="cell-chev" aria-hidden="true"><span class="chev">›</span></div>' +
      '</div>';

    // Mobile card: explicit DOM matching the verified-13-mobile-tweaks
    // design spec (left-aligned, indexed 01-N in left gutter, left-border
    // accent, label-then-value metric rows, footnote for treasury type,
    // chevron at the head's right edge). The index span is filled by JS
    // (updateMobileIndices) after sort/filter so it reflects render order.
    const tr = p.treasury || {};
    const trFigure = (tr.figure != null && String(tr.figure).trim() !== '')
      ? '<span class="tr-figure mono' +
          (String(tr.figure).trim().toLowerCase() === 'frozen' ? ' frozen' : '') +
        '">' + esc(tr.figure) + '</span>'
      : emptySpan();
    const trStale = tr.stale
      ? '<span class="tr-stale">stale' + (tr.date != null ? ', ' + esc(tr.date) : '') + '</span>'
      : '';
    const trFootnote = tr.type != null
      ? '<div class="m-footnote">' + esc(tr.type) + '</div>'
      : '';

    const mobileBlock =
      '<div class="row-main m-card">' +
        '<span class="m-index mono" aria-hidden="true"></span>' +
        '<div class="m-head">' +
          riskMark +
          '<span class="proj-name">' + esc(p.name) + '</span>' +
          (p.ticker != null
            ? '<span class="proj-ticker mono">' + esc(p.ticker) + '</span>'
            : '') +
          '<span class="chev m-chev" aria-hidden="true">›</span>' +
        '</div>' +
        '<div class="m-desc">' + textOrEmpty(p.category) + '</div>' +
        '<div class="m-row">' +
          '<span class="m-label">Transparency</span>' +
          transparencyPill(p.transparency) +
        '</div>' +
        '<div class="m-row">' +
          '<span class="m-label">IP model</span>' +
          ipPill(p.ip_model) +
        '</div>' +
        '<div class="m-row m-row-tr">' +
          '<span class="m-label">Treasury</span>' +
          trFigure +
          trStale +
        '</div>' +
        trFootnote +
      '</div>';

    return '' +
      '<div class="row" data-cat="' + esc(p.type || '') + '" data-flagged="' + (p.risk_flag ? '1' : '0') + '"' +
      ' data-name="' + esc(p.name) + '"' +
      ' data-transparency-rank="' + (tRank == null ? 9 : tRank) + '"' +
      ' data-ip-key="' + esc(((p.ip_model && p.ip_model.value) || '').toLowerCase()) + '"' +
      ' data-treasury-rank="' + (trVal == null ? '' : trVal) + '"' +
      ' data-verified-rank="' + (vVal == null ? '' : vVal) + '">' +

      desktopBlock +
      mobileBlock +

      '<div class="row-detail">' +
        riskBlock +
        '<div class="detail-grid">' +
          '<div class="detail-block">' +
            '<div class="detail-label">Cost to result</div>' +
            '<div class="detail-body">' + costBody + '</div>' +
          '</div>' +
          '<div class="detail-block">' +
            '<div class="detail-label">Stack</div>' + stackHTML +
          '</div>' +
        '</div>' +
        '<div class="sources">' + sources + '</div>' +
        stamp +
      '</div>' +
    '</div>';
  }

  // ─── Sort + filter state ─────────────────────────────────────────────────────
  let activeSort = 'transparency';
  let activeFilter = 'all';
  let rowEls = [];
  let body, stateEl, sortSelect, sortBtns, chipWrap;
  let scrollFocus = null;

  // ─── Scroll-focus: on mobile, the m-card whose vertical center sits
  // closest to the viewport center gets the .is-focused class. Pure JS,
  // no IntersectionObserver. rAF-throttled, matchMedia-gated. The CSS
  // turns that class into a rotating conic-gradient border. */
  function makeScrollFocus() {
    const mq = window.matchMedia('(max-width: 820px)');
    let raf = null, attached = false;

    function update() {
      if (!mq.matches) return;
      const cards = document.querySelectorAll('.m-card');
      if (!cards.length) return;
      const viewCenter = window.innerHeight / 2;
      let best = null, bestDist = Infinity;
      cards.forEach(c => {
        const row = c.closest('.row');
        if (row && row.style.display === 'none') return;
        const r = c.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // ignore cards that are entirely above or below the viewport
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const cc = (r.top + r.bottom) / 2;
        const d = Math.abs(cc - viewCenter);
        if (d < bestDist) { bestDist = d; best = c; }
      });
      cards.forEach(c => c.classList.toggle('is-focused', c === best));
    }
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; update(); });
    }
    function attach() {
      if (attached) return;
      attached = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      update();
    }
    function detach() {
      if (!attached) return;
      attached = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.querySelectorAll('.m-card.is-focused')
        .forEach(c => c.classList.remove('is-focused'));
    }
    if (mq.matches) attach();
    const onMq = e => { e.matches ? attach() : detach(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq); // older Safari

    return { update };
  }

  function numDesc(x, y) {
    const ax = x === '' ? null : +x, ay = y === '' ? null : +y;
    if (ax === null && ay === null) return 0;
    if (ax === null) return 1;
    if (ay === null) return -1;
    return ay - ax;
  }
  function compareRows(a, b) {
    const da = a.dataset, db = b.dataset;
    switch (activeSort) {
      case 'name': return da.name.localeCompare(db.name);
      case 'ip': return da.ipKey.localeCompare(db.ipKey) || da.name.localeCompare(db.name);
      case 'treasury': return numDesc(da.treasuryRank, db.treasuryRank) || da.name.localeCompare(db.name);
      case 'verified': return numDesc(da.verifiedRank, db.verifiedRank) || da.name.localeCompare(db.name);
      case 'transparency':
      default:
        return (+da.transparencyRank - +db.transparencyRank) || da.name.localeCompare(db.name);
    }
  }
  function applyView() {
    // Sort first, then re-append in sorted order so the DOM matches what
    // the reader will see. Apply the filter, then assign mobile indices
    // 01, 02, ... walking the rows in DOM order (post-sort).
    const sorted = rowEls.slice().sort(compareRows);
    sorted.forEach(r => body.appendChild(r));
    let visible = 0;
    let mIdx = 0;
    sorted.forEach(r => {
      let show = true;
      if (activeFilter === 'flagged') show = r.dataset.flagged === '1';
      else if (activeFilter !== 'all') show = r.dataset.cat === activeFilter;
      r.style.display = show ? '' : 'none';
      if (show) {
        visible++;
        const ix = r.querySelector('.m-index');
        if (ix) ix.textContent = String(++mIdx).padStart(2, '0');
      }
    });
    if (stateEl) {
      stateEl.style.display = visible === 0 ? 'block' : 'none';
      body.appendChild(stateEl); // keep the empty-state message at the end
    }
    // Scroll-focus may need to re-pick the centered card after a re-layout.
    if (scrollFocus && scrollFocus.update) scrollFocus.update();
  }
  function setSort(key) {
    activeSort = key;
    if (sortSelect && [].some.call(sortSelect.options, o => o.value === key)) sortSelect.value = key;
    sortBtns.forEach(b => b.dataset.active = (b.dataset.sort === key) ? 'true' : 'false');
    applyView();
  }
  function setFilter(key) {
    activeFilter = key;
    chipWrap.querySelectorAll('.chip').forEach(c =>
      c.setAttribute('aria-pressed', c.dataset.filter === key ? 'true' : 'false'));
    applyView();
  }

  // ─── Render: header, legend, chips, footer ───────────────────────────────────
  function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

  function renderChips(projects) {
    const counts = {};
    let flagged = 0;
    projects.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; if (p.risk_flag) flagged++; });
    const parts = ['<span class="control-label">Filter</span>'];
    parts.push('<button class="chip" type="button" data-filter="all" aria-pressed="true">All <span class="count">' + projects.length + '</span></button>');
    TYPE_ORDER.forEach(t => {
      if (counts[t]) parts.push('<button class="chip" type="button" data-filter="' + t + '" aria-pressed="false">' +
        TYPE_LABEL[t] + ' <span class="count">' + counts[t] + '</span></button>');
    });
    if (flagged) parts.push('<button class="chip" type="button" data-filter="flagged" aria-pressed="false">Flagged <span class="count">' + flagged + '</span></button>');
    chipWrap.innerHTML = parts.join('');
    chipWrap.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => setFilter(c.dataset.filter)));
  }

  function renderHeldBack(hb) {
    const wrap = document.getElementById('heldBack');
    if (!wrap || !hb) return;
    const items = Array.isArray(hb.projects) ? hb.projects : [];
    const cards = items.map(it =>
      '<div class="held-back-item">' +
        '<span class="held-back-name">' + esc(it.name) + '</span>' +
        '<span class="held-back-reason">' + textOrEmpty(it.gap) + '</span>' +
      '</div>').join('');
    wrap.innerHTML =
      '<h2>' + items.length + ' projects held back</h2>' +
      '<p class="footer-intro">' + textOrEmpty(hb.note) + '</p>' +
      '<div class="held-back-list">' + cards + '</div>';
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function render(doc) {
    const meta = doc.meta || {};
    const projects = Array.isArray(doc.projects) ? doc.projects : [];

    setText('v13-marker', '// ' + (meta.marker || 'verified sector map'));
    setText('v13-title', meta.page_title || 'The Verified 13');
    setText('v13-intro', meta.intro || '');
    setText('v13-legend', meta.legend || '');
    if (meta.methodology) setText('v13-meta', '// ' + meta.methodology);
    if (meta.last_full_sweep) {
      setText('v13-sweep', 'last full sweep ' + meta.last_full_sweep);
    }

    chipWrap = document.getElementById('filterChips');
    renderChips(projects);

    body.innerHTML = projects.map(rowHTML).join('');
    rowEls = Array.prototype.slice.call(body.querySelectorAll('.row'));

    // empty-filter state lives inside the body, after the rows
    stateEl = document.createElement('div');
    stateEl.className = 'table-state';
    stateEl.style.display = 'none';
    stateEl.innerHTML = 'No projects match this filter.<span class="mono">// clear the filter to see all ' + projects.length + '</span>';
    body.appendChild(stateEl);

    // expand / collapse on row click (ignore clicks on links)
    body.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const row = e.target.closest('.row');
      if (!row || row === stateEl) return;
      row.dataset.expanded = row.dataset.expanded === 'true' ? 'false' : 'true';
    });

    sortSelect = document.getElementById('sortSelect');
    sortBtns = Array.prototype.slice.call(document.querySelectorAll('.thead .sortable'));
    if (sortSelect) sortSelect.addEventListener('change', e => setSort(e.target.value));
    sortBtns.forEach(b => b.addEventListener('click', () => setSort(b.dataset.sort)));

    renderHeldBack(doc.held_back);
    setSort('transparency');

    // Mount the scroll-focus driver once rows exist. It self-detaches on
    // viewports above the mobile breakpoint, so desktop pays no cost.
    scrollFocus = makeScrollFocus();
  }

  function showError(msg) {
    if (body) body.innerHTML = '<div class="table-state error">' + esc(msg) +
      '<span class="mono">// could not load /data/verified13.yaml</span></div>';
  }

  function init() {
    body = document.getElementById('rowBody');
    fetch('/data/verified13.yaml', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(text => {
        let doc;
        try { doc = parseYAML(text); }
        catch (e) { showError('The verified data file could not be parsed.'); return; }
        render(doc);
      })
      .catch(() => showError('The verified data file could not be loaded.'));
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // Exposed for a Node-based parser self-test; harmless in the browser.
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseYAML, treasuryValue, verifiedValue };
})();
