// GET /api/admin/pending
// Bearer-auth-gated. Returns the most recent pending news items for the
// admin triage UI. No edge cache — always fresh from D1 so approve/reject
// actions reflect immediately.

import { jsonResponse, requireAdminAuth } from '../../_shared.js';

const LIMIT = 200;

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const rows = (await env.DB.prepare(
    `SELECT id, source, source_type, title, url, summary, author, category, published_at, fetched_at
       FROM news_items
      WHERE status = 'pending'
      ORDER BY published_at DESC
      LIMIT ?`
  ).bind(LIMIT).all()).results || [];

  return jsonResponse({
    items: rows.map(r => ({
      id: r.id,
      source: r.source,
      sourceType: r.source_type,
      title: r.title,
      url: r.url,
      summary: r.summary || '',
      author: r.author || null,
      category: r.category || 'other',
      publishedAt: r.published_at,
      fetchedAt: r.fetched_at,
    })),
    count: rows.length,
  }, 200, { 'cache-control': 'no-store' });
}
