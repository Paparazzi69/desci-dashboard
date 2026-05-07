// POST /cron/elfa-healthcheck
//
// Bearer-auth-gated daily ping of GET /v2/key-status (Elfa says this call
// costs 0 credits). Stores the response in elfa_health_log so the admin
// dashboard can show "X bonus credits remaining, expires YYYY-MM-DD" and
// warn before the 2026-05-31 expiry.

import { jsonResponse, requireAdminAuth } from '../_shared.js';
import { elfaGet } from '../_shared/elfa.js';

export async function onRequest({ request, env }) {
  const denied = requireAdminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB not configured' }, 500);

  const checkedAt = Math.floor(Date.now() / 1000);

  let data;
  try {
    data = await elfaGet(env, '/v2/key-status');
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: String(e?.message || e),
    }, 502);
  }

  // Elfa wraps the payload as { success, data: { … } }. Be defensive ·
  // we don't want a schema tweak on their end to break the cron.
  const d = (data && typeof data === 'object' && data.data) ? data.data : data;
  const bonus = Number(d?.bonusCreditsRemaining ?? d?.bonus_credits_remaining ?? d?.bonusCredits ?? null);
  const monthly = Number(d?.usage?.monthly ?? d?.monthlyUsage ?? d?.monthly_usage ?? null);
  const expires = d?.bonusCreditsExpiresAt ?? d?.expiresAt ?? d?.expires_at ?? null;

  try {
    await env.DB.prepare(
      `INSERT INTO elfa_health_log
         (checked_at, bonus_credits_remaining, monthly_usage, expires_at, raw_json)
         VALUES (?, ?, ?, ?, ?)`
    ).bind(
      checkedAt,
      Number.isFinite(bonus) ? bonus : null,
      Number.isFinite(monthly) ? monthly : null,
      expires ? String(expires) : null,
      JSON.stringify(data).slice(0, 8000),
    ).run();
  } catch (e) {
    console.warn('elfa-healthcheck: insert failed', e);
  }

  return jsonResponse({
    ok: true,
    checkedAt,
    bonusCreditsRemaining: Number.isFinite(bonus) ? bonus : null,
    monthlyUsage: Number.isFinite(monthly) ? monthly : null,
    expiresAt: expires ?? null,
  });
}
