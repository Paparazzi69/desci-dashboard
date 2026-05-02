// POST /api/admin/approve  { id }
// Marks a news item as approved → it shows up in /api/feed-v2.

import { requireAdminAuth } from '../../_shared.js';
import { setStatus } from './_helpers.js';

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  return setStatus(request, env, 'approved');
}
