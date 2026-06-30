// GET /api/openlabs
// Live platform metrics for the Science Beach -> OpenLabs deep dive.
//
// Science Beach (beach.science) folded into OpenLabs (openlabs.bio.xyz) on
// 2026-06-19; the old beach.science API now returns HTTP 410 Gone. This proxies
// the OpenLabs public API (api.openlabs.bio.xyz, keyless + CORS-open) and returns
// a compact, cached payload so the deep-dive page never talks to a third party
// directly and survives an OpenLabs outage.
//
// Response shape:
//   { totals:    { posts, claims, discussions, topics, contributors },
//     topics:    [ { name, slug, emoji, posts, contributors, comments } ],
//     hypotheses:[ { title, topic, project, upvotes, comments, reactions, createdAt } ],
//     projects:  [ { title, summary } ],
//     fetchedAt, stale?: boolean }
//
// The post `author` object on the upstream API carries personal data and is
// intentionally never read or forwarded. Counts and titles only.

import {
  jsonResponse, cacheGet, cachePut, kvGetStale, kvRefreshStale,
} from '../_shared.js';

const API = 'https://api.openlabs.bio.xyz/api/v1';
const FRESH_TTL_S = 60 * 60 * 3;     // 3h fresh (platform counters move slowly)
const STALE_TTL_S = 60 * 60 * 24;    // 24h KV backup for OpenLabs outages
const CACHE_KEY = 'openlabs:v1';

async function getJson(path) {
  const r = await fetch(API + path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`OpenLabs ${r.status} for ${path}`);
  return r.json();
}

export async function onRequest({ env }) {
  const fresh = await cacheGet(CACHE_KEY);
  if (fresh) return jsonResponse(fresh);

  try {
    // One batched fan-out. /posts returns {data,total,limit,offset}; the head
    // calls (limit=1) are just for the `total` count per post type.
    const [topicsRaw, allHead, claimHead, discHead, claimList, projList] = await Promise.all([
      getJson('/topics'),
      getJson('/posts?limit=1'),
      getJson('/posts?type=claim&limit=1'),
      getJson('/posts?type=discussion&limit=1'),
      getJson('/posts?type=claim&limit=30&sort=latest'),
      getJson('/projects?limit=10'),
    ]);

    const topics = (Array.isArray(topicsRaw) ? topicsRaw : [])
      .map(t => ({
        name: t.name,
        slug: t.slug,
        emoji: t.emoji,
        posts: t.post_count || 0,
        contributors: t.contributor_count || 0,
        comments: t.comment_count || 0,
      }))
      .sort((a, b) => b.posts - a.posts);

    // Notable hypotheses: rank the latest claim batch by engagement. Author is
    // never touched (PII); body is dropped, title + counts only.
    const hypotheses = ((claimList && claimList.data) || [])
      .map(p => ({
        id: p.id,
        title: p.title,
        topic: (p.topic && p.topic.name) || null,
        project: (p.project && p.project.title) || null,
        upvotes: p.upvote_count || 0,
        comments: p.comment_count || 0,
        reactions: p.reaction_count || 0,
        createdAt: p.created_at || null,
      }))
      .sort((a, b) => (b.upvotes + b.reactions + b.comments) - (a.upvotes + a.reactions + a.comments))
      .slice(0, 6);

    const projects = ((projList && projList.data) || [])
      .map(p => ({ id: p.id, title: p.title, summary: (p.summary || '').replace(/\s+/g, ' ').slice(0, 220) }))
      .slice(0, 6);

    const payload = {
      totals: {
        posts: allHead.total ?? null,
        claims: claimHead.total ?? null,
        discussions: discHead.total ?? null,
        topics: topics.length,
        contributors: topics.reduce((s, t) => s + t.contributors, 0),
      },
      topics: topics.slice(0, 10),
      hypotheses,
      projects,
      fetchedAt: new Date().toISOString(),
    };

    await Promise.all([
      cachePut(CACHE_KEY, payload, FRESH_TTL_S),
      kvRefreshStale(env, CACHE_KEY, payload, STALE_TTL_S),
    ]);
    return jsonResponse(payload);
  } catch (e) {
    // OpenLabs unreachable -> serve last-good payload from KV if we have one.
    const stale = await kvGetStale(env, CACHE_KEY);
    if (stale) return jsonResponse({ ...stale, stale: true, error: String(e.message || e) });
    return jsonResponse({ error: String(e.message || e) }, 502);
  }
}
