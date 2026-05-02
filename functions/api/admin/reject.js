// POST /api/admin/reject  { id }
// Marks a news item as rejected → never returned by /api/feed-v2 and
// hidden from the admin queue. Row is kept (not deleted) so its URL
// stays in the dedup set and the same article can't get re-pending'd.

import { requireAdminAuth } from '../../_shared.js';
import { setStatus } from './_helpers.js';

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  return setStatus(request, env, 'rejected');
}
