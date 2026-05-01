// GET /api/feed
// Aggregates DeSci-relevant tweets (via Nitter RSS) plus 3 news RSS sources,
// merges, sorts by timestamp desc, returns top 30.
//
// Resilience:
// - Each Twitter handle tries the Nitter instance list in order.
// - If ALL Nitter instances fail for ALL handles, return {fallback:true, accounts:[...]}
//   so the frontend can render official Twitter embed widgets instead.
// - News feeds are fetched best-effort; failures are logged and skipped.

import { jsonResponse, kvGet, kvPut } from '../_shared.js';

const CACHE_KEY = 'feed:v1';
const TTL_S = 5 * 60;

const NITTER_INSTANCES = [
  'nitter.poast.org',
  'nitter.privacyredirect.com',
  'nitter.tiekoetter.com',
  'lightbrd.com',
  'nuku.trabun.org',
  'nitter.kareem.one',
];

const TWITTER_HANDLES = [
  'BioProtocol', 'VitaDAO', 'peptai_', 'pumpdotscience', 'molecule_sci',
  'HairDAO_', 'ResearchHub', 'paulkhls', 'AthenaDAO_',
];

// News RSS sources. Decrypt + The Defiant are general-purpose feeds that we
// keyword-filter for DeSci relevance; Endpoints News (biotech industry) is
// kept unfiltered as a quality biotech baseline.
const NEWS_SOURCES = [
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    keywordFilter: true,
  },
  {
    name: 'The Defiant',
    url: 'https://thedefiant.io/api/feed',
    keywordFilter: true,
  },
];

const KEYWORDS = [
  'desci', 'biodao', 'peptide', 'longevity', 'bio protocol', 'vitadao',
];

export async function onRequest({ env }) {
  const cached = await kvGet(env, CACHE_KEY);
  if (cached) return jsonResponse(cached);

  const [tweetItems, newsItems] = await Promise.all([
    aggregateTweets(),
    aggregateNews(),
  ]);

  if (tweetItems.length === 0) {
    // Every Nitter instance failed for every handle. Tell the frontend to
    // fall back to official Twitter embeds.
    const fallback = { fallback: true, accounts: TWITTER_HANDLES, news: newsItems.slice(0, 10), fetchedAt: new Date().toISOString() };
    await kvPut(env, CACHE_KEY, fallback, TTL_S);
    return jsonResponse(fallback);
  }

  const merged = [...tweetItems, ...newsItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30);

  const payload = { items: merged, fetchedAt: new Date().toISOString() };
  await kvPut(env, CACHE_KEY, payload, TTL_S);
  return jsonResponse(payload);
}

// ── Twitter via Nitter ───────────────────────────────────────────────────────
async function aggregateTweets() {
  const results = await Promise.all(TWITTER_HANDLES.map(fetchHandleViaNitter));
  return results.flat();
}

async function fetchHandleViaNitter(handle) {
  for (const host of NITTER_INSTANCES) {
    try {
      const r = await fetch(`https://${host}/${handle}/rss`, {
        headers: { 'user-agent': 'desci-dashboard/1.0 (+https://desci-dashboard.pages.dev)' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseRSSItems(xml).slice(0, 5).map(it => ({
        type: 'tweet',
        handle,
        name: it.author || handle,
        text: stripHtml(it.description || it.title || ''),
        url: it.link,
        timestamp: it.pubDate,
        verified: false,
      }));
      if (items.length > 0) return items;
    } catch (e) {
      // try next instance
    }
  }
  return [];
}

// ── News ─────────────────────────────────────────────────────────────────────
async function aggregateNews() {
  const all = await Promise.all(NEWS_SOURCES.map(fetchNewsSource));
  return all.flat();
}

async function fetchNewsSource(src) {
  try {
    const r = await fetch(src.url, {
      headers: { 'user-agent': 'desci-dashboard/1.0' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    let items = parseRSSItems(xml).slice(0, 20);
    if (src.keywordFilter) {
      items = items.filter(it => {
        const haystack = ((it.title || '') + ' ' + (it.description || '') + ' ' + (it.categories || '')).toLowerCase();
        return KEYWORDS.some(k => haystack.includes(k));
      });
    }
    return items.slice(0, 5).map(it => ({
      type: 'news',
      source: src.name,
      text: it.title || stripHtml(it.description || ''),
      url: it.link,
      timestamp: it.pubDate,
    }));
  } catch (e) {
    console.warn(`News fetch failed for ${src.name}:`, e);
    return [];
  }
}

// ── Tiny RSS parser ──────────────────────────────────────────────────────────
// We avoid pulling a dependency. Cloudflare Workers don't have DOMParser, so
// we parse with regex — good enough for well-formed RSS/Atom feeds.
function parseRSSItems(xml) {
  if (!xml) return [];
  const items = [];
  // RSS <item> blocks
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < 30) {
    const block = m[1];
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      description: extractTag(block, 'description'),
      pubDate: normaliseDate(extractTag(block, 'pubDate') || extractTag(block, 'dc:date')),
      author: extractTag(block, 'dc:creator') || extractTag(block, 'author'),
      categories: (block.match(/<category[^>]*>([^<]*)<\/category>/gi) || []).join(' '),
    });
  }
  if (items.length > 0) return items;

  // Atom <entry> blocks
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) && items.length < 30) {
    const block = m[1];
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      title: extractTag(block, 'title'),
      link: linkMatch ? linkMatch[1] : '',
      description: extractTag(block, 'summary') || extractTag(block, 'content'),
      pubDate: normaliseDate(extractTag(block, 'updated') || extractTag(block, 'published')),
      author: extractTag(block, 'name'),
    });
  }
  return items;
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  return decodeCData(m[1]).trim();
}

function decodeCData(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtml(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normaliseDate(s) {
  if (!s) return new Date().toISOString();
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return new Date().toISOString();
  return t.toISOString();
}
