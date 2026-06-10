// /dah — live stats via the public GeckoTerminal token endpoint (CORS-open,
// no key; same data family the dashboard's /api/prices uses server-side).
// $DAH has no DEX pair yet (EasyA Kickstart bonding curve), so DexScreener
// returns pairs:null for this mint — GT is the source that tracks the curve.
// Page degrades to em-dash placeholders if the feed is unreachable.

import { fmt, fmtPrice } from './format.js';

const ADDR = '3AxTzPD5H6JTjrXgkBqtp9wYpB3fhp2zX2v1zpjKHhu3';

async function boot() {
  wireCopy();
  try {
    const r = await fetch('https://api.geckoterminal.com/api/v2/networks/solana/tokens/' + ADDR);
    if (!r.ok) throw new Error('geckoterminal ' + r.status);
    const json = await r.json();
    render(json.data && json.data.attributes ? json.data.attributes : {});
  } catch (e) {
    console.warn('GeckoTerminal fetch failed:', e);
    // Stat cells keep their placeholder dashes.
  }
}

function render(a) {
  const price = Number(a.price_usd);
  if (Number.isFinite(price) && price > 0) set('dah-price', fmtPrice(price));

  const fdv = Number(a.fdv_usd);
  if (Number.isFinite(fdv) && fdv > 0) set('dah-fdv', fmt(fdv));

  const vol = Number(a.volume_usd && a.volume_usd.h24);
  if (Number.isFinite(vol)) set('dah-vol', fmt(vol));

  const lp = a.launchpad_details;
  if (lp && typeof lp.graduation_percentage === 'number') {
    set('dah-grad', lp.completed ? 'Graduated' : lp.graduation_percentage.toFixed(1) + '%');
  }
}

function set(id, v) {
  document.getElementById(id).textContent = v;
}

function wireCopy() {
  const btn = document.getElementById('dah-copy');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ADDR);
      btn.textContent = 'COPIED';
      setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
    } catch (e) {
      // Clipboard API blocked — the address stays selectable by hand.
    }
  });
}

boot();
