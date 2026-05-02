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
  // Tier A — guaranteed RSS
  { name: 'ValleyDAO',                  url: 'https://valleydao.substack.com/feed',                            type: 'project', filter: 'pass' },
  { name: 'Partners in Digital Health', url: 'https://partnersindigitalhealth.substack.com/feed',              type: 'media',   filter: 'keyword' },
  { name: 'ResearchHub Foundation',     url: 'https://blog.researchhub.foundation/rss/',                       type: 'project', filter: 'pass' },
  { name: 'The Defiant',                url: 'https://thedefiant.io/api/feed',                                 type: 'media',   filter: 'keyword' },
  { name: 'Cointelegraph',              url: 'https://cointelegraph.com/rss',                                  type: 'media',   filter: 'keyword' },
  { name: 'CoinDesk',                   url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml', type: 'media',   filter: 'keyword' },
  { name: 'The Block',                  url: 'https://www.theblock.co/rss.xml',                                type: 'media',   filter: 'keyword' },
  { name: 'Bankless',                   url: 'https://newsletter.banklesshq.com/feed',                         type: 'media',   filter: 'keyword' },
  { name: 'Blockworks',                 url: 'https://blockworks.co/feed',                                     type: 'media',   filter: 'keyword' },
  // Tier B — probable; treat 404 as expected for some
  { name: 'Bio Protocol',               url: 'https://www.bio.xyz/blog-posts/rss.xml',                         type: 'project', filter: 'pass' },
  { name: 'Molecule',                   url: 'https://molecule.xyz/blog/rss',                                  type: 'project', filter: 'pass' },
  { name: 'VitaDAO',                    url: 'https://www.vitadao.com/blog/rss',                               type: 'project', filter: 'pass' },
  { name: 'CryptoBriefing',             url: 'https://cryptobriefing.com/feed/',                               type: 'media',   filter: 'keyword' },
  { name: 'PANews',                     url: 'https://www.panewslab.com/en/feed',                              type: 'media',   filter: 'keyword' },
  { name: 'ChainCatcher',               url: 'https://www.chaincatcher.com/en/rss',                            type: 'media',   filter: 'keyword' },
];

const API_SOURCES = [
  {
    name: 'ArXiv',
    url: 'http://export.arxiv.org/api/query?search_query=all:%22decentralized+science%22+OR+%22BioAgent%22+OR+%22DeSci%22+OR+%22IP-NFT%22&sortBy=submittedDate&sortOrder=descending&max_results=20',
    type: 'paper',
    filter: 'pass',
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
const COLD_START_LOOKBACK_S          = 7 * 24 * 60 * 60;
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

  // Cold start — if news_items is empty, only accept items from the past 7d
  // so we don't dump months of historical posts into the pending queue.
  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM news_items').first();
  const coldStart = (countRow?.n ?? 0) === 0;
  const minPublishedAt = coldStart ? fetchedAt - COLD_START_LOOKBACK_S : 0;

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

    let kept = result.items;
    if (src.filter === 'keyword') kept = kept.filter(matchesKeywords);
    if (minPublishedAt > 0) kept = kept.filter(it => it.published_at >= minPublishedAt);
    if (kept.length > VOLUME_WARN_THRESHOLD) {
      console.warn(`⚠️  ${src.name}: ${kept.length} items after filter — keyword filter may be broken`);
    }
    perSource.push({ source: src.name, ok: true, fetched: result.items.length, filtered: kept.length });
    console.log(`✅ ${src.name}: ${kept.length} items (${result.items.length} fetched)`);

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
    coldStart,
    fetchedAt,
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
  const timer = setTimeout(() => ctrl.abort(), SOURCE_TIMEOUT_MS);
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
    const xml = await r.text();
    const raws = parseFeedItems(xml).slice(0, PER_SOURCE_ITEM_CAP);
    const items = (await Promise.all(raws.map(buildItem))).filter(Boolean);
    return { items };
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
  const title = raw.title.trim();
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
  return stripped.slice(0, SUMMARY_MAX_CHARS - 1).trimEnd() + '…';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
