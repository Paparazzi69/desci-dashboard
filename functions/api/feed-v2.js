// GET /api/feed-v2
// Public read of approved + featured news items from D1, sorted newest
// first, capped at 100. Cached at the edge for 60s — D1 is generous on
// reads but the cache cuts origin latency for repeat hits.

import { jsonResponse, cacheGet, cachePut } from '../_shared.js';

const CACHE_KEY = 'feed-v2:v1';
const TTL_S = 60;
const ITEM_LIMIT = 100;

export async function onRequest({ env }) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return jsonResponse(cached);

  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const rows = (await env.DB.prepare(
    `SELECT id, source, source_type, title, url, summary, take, category, published_at, status
       FROM news_items
      WHERE status IN ('approved', 'featured')
      ORDER BY published_at DESC
      LIMIT ?`
  ).bind(ITEM_LIMIT).all()).results || [];

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM news_items WHERE status IN ('approved', 'featured')`
  ).first();

  const payload = {
    items: rows.map(r => ({
      id: r.id,
      source: r.source,
      sourceType: r.source_type,
      title: r.title,
      url: r.url,
      summary: r.summary || '',
      take: r.take || null,
      category: r.category || 'other',
      publishedAt: r.published_at,
      featured: r.status === 'featured',
    })),
    fetchedAt: Math.floor(Date.now() / 1000),
    totalCount: totalRow?.n ?? 0,
  };

  await cachePut(CACHE_KEY, payload, TTL_S);
  return jsonResponse(payload);
}
