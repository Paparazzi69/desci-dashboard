// /projects landing — interaction triggers for the navigation hub.
//
// Motion assignments (paired with projects-index.css):
//   M/02 hero italic mask     · CSS keyframe on load (no JS)
//   M/04 card stagger fade-up · this file (IntersectionObserver + delay)
//   M/05 card hover lift      · CSS :hover (no JS)
//   M/06 CTA arrow slide      · CSS :hover (no JS)
//   M/09 card click wipe      · this file (class swap + setTimeout)
//
// Reduced-motion behavior documented per-treatment alongside each handler.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── M/04 · card stagger fade-up ─────────────────────────────────────────
// Reduced-motion: cards revealed immediately, no transition delay.
function setupCardStagger() {
  const cards = Array.from(document.querySelectorAll('.proj-card'));
  if (!cards.length) return;

  if (reduced || !('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const idx = cards.indexOf(entry.target);
      entry.target.style.transitionDelay = `${Math.max(0, idx) * 100}ms`;
      entry.target.classList.add('is-revealed');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  cards.forEach((c) => io.observe(c));
}

// ─── M/09 · card click wipe + fade ───────────────────────────────────────
// Reduced-motion: navigate immediately, no wipe.
function setupCardClicks() {
  document.querySelectorAll('.proj-card').forEach((card) => {
    const href = card.dataset.href;
    if (!href) return;

    card.addEventListener('click', (e) => {
      // If the user clicked an actual link inside the card (CTA, secondary
      // link, etc.), let the browser handle it natively. Don't double-fire.
      if (e.target.closest('a')) return;

      if (reduced) {
        location.href = href;
        return;
      }
      if (card.classList.contains('is-exiting')) return;
      card.classList.add('is-exiting');
      setTimeout(() => { location.href = href; }, 180);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (reduced) { location.href = href; return; }
      if (card.classList.contains('is-exiting')) return;
      card.classList.add('is-exiting');
      setTimeout(() => { location.href = href; }, 180);
    });
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────
function boot() {
  setupCardStagger();
  setupCardClicks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
