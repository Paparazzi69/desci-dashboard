// Sentiment page client. Reads /api/sentiment, renders the overview metric
// row + per-project table, and draws inline-SVG sparklines without any
// external chart library.
//
// Column rules:
//   • PROJECT · display name (e.g. "VitaDAO") with the $ticker shown as
//     small dim subtext below it ("$VITA").
//   • SENTIMENT · colored bar -1..+1 when sentiment_score is non-null,
//     "n/a" when null (the snapshot cron skips chat below 5 mentions).
//   • DESCI · count of distinct DeSci-roster accounts that mentioned
//     the project (any roster row, not just is_smart=1 · the strict
//     Elfa-smart subset stays on /kols). Header tooltip names the
//     total roster size.
//   • TOP MENTION · @username + view count, whole cell links to the tweet.

const API_URL = '/api/sentiment';
const EMPTY_PLACEHOLDER = '·';
const NA_PLACEHOLDER = 'n/a';

init();

async function init() {
  let payload;
  try {
    const r = await fetch(API_URL, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    payload = await r.json();
  } catch (e) {
    renderEmpty('Sentiment data unavailable, the snapshot cron has not run yet, or the network is blocked.');
    console.warn('sentiment fetch failed', e);
    return;
  }

  const tokens = Array.isArray(payload?.tokens) ? payload.tokens : [];
  if (!tokens.length) {
    renderEmpty('Coming soon, the daily snapshot has not run yet. Data shows up once the first cron fires.');
    setUpdated(payload?.updated_at);
    return;
  }

  // Sort by mention_count desc · the most-discussed project leads the table.
  tokens.sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0));

  const meta = payload?.metadata || {};
  applySmartTooltip(meta.smart_roster_size);

  renderOverview(tokens, meta);
  renderTable(tokens);
  setUpdated(payload?.updated_at);
}

function applySmartTooltip(rosterSize) {
  const th = document.getElementById('th-smart');
  if (!th) return;
  const size = Number.isFinite(rosterSize) ? rosterSize : 0;
  th.title = size
    ? `DeSci-roster accounts who mentioned this project (curated from 3 community lists, ${size} total tracked)`
    : 'DeSci-roster accounts who mentioned this project (roster bootstrap pending)';
}

function renderOverview(tokens, metadata) {
  let smartReposts = 0;
  let sentSum = 0;
  let sentCount = 0;
  // Most bullish · highest sentiment_score among rows where the chat
  // call actually produced a value (sentiment_error null is implicit ·
  // null score means either skipped-below-threshold or chat-failed,
  // either way nothing to surface).
  let mostBullish = null;

  for (const t of tokens) {
    if (Number.isFinite(t.smart_mention_count)) smartReposts += t.smart_mention_count;
    if (Number.isFinite(t.sentiment_score)) {
      sentSum += t.sentiment_score;
      sentCount++;
      if (mostBullish === null || t.sentiment_score > mostBullish.sentiment_score) {
        mostBullish = t;
      }
    }
  }

  const totalMentions = Number.isFinite(metadata?.total_mentions)
    ? metadata.total_mentions
    : tokens.reduce((n, t) => n + (Number.isFinite(t.mention_count) ? t.mention_count : 0), 0);

  setText('om-total', formatCount(totalMentions));
  setText('om-smart', formatCount(smartReposts));

  // Most bullish callout · prefer the precomputed metadata.most_bullish
  // from the API (added in sentiment:v9), fall back to the local scan
  // above so the card still works against an older cached payload.
  const fromApi = metadata?.most_bullish;
  const bullish = (fromApi && Number.isFinite(fromApi.sentiment_score))
    ? { label: fromApi.label, score: fromApi.sentiment_score }
    : (mostBullish
        ? {
            label: mostBullish.symbol || mostBullish.display || mostBullish.ticker || '',
            score: mostBullish.sentiment_score,
          }
        : null);

  if (bullish && bullish.label) {
    setText('om-bullish', bullish.label);
    setText('om-bullish-sub', `sentiment ${signedFixed(bullish.score, 2)}`);
  } else {
    setText('om-bullish', NA_PLACEHOLDER);
    setText('om-bullish-sub', 'awaiting daily snapshot');
  }

  setText('om-sent',
    sentCount ? signedFixed(sentSum / sentCount, 2) : NA_PLACEHOLDER);
}

