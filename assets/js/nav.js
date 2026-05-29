/* Header nav behaviour, shared by every page so the nav works identically site-wide.
   - Desktop: primary links sit inline in the pill; secondary and external links
     live behind the "More" disclosure (click, outside-click, Escape to close).
   - Mobile (<=720px, via CSS): the whole nav collapses under one burger button.
     This script clones the primary links into the top of the menu (with their
     labels) and adds the burger glyph, so on a phone every section is one tap
     away with a readable name instead of a bare icon. Progressive enhancement:
     without JS the CSS falls back to the icon-only pill. */
(function () {
  var btn = document.querySelector('.header-nav-more-btn');
  var menu = document.getElementById('nav-more-menu');
  if (!btn || !menu) return;

  document.documentElement.classList.add('nav-js-ready');

  // Build the mobile menu: clone the primary links to the top of the menu, then
  // a separator, then drop a burger glyph into the More button.
  var nav = btn.closest('.header-nav');
  if (nav) {
    var primary = nav.querySelectorAll(':scope > a.header-nav-link');
    var frag = document.createDocumentFragment();
    for (var i = 0; i < primary.length; i++) {
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

  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
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
})();
