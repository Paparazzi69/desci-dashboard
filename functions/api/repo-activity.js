// GET /api/repo-activity
// Live GitHub activity for the handful of tracked DeSci projects that ship a
// real, verified public codebase. Powers the "code liveness" badge on the
// BioAgent Tracker (data/bioagents.json `github` fields). Same two-tier KV
// cache as /api/openlabs.
//
// Only repos whose ownership was confirmed against the project's OWN site are
// listed here — never a name match. Verified 2026-07-01 (GitHub API + primary
// source per repo). Most tracked projects ship tokens, not code, and have no
// entry here by design.
//
// Response shape:
//   { repos: { "owner/repo": { lastCommit, archived, stars, url } }, fetchedAt, stale? }

import {
  jsonResponse, cacheGet, cachePut, kvGetStale, kvRefreshStale,
} from '../_shared.js';

// owner/repo slugs. Casing must match the `github` field in bioagents.json so
// the frontend can key the badge off this response.
const REPOS = [
  'snap-stanford/Biomni',            // biomni       — Stanford SNAP-lab agent
  'moleculeprotocol/science.beach',  // science-beach — OpenLabs codebase of record
  'MycoDAO/Blocks',                  // mycodao      — DAO ops/broadcast platform
  'bio-xyz/ClawdLab',                // clawdlab     — autonomous-research platform
  'bio-xyz/BioAgents',               // aubrai       — shared framework (archived)
];

const GH = 'https://api.github.com/repos/';
const FRESH_TTL_S = 60 * 60 * 6;    // 6h — commits don't move minute-to-minute
const STALE_TTL_S = 60 * 60 * 24;   // 24h KV backup for GitHub outages / rate limits
const CACHE_KEY = 'repo-activity:v1';

async function ghRepo(slug) {
  // GitHub rejects requests without a User-Agent. Unauthenticated limit is
  // 60/hr per IP; the 6h cache means we hit GitHub a handful of times per
  // window, well under it.
  const r = await fetch(GH + slug, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'descidash-repo-activity',
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} for ${slug}`);
  const d = await r.json();
  return {
    lastCommit: (d.pushed_at || '').slice(0, 10) || null,
    archived: !!d.archived,
    stars: d.stargazers_count ?? null,
    url: d.html_url || `https://github.com/${slug}`,
  };
}

export async function onRequest({ env }) {
  const fresh = await cacheGet(CACHE_KEY);
  if (fresh) return jsonResponse(fresh);

  try {
    // allSettled so a single repo's rate-limit/outage doesn't blank the rest —
    // a missing repo just drops its badge rather than failing the endpoint.
    const settled = await Promise.allSettled(REPOS.map(slug => ghRepo(slug)));
    const repos = {};
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') repos[REPOS[i]] = res.value;
    });
    if (!Object.keys(repos).length) throw new Error('all repo fetches failed');

    const payload = { repos, fetchedAt: new Date().toISOString() };
    await Promise.all([
      cachePut(CACHE_KEY, payload, FRESH_TTL_S),
      kvRefreshStale(env, CACHE_KEY, payload, STALE_TTL_S),
    ]);
    return jsonResponse(payload);
  } catch (e) {
    const stale = await kvGetStale(env, CACHE_KEY);
    if (stale) return jsonResponse({ ...stale, stale: true, error: String(e.message || e) });
    return jsonResponse({ error: String(e.message || e) }, 502);
  }
}