function renderTable(tokens) {
  const tbody = document.getElementById('sentiment-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  tokens.forEach((t, i) => {
    const tr = document.createElement('tr');
    tr.appendChild(td('col-rank', String(i + 1)));

    // Project cell · display name big, $ticker small dim below.
    const projectCell = document.createElement('td');
    projectCell.className = 'col-ticker';
    const display = t.display || t.ticker || '';
    const symbol = t.symbol || null;
    const nameSpan = document.createElement('div');
    nameSpan.className = 'project-name';
    nameSpan.textContent = display;
    projectCell.appendChild(nameSpan);
    if (symbol) {
      const tickerSpan = document.createElement('div');
      tickerSpan.className = 'project-ticker';
      tickerSpan.textContent = symbol;
      projectCell.appendChild(tickerSpan);
    }
    projectCell.title = symbol
      ? `Click to copy ${symbol}`
      : `Click to copy ${display}`;
    projectCell.addEventListener('click', () => {
      try { navigator.clipboard.writeText(symbol || display); } catch (e) { /* ignore */ }
    });
    tr.appendChild(projectCell);

    // Mentions 7d + day-over-day change badge. change_24h_pct compares
    // today's 7d total against yesterday's 7d total · the magnitude is
    // smaller than 24h-vs-24h would be (overlapping windows) but the
    // direction still tracks recent momentum.
    const mentionsCell = document.createElement('td');
    mentionsCell.className = 'col-num';
    const mainSpan = document.createElement('span');
    mainSpan.className = 'num-strong';
    mainSpan.textContent = formatCount(t.mention_count);
    mentionsCell.appendChild(mainSpan);
    if (Number.isFinite(t.change_24h_pct)) {
      const sign = t.change_24h_pct > 0.5 ? 'pos'
                 : t.change_24h_pct < -0.5 ? 'neg'
                 : 'flat';
      const arrow = sign === 'pos' ? '▲' : sign === 'neg' ? '▼' : '·';
      const badge = document.createElement('span');
      badge.className = 'num-change-' + sign;
      badge.style.marginLeft = '8px';
      badge.textContent = `${arrow} ${Math.abs(t.change_24h_pct).toFixed(1)}%`;
      mentionsCell.appendChild(badge);
    }
    tr.appendChild(mentionsCell);

    // Smart column · raw count, no formatting trick (the header carries
    // the explanation tooltip).
    const smartCell = td('col-num',
      Number.isFinite(t.smart_mention_count) ? formatCount(t.smart_mention_count) : EMPTY_PLACEHOLDER);
    smartCell.title = 'Distinct DeSci-roster accounts who mentioned this project';
    tr.appendChild(smartCell);

    // Sentiment bar -1..+1, or "n/a" when chat was skipped or failed.
    const sentCell = document.createElement('td');
    if (Number.isFinite(t.sentiment_score)) {
      const sentWrap = document.createElement('div');
      sentWrap.className = 'sentiment-bar-cell';
      sentWrap.appendChild(buildSentimentBar(t.sentiment_score));
      const sentVal = document.createElement('span');
      sentVal.className = 'sentiment-bar-value';
      sentVal.textContent = signedFixed(t.sentiment_score, 2);
      sentWrap.appendChild(sentVal);
      sentCell.appendChild(sentWrap);
    } else {
      const na = document.createElement('span');
      na.className = 'sentiment-bar-value';
      na.textContent = NA_PLACEHOLDER;
      na.title = 'Sentiment not computed (fewer than 5 mentions, or chat call failed)';
      sentCell.appendChild(na);
    }
    tr.appendChild(sentCell);

    tr.appendChild(td('col-num',
      Number.isFinite(t.mindshare) ? formatPercent(t.mindshare) : EMPTY_PLACEHOLDER));

    // Sparkline
    const sparkCell = document.createElement('td');
    sparkCell.className = 'col-spark';
    sparkCell.innerHTML = sparklineSVG(t.sparkline || [], {
      positive: (t.change_24h_pct || 0) >= 0,
      w: 90, h: 26,
    });
    tr.appendChild(sparkCell);

    // Top mention · @username, deep-linked to the tweet when we have
    // a tweet id. View count is intentionally NOT rendered · Elfa's
    // indexing lags so the value is frequently low or zero on tweets
    // with real engagement (seen 915 vs 6500 in the wild). The handle
    // and the link are the actual signal; the number was noise. If
    // tweet_id is null (legacy data before PR #16's snapshot cron),
    // we fall back to plain text rather than a profile link · the
    // user wanted "no link" not "wrong link".
    const topCell = document.createElement('td');
    topCell.className = 'col-top';
    if (t.top_mention && t.top_mention.username) {
      const id = t.top_mention.tweet_id;
      if (id) {
        const a = document.createElement('a');
        a.href =
          `https://x.com/${encodeURIComponent(t.top_mention.username)}/status/${encodeURIComponent(id)}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '@' + t.top_mention.username;
        topCell.appendChild(a);
      } else {
        topCell.textContent = '@' + t.top_mention.username;
      }
    } else {
      topCell.textContent = EMPTY_PLACEHOLDER;
    }
    tr.appendChild(topCell);

    tbody.appendChild(tr);
  });
}

function buildSentimentBar(score) {
  const wrap = document.createElement('div');
  wrap.className = 'sentiment-bar';
  const mid = document.createElement('div');
  mid.className = 'sentiment-bar-mid';
  wrap.appendChild(mid);
  if (!Number.isFinite(score)) return wrap;

  const clamped = Math.max(-1, Math.min(1, score));
  const fill = document.createElement('div');
  const halfWidthPct = Math.abs(clamped) * 50;
  if (clamped > 0.05) {
    fill.className = 'sentiment-bar-fill pos';
    fill.style.left = '50%';
    fill.style.width = halfWidthPct + '%';
  } else if (clamped < -0.05) {
    fill.className = 'sentiment-bar-fill neg';
    fill.style.right = '50%';
    fill.style.width = halfWidthPct + '%';
  } else {
    fill.className = 'sentiment-bar-fill neutral';
    fill.style.left = 'calc(50% - 2px)';
    fill.style.width = '4px';
  }
  wrap.appendChild(fill);
  return wrap;
}

// Inline SVG sparkline · same shape as assets/js/sparkline.js but inlined
// here so this page stays a single-bundle import without cross-module deps.
function sparklineSVG(data, { positive = true, w = 90, h = 26 } = {}) {
  if (!data || data.length < 2) {
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = 'M ' + pts.join(' L ');
  const fillD = pathD + ` L ${w},${h} L 0,${h} Z`;
  const stroke = positive ? 'var(--green)' : 'var(--red)';
  const fill = positive ? 'oklch(0.78 0.19 155 / 0.12)' : 'oklch(0.65 0.2 22 / 0.1)';
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">
      <path d="${fillD}" fill="${fill}"/>
      <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
}

function renderEmpty(msg) {
  const tbody = document.getElementById('sentiment-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr class="placeholder-row"><td colspan="8">${msg}</td></tr>`;
  }
  ['om-total', 'om-smart', 'om-sent'].forEach(id => setText(id, EMPTY_PLACEHOLDER));
  setText('om-bullish', NA_PLACEHOLDER);
  setText('om-bullish-sub', 'awaiting daily snapshot');
}

function setUpdated(unix) {
  const el = document.getElementById('sentiment-updated');
  if (!el) return;
  if (!unix) { el.textContent = 'Last updated: ' + EMPTY_PLACEHOLDER; return; }
  try {
    const d = new Date(unix * 1000);
    el.textContent = 'Last updated: ' + d.toUTCString().replace('GMT', 'UTC');
  } catch { el.textContent = 'Last updated: ' + EMPTY_PLACEHOLDER; }
  const t = document.getElementById('status-time');
  if (t) {
    try {
      t.textContent = new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    } catch { /* ignore */ }
  }
}

// Format helpers
function formatCount(n) {
  if (!Number.isFinite(n)) return EMPTY_PLACEHOLDER;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function formatPercent(p) {
  if (!Number.isFinite(p)) return EMPTY_PLACEHOLDER;
  // mindshare comes back 0..1; render as %.
  return (p * 100).toFixed(2) + '%';
}
function signedFixed(n, digits) {
  if (!Number.isFinite(n)) return EMPTY_PLACEHOLDER;
  const s = n.toFixed(digits);
  return n > 0 ? '+' + s : s;
}
function td(cls, text) {
  const cell = document.createElement('td');
  cell.className = cls;
  cell.textContent = text;
  return cell;
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
