// Homepage Social Pulse widget. Reads /api/sentiment and renders the top
// 3 movers (by 24h mention change) and a "narrative of the day" summary
// based on the most-discussed ticker. Renders "Coming soon" before the
// daily snapshot cron has produced any data, never flickers placeholder
// counts that get overwritten.

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

  renderMovers(tokens);
  renderNarrative(tokens);
}

function renderMovers(tokens) {
  const list = document.getElementById('pulse-movers-list');
  if (!list) return;

  // Top 3 by absolute change_24h_pct, but only if the change is finite. A
  // ticker with no prior snapshot has change=null · skip it (no signal).
  const ranked = tokens
    .filter(t => Number.isFinite(t.change_24h_pct))
    .sort((a, b) => Math.abs(b.change_24h_pct) - Math.abs(a.change_24h_pct))
    .slice(0, 3);

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

    const change = document.createElement('span');
    const pos = (t.change_24h_pct || 0) >= 0;
    change.className = 'pulse-mover-change ' + (pos ? 'pos' : 'neg');
    const arrow = pos ? '▲' : '▼';
    change.textContent = `${arrow} ${Math.abs(t.change_24h_pct).toFixed(1)}%`;
    li.appendChild(change);

    const ment = document.createElement('span');
    ment.className = 'pulse-mover-mentions';
    ment.textContent = formatCount(t.mention_count);
    li.appendChild(ment);

    list.appendChild(li);
  });
}

function renderNarrative(tokens) {
  const body = document.getElementById('pulse-narrative-body');
  if (!body) return;

  // "Narrative of the day" = the ticker with the highest 24h mention count.
  // Surfaces the day's loudest conversation without spending a separate
  // /trending-narratives credit (5x the cost of top-mentions).
  const lead = tokens
    .filter(t => Number.isFinite(t.mention_count))
    .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))[0];

  if (!lead) return;  // Keep "Coming soon"

  body.innerHTML = '';

  const p = document.createElement('p');
  const tickerSpan = document.createElement('strong');
  tickerSpan.style.color = 'var(--green)';
  tickerSpan.style.fontFamily = "'JetBrains Mono', monospace";
  tickerSpan.textContent = lead.ticker;
  p.append(tickerSpan, ' is the most-discussed DeSci ticker in the last 24h.');
  if (lead.top_mention && lead.top_mention.username) {
    const id = lead.top_mention.tweet_id;
    const a = document.createElement('a');
    a.href = id
      ? `https://x.com/${encodeURIComponent(lead.top_mention.username)}/status/${encodeURIComponent(id)}`
      : `https://x.com/${encodeURIComponent(lead.top_mention.username)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '@' + lead.top_mention.username;
    p.append(' Top voice: ', a, '.');
  }
  body.appendChild(p);

  const small = document.createElement('small');
  const parts = [];
  parts.push(`${formatCount(lead.mention_count)} mentions`);
  if (Number.isFinite(lead.smart_mention_count)) {
    parts.push(`${formatCount(lead.smart_mention_count)} smart`);
  }
  small.textContent = parts.join(' · ');
  body.appendChild(small);
}

function formatCount(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
