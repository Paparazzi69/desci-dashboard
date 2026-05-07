// KOL leaderboard client. Reads /api/kols, renders overview metrics +
// per-handle table. Each row links to https://x.com/<username>.

const API_URL = '/api/kols';
const EMPTY = '·';

init();

async function init() {
  let payload;
  try {
    const r = await fetch(API_URL, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    payload = await r.json();
  } catch (e) {
    renderEmpty('KOL roster unavailable, /api/kols failed.');
    console.warn('kols fetch failed', e);
    return;
  }

  const kols = Array.isArray(payload?.kols) ? payload.kols : [];
  const meta = payload?.metadata || {};

  setText('om-smart-count', formatCount(meta.smart_count));
  setText('om-checked-count', formatCount(meta.checked_count));
  setText('om-showing', String(kols.length));

  if (Number.isFinite(meta.last_run_at) && meta.last_run_at) {
    try {
      const d = new Date(meta.last_run_at * 1000);
      setText('om-last-run', d.toUTCString().slice(5, 22));   // "07 May 2026 01:00"
      setText('om-last-run-type', meta.last_run_type
        ? `via ${meta.last_run_type}`
        : 'roster up to date');
    } catch { /* ignore */ }
  }

  if (!kols.length) {
    renderEmpty('No smart accounts in the roster yet, the bootstrap cron has not run.');
    return;
  }

  renderTable(kols);
  setUpdated(meta.last_run_at);
}

function renderTable(kols) {
  const tbody = document.getElementById('kols-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  kols.forEach((k, i) => {
    const tr = document.createElement('tr');
    tr.appendChild(td('col-rank', String(i + 1)));

    // @username link to X profile, source badge.
    const handleCell = document.createElement('td');
    handleCell.className = 'col-ticker';
    const a = document.createElement('a');
    a.href = `https://x.com/${encodeURIComponent(k.username || '')}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '@' + (k.username || '');
    handleCell.appendChild(a);
    if (k.source) {
      const badge = document.createElement('span');
      badge.className = 'kols-source-badge ' + k.source;
      badge.textContent = k.source;
      handleCell.appendChild(badge);
    }
    tr.appendChild(handleCell);

    tr.appendChild(td('col-num', formatCount(k.smart_followers_count)));
    tr.appendChild(td('col-num', formatCount(k.follower_count)));
    tr.appendChild(td('col-num',
      Number.isFinite(k.engagement_rate) ? formatEngagement(k.engagement_rate) : EMPTY));
    tr.appendChild(td('col-num', formatRelativeAge(k.last_checked_at)));

    tbody.appendChild(tr);
  });
}

function renderEmpty(msg) {
  const tbody = document.getElementById('kols-tbody');
  if (tbody) tbody.innerHTML = `<tr class="placeholder-row"><td colspan="6">${msg}</td></tr>`;
}

function setUpdated(unix) {
  const el = document.getElementById('kols-updated');
  if (!el) return;
  if (!unix) { el.textContent = 'Last updated: ' + EMPTY; return; }
  try {
    const d = new Date(unix * 1000);
    el.textContent = 'Last updated: ' + d.toUTCString().replace('GMT', 'UTC');
  } catch { el.textContent = 'Last updated: ' + EMPTY; }
  const t = document.getElementById('status-time');
  if (t) {
    try {
      t.textContent = new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    } catch { /* ignore */ }
  }
}

function formatCount(n) {
  if (!Number.isFinite(n)) return EMPTY;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function formatEngagement(rate) {
  // Engagement rate from Elfa is typically a fraction 0..1 (e.g. 0.045
  // for 4.5%). Some fields ship as a percentage already · if the value
  // is bigger than 1 we render as-is.
  if (!Number.isFinite(rate)) return EMPTY;
  const pct = rate <= 1 ? rate * 100 : rate;
  return pct.toFixed(2) + '%';
}
function formatRelativeAge(unix) {
  if (!Number.isFinite(unix) || !unix) return EMPTY;
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - unix);
  if (diff < 86_400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 30 * 86_400) return Math.floor(diff / 86_400) + 'd ago';
  return Math.floor(diff / (30 * 86_400)) + 'mo ago';
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
