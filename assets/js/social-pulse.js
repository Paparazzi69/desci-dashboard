// Homepage Social Pulse widget. Reads /api/sentiment and renders:
//   • Top movers · top 3 by absolute change_24h_pct (Day 1 baseline
//     fallback sorts by raw mention count when no prior snapshot exists).
//   • Narrative card · sector-level summary built from /api/sentiment
//     metadata. The "real" trending narrative will come from a separate
//     endpoint we add later · for now this surfaces sector volume.
//
// Renders "Coming soon" before the daily snapshot cron has produced any
// data, never flickers placeholder counts that get overwritten.

const API_URL = '/api/sentiment';

bootSocialPulse();

async function bootSocialPulse() {
  const widget = document.getElementById('social-pulse');
  if (!widget) return;

  let payload;
  try {
    const r = await fetch(API_URL, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    payload = await r.json();
  } catch (e) {
    // Leave the "Coming soon" placeholder in place. The widget should never
    // 500-trip the homepage · the dashboard above must keep working.
    console.warn('social-pulse fetch failed', e);
    return;
  }

  const tokens = Array.isArray(payload?.tokens) ? payload.tokens : [];
  if (!tokens.length) return;  // Keep "Coming soon"

  const meta = payload?.metadata || {};
  renderMovers(tokens, meta);
  renderNarrative(tokens, meta);
}

function renderMovers(tokens, meta) {
  const list = document.getElementById('pulse-movers-list');
  if (!list) return;

  const hasPrev = !!meta?.has_previous_day;
  let ranked;
  let badge = null;

  if (hasPrev) {
    // Real day-over-day movers · sort by absolute change.
    ranked = tokens
      .filter(t => Number.isFinite(t.change_24h_pct))
      .sort((a, b) => Math.abs(b.change_24h_pct) - Math.abs(a.change_24h_pct))
      .slice(0, 3);
  } else {
    // Day 1 baseline · no prior snapshot exists, fall back to volume.
    ranked = tokens
      .filter(t => Number.isFinite(t.mention_count))
      .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
      .slice(0, 3);
    badge = 'Day 1, baseline';
  }

  if (!ranked.length) return;  // Keep "Coming soon"

  list.innerHTML = '';
  ranked.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'pulse-mover';

    const rank = document.createElement('span');
    rank.className = 'pulse-mover-rank';
    rank.textContent = String(i + 1);
    li.appendChild(rank);

    const tk = document.createElement('span');
    tk.className = 'pulse-mover-ticker';
    tk.textContent = t.ticker || '';
    li.appendChild(tk);

    if (hasPrev) {
      const change = document.createElement('span');
      const pos = (t.change_24h_pct || 0) >= 0;
      change.className = 'pulse-mover-change ' + (pos ? 'pos' : 'neg');
      const arrow = pos ? '▲' : '▼';
      change.textContent = `${arrow} ${Math.abs(t.change_24h_pct).toFixed(1)}%`;
      li.appendChild(change);
    }

    const ment = document.createElement('span');
    ment.className = 'pulse-mover-mentions';
    ment.textContent = formatCount(t.mention_count);
    li.appendChild(ment);

    list.appendChild(li);
  });

  if (badge) {
    const baseline = document.createElement('li');
    baseline.className = 'pulse-empty';
    baseline.style.fontSize = '11px';
    baseline.style.padding = '0';
    baseline.textContent = badge;
    list.appendChild(baseline);
  }
}

function renderNarrative(tokens, meta) {
  const body = document.getElementById('pulse-narrative-body');
  if (!body) return;

  const total = Number.isFinite(meta?.total_mentions)
    ? meta.total_mentions
    : tokens.reduce((n, t) => n + (Number.isFinite(t.mention_count) ? t.mention_count : 0), 0);
  const tracked = Number.isFinite(meta?.tracked_count) ? meta.tracked_count : tokens.length;

  if (!total || !tracked) return;  // Keep "Coming soon"

  body.innerHTML = '';
  const p = document.createElement('p');
  p.append('DeSci sector mentions: ');
  const totalSpan = document.createElement('strong');
  totalSpan.style.color = 'var(--green)';
  totalSpan.style.fontFamily = "'JetBrains Mono', monospace";
  totalSpan.textContent = formatCount(total);
  p.append(totalSpan, ` across ${tracked} tracked tokens.`);
  body.appendChild(p);

  const small = document.createElement('small');
  // Smart-account engagement total · gives a sense of how much KOL
  // attention the sector is pulling.
  const smartTotal = tokens.reduce(
    (n, t) => n + (Number.isFinite(t.smart_mention_count) ? t.smart_mention_count : 0), 0);
  const sentBacked = tokens.filter(t => Number.isFinite(t.sentiment_score)).length;
  const parts = [];
  parts.push(`${formatCount(smartTotal)} smart reposts`);
  if (sentBacked) parts.push(`${sentBacked} tickers with AI sentiment`);
  small.textContent = parts.join(' · ');
  body.appendChild(small);
}

function formatCount(n) {
  if (!Number.isFinite(n)) return '·';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
