// POST/GET /cron/aggregate-news
//
// Bearer-auth-gated aggregator. Fetches every configured RSS / Atom / API
// source in parallel, filters by DeSci keywords (or accepts all for
// project-native sources), dedupes, and inserts pending rows into D1.
//
// Triggered hourly by an external cron (cron-job.org) — see README. The
// endpoint also accepts manual curl calls for smoke testing. Returns a
// JSON summary so cron-job.org can show success/failure at a glance.

import { jsonResponse, requireAdminAuth } from '../_shared.js';

// ── Sources ──────────────────────────────────────────────────────────────
const RSS_SOURCES = [
  // Substack-class — reliable RSS via standard CMS.
  { name: 'ValleyDAO',                  url: 'https://valleydao.substack.com/feed',                            type: 'project', filter: 'pass' },
  { name: 'Partners in Digital Health', url: 'https://partnersindigitalhealth.substack.com/feed',              type: 'media',   filter: 'keyword' },
  { name: 'ResearchHub Foundation',     url: 'https://blog.researchhub.foundation/rss/',                       type: 'project', filter: 'pass' },

  // Mainstream crypto media — RSS is genuinely there, DeSci hits are sparse.
  { name: 'The Defiant',                url: 'https://thedefiant.io/api/feed',                                 type: 'media',   filter: 'keyword' },
  { name: 'Cointelegraph',              url: 'https://cointelegraph.com/rss',                                  type: 'media',   filter: 'keyword' },
  { name: 'CoinDesk',                   url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml', type: 'media',   filter: 'keyword' },
  { name: 'The Block',                  url: 'https://www.theblock.co/rss.xml',                                type: 'media',   filter: 'keyword' },
  { name: 'Blockworks',                 url: 'https://blockworks.co/feed',                                     type: 'media',   filter: 'keyword' },
  { name: 'CryptoBriefing',             url: 'https://cryptobriefing.com/feed/',                               type: 'media',   filter: 'keyword' },
];

// Sources investigated and removed — listed here as a TODO ledger so we
// don't keep re-adding URLs we already know don't work.
//
//   Bio Protocol  — Webflow.            bio.xyz has no <link rel="alternate">; /blog/rss, /feed, /rss all 404.
//   VitaDAO       — Next.js + Strapi.   vitadao.com has no feed; Strapi RSS plugin not enabled.
//   Molecule      — Next.js + Sanity.   molecule.xyz/blog/rss serves an HTML 404 with HTTP 200 (silent failure).
//   Bankless      — newsletter.banklesshq.com has a chronic TLS SAN mismatch (was the 526 we kept seeing).
//   PANews        — no /feed at panewslab.com.
//   ChainCatcher  — no /rss at chaincatcher.com.
//
// Re-investigation candidates if we want them back:
//   • Mirror.xyz/<eth>.eth/feed/atom — VitaDAO and Molecule have historically published there.
//     Mirror's bot-protection blocked our probe tool (403/429); a real Worker may fare better.
//   • A small HTML-scraper Worker for the three project-native blogs that lack feeds.

const API_SOURCES = [
  {
    name: 'ArXiv',
    url: 'http://export.arxiv.org/api/query?search_query=all:%22decentralized+science%22+OR+%22BioAgent%22+OR+%22DeSci%22+OR+%22IP-NFT%22&sortBy=submittedDate&sortOrder=descending&max_results=20',
    type: 'paper',
    filter: 'pass',
    timeoutMs: 20_000, // ArXiv's API is sluggish under load; 10s isn't enough.
  },
  {
    name: 'GitHub bio-xyz',
    url: 'https://github.com/bio-xyz.atom',
    type: 'release',
    filter: 'pass',
  },
];

// ── Filter / categorize ─────────────────────────────────────────────────
const KEYWORDS_PLAIN = [
  'desci', 'decentralized science', 'decentralised science',
  'bio protocol', 'biodao', 'molecule protocol', 'ip-nft', 'ipt',
  'researchhub', 'research hub', 'researchcoin',
  'vitadao', 'cryodao', 'hairdao', 'athenadao', 'psydao',
  'valleydao', 'cerebrumdao', 'spectruth',
  'bioagent', 'aubrai', 'peptai', 'clawdlab', 'biomeai',
  'dermalabs', 'd1ckgpt', 'gocart',
  'pump.science', 'pumpscience', 'longevity dao', 'biotech dao',
];

// Ticker keywords use word-boundary regex so `$BIO` matches in any context
// but `$BIOTECH` does not. Lowercased; tested against a lowercased haystack.
const TICKER_REGEXES = [
  /\$bio\b/, /\$vita\b/, /\$rsc\b/, /\$hair\b/, /\$ath\b/,
  /\$cryo\b/, /\$grow\b/, /\$claw\b/, /\$neuron\b/, /\$skin\b/, /\$aubrai\b/,
];

const CATEGORIES = [
  { tag: 'launch',      patterns: ['launching', 'launched', 'now live', 'announces', 'introducing', 'unveils'] },
  { tag: 'funding',     patterns: ['raises', 'raised', 'funding round', 'investment', 'seed round', 'series '] },
  { tag: 'pipeline',    patterns: ['phase 1', 'phase 2', 'wet lab', 'clinical', 'trial', 'pre-clinical'] },
  { tag: 'governance',  patterns: ['proposal', 'vote', 'governance', 'snapshot'] },
  { tag: 'research',    patterns: ['paper', 'preprint', 'published', 'arxiv', 'doi'] },
  { tag: 'token',       patterns: ['listing', 'unlock', 'tokenomics', 'airdrop'] },
  { tag: 'partnership', patterns: ['partnership', 'collaborates', 'integration'] },
];

// ── Constants ───────────────────────────────────────────────────────────
const SOURCE_TIMEOUT_MS              = 10_000;
const MAX_AGE_S                      = 30 * 24 * 60 * 60;
const FUZZY_DEDUP_LOOKBACK_S         = 24 * 60 * 60;
const VOLUME_WARN_THRESHOLD          = 50;
const FAILED_BACKOFF_S               = 24 * 60 * 60;
const FAILED_BACKOFF_THRESHOLD       = 3;
const PER_SOURCE_ITEM_CAP            = 50;
const SUMMARY_MAX_CHARS              = 300;

// ── Handler ─────────────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const startMs = Date.now();
  const fetchedAt = Math.floor(startMs / 1000);

  // Hard 30-day cutoff applied uniformly to every source on every run.
  // Crypto moves fast — anything older is functionally stale by the time
  // a human reviews it. filter:'pass' and filter:'keyword' treated alike.
  const minPublishedAt = fetchedAt - MAX_AGE_S;

  // Failed-source backoff: skip sources that have failed 3+ times in a row
  // within the last 24h. They get one retry attempt every 24h after that.
  const failedRows = (await env.DB
    .prepare('SELECT source_name, consecutive_failures, last_failed_at FROM failed_sources')
    .all()).results || [];
  const failedMap = new Map(failedRows.map(r => [r.source_name, r]));
  const skipSet = new Set();
  for (const src of [...RSS_SOURCES, ...API_SOURCES]) {
    const f = failedMap.get(src.name);
    if (f && f.consecutive_failures >= FAILED_BACKOFF_THRESHOLD &&
        (fetchedAt - f.last_failed_at) < FAILED_BACKOFF_S) {
      skipSet.add(src.name);
    }
  }

  // Fetch every source in parallel. allSettled so one slow / dead source
  // doesn't take the whole run down.
  const allSources = [...RSS_SOURCES, ...API_SOURCES];
  const settled = await Promise.allSettled(
    allSources.map(src => skipSet.has(src.name)
      ? Promise.resolve({ skipped: true, items: [] })
      : fetchAndParseSource(src))
  );

  // Build per-source records + collect items for insertion.
  const perSource = [];
  const candidates = [];
  for (let i = 0; i < settled.length; i++) {
    const src = allSources[i];
    const s = settled[i];
    const result = s.status === 'fulfilled'
      ? s.value
      : { error: String(s.reason?.message || s.reason), items: [] };

    if (result.skipped) {
      perSource.push({ source: src.name, ok: false, skipped: true });
      console.log(`⏭️  ${src.name}: skipped (failure backoff)`);
      continue;
    }
    if (result.error) {
      perSource.push({ source: src.name, ok: false, error: result.error });
      console.log(`❌ ${src.name}: ${result.error}`);
      continue;
    }

    // Per-item drop attribution. Keyword filter only runs on `keyword`
    // sources; cold-start date cutoff also only runs on keyword sources —
    // project-native (`pass`) sources are trusted to publish whatever
    // they choose, whenever they choose.
    const all = result.items;
    let kept = all;
    let droppedKeyword = 0;
    let droppedDate = 0;
    const dropSamples = [];

    // Date range across the raw fetch — surfaces date-parsing bugs even
    // when zero items survive the filter.
    let newest = null, oldest = null;
    for (const it of all) {
      if (typeof it.published_at !== 'number') continue;
      if (newest === null || it.published_at > newest) newest = it.published_at;
      if (oldest === null || it.published_at < oldest) oldest = it.published_at;
    }

    if (src.filter === 'keyword') {
      const next = [];
      for (const it of kept) {
        if (matchesKeywords(it)) { next.push(it); continue; }
        droppedKeyword++;
        if (dropSamples.length < 5) {
          dropSamples.push({ reason: 'no-keyword', title: it.title.slice(0, 120) });
        }
      }
      kept = next;
    }

    {
      const next = [];
      for (const it of kept) {
        if (it.published_at >= minPublishedAt) { next.push(it); continue; }
        droppedDate++;
        if (dropSamples.length < 8) {
          dropSamples.push({
            reason: 'too-old',
            title: it.title.slice(0, 120),
            publishedISO: new Date(it.published_at * 1000).toISOString(),
          });
        }
      }
      kept = next;
    }

    if (kept.length > VOLUME_WARN_THRESHOLD) {
      console.warn(`⚠️  ${src.name}: ${kept.length} items after filter — keyword filter may be broken`);
    }

    const dateRange = (newest !== null && oldest !== null) ? {
      newestISO: new Date(newest * 1000).toISOString(),
      oldestISO: new Date(oldest * 1000).toISOString(),
    } : null;

    perSource.push({
      source: src.name,
      ok: true,
      filter: src.filter,
      rawCount: result.rawCount ?? all.length,
      parsed: all.length,
      parseDropped: (result.rawCount ?? all.length) - all.length,
      droppedKeyword,
      droppedDate,
      kept: kept.length,
      filtered: kept.length, // alias for back-compat with prior response shape
      dateRange,
      dropSamples,
    });
    console.log(
      `✅ ${src.name}: kept=${kept.length} parsed=${all.length} ` +
      `droppedKw=${droppedKeyword} droppedDate=${droppedDate} ` +
      `range=${dateRange ? dateRange.oldestISO + '..' + dateRange.newestISO : '?'}`,
    );

    // Stamp source metadata onto each item before queuing for insert.
    for (const it of kept) {
      candidates.push({
        ...it,
        source: src.name,
        source_type: src.type,
        category: categorise(it.title, it.summary),
        fetched_at: fetchedAt,
      });
    }
  }

  // Title-fuzzy dedup: pull last-24h normalized titles already in D1, then
  // also dedup against other candidates in the current batch.
  const recent = (await env.DB
    .prepare('SELECT title_normalized FROM news_items WHERE published_at > ?')
    .bind(fetchedAt - FUZZY_DEDUP_LOOKBACK_S)
    .all()).results || [];
  const seenTitles = new Set(recent.map(r => r.title_normalized));
  const toInsert = [];
  let titleDuplicates = 0;
  for (const it of candidates) {
    if (seenTitles.has(it.title_normalized)) {
      titleDuplicates++;
      continue;
    }
    seenTitles.add(it.title_normalized);
    toInsert.push(it);
  }

  // Batch INSERT OR IGNORE. URL-hash PRIMARY KEY handles URL-level dedup
  // automatically — the changes counter tells us how many actually landed.
  let inserted = 0;
  if (toInsert.length) {
    const stmt = env.DB.prepare(
      `INSERT OR IGNORE INTO news_items
         (id, source, source_type, title, title_normalized, url, summary, author, category, published_at, fetched_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    );
    const batch = toInsert.map(it => stmt.bind(
      it.id, it.source, it.source_type, it.title, it.title_normalized,
      it.url, it.summary, it.author, it.category, it.published_at, it.fetched_at,
    ));
    const results = await env.DB.batch(batch);
    inserted = results.reduce((acc, r) => acc + (r.meta?.changes || 0), 0);
  }

  // Update failed_sources: clear on success, increment on failure.
  const bookkeeping = [];
  for (let i = 0; i < settled.length; i++) {
    const src = allSources[i];
    const ps = perSource[i];
    if (ps.ok) {
      bookkeeping.push(env.DB
        .prepare('DELETE FROM failed_sources WHERE source_name = ?')
        .bind(src.name));
    } else if (!ps.skipped && ps.error) {
      bookkeeping.push(env.DB.prepare(
        `INSERT INTO failed_sources (source_name, last_error, last_failed_at, consecutive_failures)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(source_name) DO UPDATE SET
           last_error = excluded.last_error,
           last_failed_at = excluded.last_failed_at,
           consecutive_failures = failed_sources.consecutive_failures + 1`
      ).bind(src.name, String(ps.error).slice(0, 500), fetchedAt));
    }
  }
  if (bookkeeping.length) await env.DB.batch(bookkeeping);

  return jsonResponse({
    ok: true,
    fetchedAt,
    cutoffISO: new Date(minPublishedAt * 1000).toISOString(),
    durationMs: Date.now() - startMs,
    perSource,
    totals: {
      fetched: perSource.reduce((a, p) => a + (p.fetched || 0), 0),
      filtered: perSource.reduce((a, p) => a + (p.filtered || 0), 0),
      titleDuplicates,
      inserted,
    },
  });
}

// ── Source fetching ─────────────────────────────────────────────────────
async function fetchAndParseSource(src) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), src.timeoutMs ?? SOURCE_TIMEOUT_MS);
  try {
    const r = await fetch(src.url, {
      headers: {
        'user-agent': 'desci-dashboard/1.0',
        accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml',
      },
      signal: ctrl.signal,
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    clearTimeout(timer);
    if (!r.ok) return { error: `HTTP ${r.status}`, items: [] };
    // Some CMSes (Next.js soft-404 — Molecule was the canonical case) serve
    // HTTP 200 with an HTML body where we expected XML. Our regex parser
    // silently finds zero <item> tags and the run looks "successful empty".
    // Reject up-front so the source lands in failed_sources instead.
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.startsWith('text/html')) {
      return { error: `expected feed XML, got ${ct}`, items: [] };
    }
    const xml = await r.text();
    const raws = parseFeedItems(xml).slice(0, PER_SOURCE_ITEM_CAP);
    const items = (await Promise.all(raws.map(buildItem))).filter(Boolean);
    return { items, rawCount: raws.length };
  } catch (e) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') return { error: 'timeout', items: [] };
    return { error: String(e?.message || e), items: [] };
  }
}

async function buildItem(raw) {
  if (!raw.title || !raw.link) return null;
  const url = normalizeUrl(raw.link);
  if (!url) return null;
  const title = decodeEntities(raw.title.trim());
  if (!title) return null;
  const summary = formatSummary(raw.description || raw.content || '');
  const titleNorm = normalizeTitle(title);
  const id = await sha256Hex(url);
  return {
    id,
    title,
    title_normalized: titleNorm,
    url,
    summary,
    author: raw.author ? raw.author.trim() : null,
    published_at: toUnixSeconds(raw.pubDate) ?? Math.floor(Date.now() / 1000),
  };
}

// ── Filtering / categorisation ─────────────────────────────────────────
function matchesKeywords(item) {
  const hay = (item.title + ' ' + (item.summary || '')).toLowerCase();
  for (const k of KEYWORDS_PLAIN) if (hay.includes(k)) return true;
  for (const re of TICKER_REGEXES) if (re.test(hay)) return true;
  return false;
}

function categorise(title, summary) {
  const hay = (title + ' ' + (summary || '')).toLowerCase();
  for (const c of CATEGORIES) {
    for (const p of c.patterns) {
      if (hay.includes(p)) return c.tag;
    }
  }
  return 'other';
}

// ── URL / title / hash helpers ──────────────────────────────────────────
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'ref_url',
]);

function normalizeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

function normalizeTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function toUnixSeconds(s) {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

// ── Tiny RSS / Atom parser ─────────────────────────────────────────────
// No DOMParser in Workers, so we regex. Good enough for well-formed feeds.
function parseFeedItems(xml) {
  if (!xml) return [];
  const out = [];

  // RSS <item>
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && out.length < 100) {
    const block = m[1];
    out.push({
      title: tag(block, 'title'),
      link: tag(block, 'link'),
      description: tag(block, 'content:encoded') || tag(block, 'description'),
      pubDate: tag(block, 'pubDate') || tag(block, 'dc:date'),
      author: tag(block, 'dc:creator') || tag(block, 'author'),
    });
  }
  if (out.length) return out;

  // Atom <entry>
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) && out.length < 100) {
    const block = m[1];
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/i);
    const authorBlock = block.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i);
    out.push({
      title: tag(block, 'title'),
      link: linkMatch ? linkMatch[1] : '',
      description: tag(block, 'content') || tag(block, 'summary'),
      pubDate: tag(block, 'published') || tag(block, 'updated'),
      author: authorBlock ? tag(authorBlock[1], 'name') : '',
    });
  }
  return out;
}

function tag(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  return decodeCData(m[1]).trim();
}

function decodeCData(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function formatSummary(s) {
  const stripped = decodeEntities(String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  if (stripped.length <= SUMMARY_MAX_CHARS) return stripped;
  // Truncate at the last word boundary before the cap so we don't split
  // anything indivisible mid-stream — most importantly any entity our
  // decoder didn't recognise. Falls back to char boundary if the last
  // word starts more than halfway back (one giant URL, etc.).
  const cap = SUMMARY_MAX_CHARS - 1;
  const head = stripped.slice(0, cap);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > cap / 2 ? lastSpace : cap;
  return head.slice(0, cut).trimEnd() + '…';
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»',
  middot: '·', bull: '•', deg: '°',
};

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    // &amp; first so any double-encoded form (e.g. &amp;mdash;) collapses
    // to &mdash; in time for the named-entity pass below.
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => {
      const cp = parseInt(n, 10);
      return cp > 0 ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const cp = parseInt(h, 16);
      return cp > 0 ? String.fromCodePoint(cp) : '';
    })
    // Unknown named entities are left intact so we notice gaps in the table.
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => {
      const v = NAMED_ENTITIES[name.toLowerCase()];
      return v !== undefined ? v : m;
    });
}
