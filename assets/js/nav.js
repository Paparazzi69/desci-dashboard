/* Header "More" overflow menu: disclosure toggle (click, outside-click, Escape).
   Loaded by every page so the nav behaves identically site-wide. */
(function () {
  var btn = document.querySelector('.header-nav-more-btn');
  var menu = document.getElementById('nav-more-menu');
  if (!btn || !menu) return;
  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  });
})();
