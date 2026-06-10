/* Header nav behaviour, shared by every page so the nav works identically site-wide.
   - Desktop: primary links sit inline in the pill; secondary and external links
     live behind the "More" disclosure (click, outside-click, Escape to close).
   - Mobile (<=880px, via CSS): the whole nav collapses under one burger button.
     This script clones the primary links into the top of the menu (with their
     labels) and adds the burger glyph, so on a phone every section is one tap
     away with a readable name instead of a bare icon. Progressive enhancement:
     without JS the CSS falls back to the icon-only pill.
   - The More menu items get one-line descriptions and the Heat row a live
     top-mover badge (from /api/prices, fetched once on first open). Injected
     here, not in the per-page markup, so the HTML stays untouched.
   - Search palette: "/" or Ctrl+K (or the magnifier button injected into the
     pill / the Search item in the mobile menu) opens a search over site pages
     and Token Index tokens with live 24h change. A token hit opens the drawer
     in place on the homepage (window.openTokenDrawer, exposed by app.js) or
     navigates to /?token=<id> from any other page. */
(function () {
  var btn = document.querySelector('.header-nav-more-btn');
  var menu = document.getElementById('nav-more-menu');
  if (!btn || !menu) return;

  document.documentElement.classList.add('nav-js-ready');

  // ── Shared lazy /api/prices fetch (menu badge + palette tokens) ──
  // Fetched at most once per page view, and only when the menu or the palette
  // is actually opened — never on plain page load.
  var pricesPromise = null;
  function getPrices() {
    if (!pricesPromise) {
      pricesPromise = fetch('/api/prices')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) {
          return json && Array.isArray(json.tokens) ? json.tokens : null;
        })
        .catch(function () { return null; });
    }
    return pricesPromise;
  }

  function fmtPct(v) {
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Build the mobile menu: clone the primary links to the top of the menu, then
  // a separator, then drop a burger glyph into the More button.
  var nav = btn.closest('.header-nav');
  if (nav) {
    var primary = nav.querySelectorAll(':scope > a.header-nav-link');
    var frag = document.createDocumentFragment();
    for (var i = 0; i < primary.length; i++) {
      // Tooltip for the 881-1279px band, where primary links are icon-only.
      if (primary[i].getAttribute('aria-label')) {
        primary[i].title = primary[i].getAttribute('aria-label');
      }
      var clone = primary[i].cloneNode(true);
      clone.className = 'header-nav-menu-item header-nav-menu-item--mobile';
      clone.setAttribute('role', 'menuitem');
      frag.appendChild(clone);
    }
    var sep = document.createElement('div');
    sep.className = 'header-nav-menu-sep header-nav-menu-item--mobile';
    sep.setAttribute('role', 'separator');
    frag.appendChild(sep);
    menu.insertBefore(frag, menu.firstChild);
    btn.insertAdjacentHTML('afterbegin',
      '<svg class="header-nav-burger" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>');
  }

  // ── More menu: one-line description under each item ──
  // Matched by href prefix so the per-page markup stays a flat icon+label list.
  var MENU_DESCS = [
    ['/heat', '24h and 7d sector movers'],
    ['/papers', 'Live peer-reviewed papers'],
    ['/methodology', 'How claims get verified'],
    ['https://x.com', '@DeSciDashboard on X'],
    ['https://kickstart.easya.io', '$DAH launchpad listing'],
  ];
  var menuLinks = menu.querySelectorAll('a.header-nav-menu-item');
  for (var m = 0; m < menuLinks.length; m++) {
    var item = menuLinks[m];
    if (item.className.indexOf('--mobile') !== -1) continue;
    var href = item.getAttribute('href') || '';
    var descText = null;
    for (var d = 0; d < MENU_DESCS.length; d++) {
      if (href.indexOf(MENU_DESCS[d][0]) === 0) { descText = MENU_DESCS[d][1]; break; }
    }
    var label = item.querySelector('span:not(.header-nav-arrow)');
    if (!descText || !label) continue;
    var text = document.createElement('span');
    text.className = 'header-nav-menu-text';
    var title = document.createElement('span');
    title.className = 'header-nav-menu-title';
    title.textContent = label.textContent;
    var desc = document.createElement('span');
    desc.className = 'header-nav-menu-desc';
    desc.textContent = descText;
    text.appendChild(title);
    text.appendChild(desc);
    item.replaceChild(text, label);
  }

  // ── Live top-mover badge on the Heat row, filled on first menu open ──
  var heatBadgeDone = false;
  function fillHeatBadge() {
    if (heatBadgeDone) return;
    heatBadgeDone = true;
    var heat = menu.querySelector('a.header-nav-menu-item:not(.header-nav-menu-item--mobile)[href="/heat"]');
    if (!heat) return;
    getPrices().then(function (tokens) {
      if (!tokens) return;
      var top = null;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (typeof t.d1 !== 'number') continue;
        if (!top || Math.abs(t.d1) > Math.abs(top.d1)) top = t;
      }
      if (!top) return;
      var badge = document.createElement('span');
      badge.className = 'header-nav-menu-live';
      badge.dataset.dir = top.d1 >= 0 ? 'up' : 'down';
      badge.textContent = (top.d1 >= 0 ? '▲ ' : '▼ ')
        + String(top.symbol || '').toUpperCase() + ' ' + fmtPct(top.d1);
      heat.appendChild(badge);
    });
  }

  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) fillHeatBadge();
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  // Close once a destination is chosen (matters on mobile, where the menu holds
  // every section).
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  });

  // ── Search palette ──
  var PAGES = [
    { title: 'Dashboard', desc: 'Token Index, bubble map, sector stats', href: '/' },
    { title: 'BioAgent Tracker', desc: 'Agents, compounds, platforms', href: '/bioagent-tracker' },
    { title: 'Verified List', desc: 'Source-backed sector comparison', href: '/verified-list' },
    { title: 'Projects', desc: 'Deep-dive index', href: '/projects/' },
    { title: '$DAH', desc: 'DeSci Analytics Hub token', href: '/dah' },
    { title: 'Heat', desc: '24h and 7d sector movers', href: '/heat' },
    { title: 'Research', desc: 'Live peer-reviewed papers', href: '/papers' },
    { title: 'Methodology', desc: 'How claims get verified', href: '/methodology' },
    { title: 'SpineDAO', desc: 'Deep dive', href: '/projects/spinedao/' },
    { title: 'PeptAI', desc: 'Deep dive', href: '/projects/peptai/' },
    { title: 'AUBRAI', desc: 'Deep dive', href: '/projects/aubrai/' },
    { title: 'Science Beach', desc: 'Deep dive', href: '/projects/science-beach/' },
    { title: 'OX2R-004', desc: 'Molecule deep dive', href: '/peptides/ox2r-004/' },
  ];

  var pal = null, palInput = null, palResults = null;
  var palItems = [], palSel = 0, palTokens = null;

  function buildPalette() {
    if (pal) return;
    pal = document.createElement('div');
    pal.className = 'palette-backdrop';
    pal.hidden = true;
    pal.innerHTML =
      '<div class="palette" role="dialog" aria-modal="true" aria-label="Search">' +
        '<div class="palette-input-row">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
          '<input class="palette-input" type="text" placeholder="Search pages and tokens…" autocomplete="off" spellcheck="false" aria-label="Search pages and tokens">' +
          '<span class="palette-esc" aria-hidden="true">ESC</span>' +
        '</div>' +
        '<div class="palette-results" role="listbox"></div>' +
      '</div>';
    document.body.appendChild(pal);
    palInput = pal.querySelector('.palette-input');
    palResults = pal.querySelector('.palette-results');
    palInput.addEventListener('input', renderResults);
    pal.addEventListener('keydown', onPaletteKey);
    pal.addEventListener('mousedown', function (e) {
      if (e.target === pal) closePalette();
    });
    palResults.addEventListener('click', function (e) {
      var el = e.target.closest('.palette-item');
      if (el) go(palItems[+el.dataset.idx]);
    });
    palResults.addEventListener('mousemove', function (e) {
      var el = e.target.closest('.palette-item');
      if (el && +el.dataset.idx !== palSel) { palSel = +el.dataset.idx; paintSel(); }
    });
  }

  function openPalette() {
    buildPalette();
    setOpen(false);
    pal.hidden = false;
    palInput.value = '';
    renderResults();
    palInput.focus();
    if (!palTokens) {
      getPrices().then(function (tokens) {
        palTokens = tokens || [];
        if (!pal.hidden) renderResults();
      });
    }
  }

  function closePalette() {
    pal.hidden = true;
  }

  function renderResults() {
    var q = palInput.value.trim().toLowerCase();
    palItems = [];
    var html = '';

    var pages = [];
    for (var i = 0; i < PAGES.length; i++) {
      if (!q || PAGES[i].title.toLowerCase().indexOf(q) !== -1) pages.push(PAGES[i]);
    }

    var tokens = [];
    if (palTokens) {
      if (q) {
        for (i = 0; i < palTokens.length; i++) {
          var t = palTokens[i];
          var sym = String(t.symbol || '').toLowerCase();
          var nm = String(t.name || '').toLowerCase();
          if (sym.indexOf(q) !== -1 || nm.indexOf(q) !== -1) tokens.push(t);
        }
        tokens.sort(function (a, b) { return matchRank(a, q) - matchRank(b, q); });
        tokens = tokens.slice(0, 8);
      } else {
        // Empty query: show the day's biggest movers as the default token set.
        tokens = palTokens
          .filter(function (tk) { return typeof tk.d1 === 'number'; })
          .sort(function (a, b) { return Math.abs(b.d1) - Math.abs(a.d1); })
          .slice(0, 5);
      }
    }

    if (pages.length) {
      html += '<div class="palette-group">Pages</div>';
      for (i = 0; i < pages.length; i++) {
        palItems.push({ type: 'page', href: pages[i].href });
        html += '<div class="palette-item" role="option" data-idx="' + (palItems.length - 1) + '">'
          + '<span class="palette-title">' + esc(pages[i].title) + '</span>'
          + '<span class="palette-desc">' + esc(pages[i].desc) + '</span>'
          + '</div>';
      }
    }
    if (tokens.length) {
      html += '<div class="palette-group">' + (q ? 'Tokens' : 'Top movers 24h') + '</div>';
      for (i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        palItems.push({ type: 'token', id: tok.id });
        var d1 = typeof tok.d1 === 'number'
          ? '<span class="palette-d1" data-dir="' + (tok.d1 >= 0 ? 'up' : 'down') + '">' + fmtPct(tok.d1) + '</span>'
          : '';
        html += '<div class="palette-item" role="option" data-idx="' + (palItems.length - 1) + '">'
          + '<span class="palette-sym">' + esc(String(tok.symbol || '').toUpperCase()) + '</span>'
          + '<span class="palette-name">' + esc(tok.name || '') + '</span>'
          + d1
          + '</div>';
      }
    }
    if (!html) {
      html = '<div class="palette-empty">' + (palTokens === null ? 'Loading tokens…' : 'No matches') + '</div>';
    }
    palResults.innerHTML = html;
    palSel = 0;
    paintSel();
  }

  // Lower = better: symbol prefix match beats name prefix beats substring.
  function matchRank(t, q) {
    var sym = String(t.symbol || '').toLowerCase();
    var nm = String(t.name || '').toLowerCase();
    if (sym.indexOf(q) === 0) return 0;
    if (nm.indexOf(q) === 0) return 1;
    return 2;
  }

  function paintSel() {
    var els = palResults.querySelectorAll('.palette-item');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('is-sel', +els[i].dataset.idx === palSel);
    }
    var sel = palResults.querySelector('.palette-item.is-sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }

  function onPaletteKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePalette();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!palItems.length) return;
      palSel = (palSel + (e.key === 'ArrowDown' ? 1 : palItems.length - 1)) % palItems.length;
      paintSel();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      go(palItems[palSel]);
    }
  }

  function go(item) {
    if (!item) return;
    closePalette();
    if (item.type === 'page') {
      location.href = item.href;
    } else if (typeof window.openTokenDrawer === 'function') {
      // Homepage: open the drawer in place instead of reloading.
      window.openTokenDrawer(item.id);
    } else {
      location.href = '/?token=' + encodeURIComponent(item.id);
    }
  }

  // Magnifier button in the pill (desktop and mobile) + a Search item at the
  // top of the mobile menu. Both injected so the per-page markup stays as-is;
  // no JS means no search affordance, matching the rest of the enhancement.
  var searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'header-nav-link header-nav-search-btn';
  searchBtn.setAttribute('aria-label', 'Search (press /)');
  searchBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
    '<span class="header-nav-kbd" aria-hidden="true">/</span>';
  searchBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    openPalette();
  });
  btn.parentNode.insertBefore(searchBtn, btn);

  var searchItem = document.createElement('button');
  searchItem.type = 'button';
  searchItem.className = 'header-nav-menu-item header-nav-menu-item--mobile';
  searchItem.setAttribute('role', 'menuitem');
  searchItem.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
    '<span>Search</span>';
  searchItem.addEventListener('click', function () {
    openPalette();
  });
  menu.insertBefore(searchItem, menu.firstChild);

  // Global shortcuts: "/" (outside form fields) and Ctrl/Cmd+K toggle.
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    var typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      || el.tagName === 'SELECT' || el.isContentEditable);
    var slash = e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey;
    var ctrlK = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey
      && (e.key === 'k' || e.key === 'K');
    if (!slash && !ctrlK) return;
    e.preventDefault();
    if (pal && !pal.hidden) closePalette();
    else openPalette();
  });
})();
