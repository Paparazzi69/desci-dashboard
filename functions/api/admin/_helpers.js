// Shared body for the three status-mutation admin endpoints. Each one
// (approve / feature / reject) is a thin wrapper that supplies a target
// status; everything else — id parsing, validation, DB write, response —
// lives here.
//
// "Your take" is the editorial note the operator attaches to a story
// before publishing it through /api/feed-v2. Optional on approve, required
// on feature (a featured item without commentary is just a louder bare
// link). Reject leaves the take column alone — pending rows have no take
// to begin with, and we don't want to overwrite anything by accident.

import { jsonResponse } from '../../_shared.js';

export async function setStatus(request, env, status) {
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  let body;
  try { body = await request.json(); } catch { body = null; }
  const id = body && typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonResponse({ error: 'missing id' }, 400);

  const rawTake = body && typeof body.take === 'string' ? body.take : '';
  const take = rawTake.trim() || null;

  if (status === 'featured' && !take) {
    return jsonResponse({ error: 'take required for featured items' }, 400);
  }

  const stmt = status === 'rejected'
    ? env.DB.prepare('UPDATE news_items SET status = ? WHERE id = ?').bind(status, id)
    : env.DB.prepare('UPDATE news_items SET status = ?, take = ? WHERE id = ?').bind(status, take, id);

  const result = await stmt.run();
  const changed = result.meta?.changes || 0;
  if (!changed) return jsonResponse({ error: 'not found' }, 404);

  return jsonResponse({ ok: true, id, status, take }, 200, { 'cache-control': 'no-store' });
}
