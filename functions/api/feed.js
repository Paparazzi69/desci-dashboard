// GET /api/feed
// News-only RSS aggregator. Pulls Decrypt + The Defiant, keyword-filters
// for DeSci relevance, sorts by timestamp desc, returns top 30. Cached
// for 5 minutes in KV.
//
// Twitter via Nitter was removed — the Nitter mirror network is too
// flaky to ship as a primary signal. The PeptAI featured card on the
// frontend is editorial, hardcoded in feed.js — no infra dependency.

import { jsonResponse, cacheGet, cachePut } from '../_shared.js';

const CACHE_KEY = 'feed:v2';
const TTL_S = 5 * 60;

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
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return jsonResponse(cached);

  const newsItems = await aggregateNews();
  const sorted = newsItems
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30);

  const payload = { items: sorted, fetchedAt: new Date().toISOString() };
  await cachePut(CACHE_KEY, payload, TTL_S);
  return jsonResponse(payload);
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
