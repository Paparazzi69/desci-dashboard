// POST /api/admin/feature  { id }
// Marks a news item as featured → /api/feed-v2 returns it with featured=true.

import { requireAdminAuth } from '../../_shared.js';
import { setStatus } from './_helpers.js';

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  return setStatus(request, env, 'featured');
}
