// GET /api/research-pulse
// Live window into the OpenLabs research commons for the /research page.
// Aggregates totals, trending hypotheses, newest projects, and active topics
// from the OpenLabs public API. Same proxy + two-tier KV cache pattern as
// /api/openlabs. The post `author` object (PII) is never read or forwarded.
//
// Response shape:
//   { totals:    { posts, claims, discussions, topics, contributors },
//     trending:  [ { id, title, topic, project, upvotes, comments } ],
//     projects:  [ { id, title, summary, status } ],
//     topics:    [ { name, slug, emoji, posts, contributors } ],
//     fetchedAt, stale?: boolean }

import {
  jsonResponse, cacheGet, cachePut, kvGetStale, kvRefreshStale,
} from '../_shared.js';

const API = 'https://api.openlabs.bio.xyz/api/v1';
const FRESH_TTL_S = 60 * 15;       // 15 min (trending moves; cache spares upstream)
const STALE_TTL_S = 60 * 60 * 12;  // 12h KV backup for OpenLabs outages
const CACHE_KEY = 'research-pulse:v3';

async function getJson(path) {
  const r = await fetch(API + path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`OpenLabs ${r.status} for ${path}`);
  return r.json();
}

const mapPost = (p) => ({
  id: p.id,
  title: p.title,
  topic: (p.topic && p.topic.name) || null,
  project: (p.project && p.project.title) || null,
  upvotes: p.upvote_count || 0,
  comments: p.comment_count || 0,
});

// DeSci-relevant coves. OpenLabs is a general-science commons (Physics, Math,
// Climate, etc.); descidash is a DeSci tracker, so the Pulse feed is scoped to
// the biomedical / DeSci topics. Tunable: add a slug + name to widen coverage.
const DESCI_SLUGS = new Set([
  'longevity-aging', 'medicine-health', 'biology-life-sciences', 'neuroscience-brain',
  'chemistry-materials', 'peptide-rd', 'tacrolimus-pharmacogenomics', 'general-science',
  'marine-biology',
]);
const DESCI_TOPIC_NAMES = new Set([
  'Longevity & Aging', 'Medicine & Health', 'Biology & Life Sciences', 'Neuroscience & Brain',
  'Chemistry & Materials', 'Peptide R&D', 'Tacrolimus Pharmacogenomics', 'General Science',
  'Marine Biology',
]);

export async function onRequest({ env }) {
  const fresh = await cacheGet(CACHE_KEY);
  if (fresh) return jsonResponse(fresh);

  try {
    const [topicsRaw, allHead, claimHead, discHead, claimBatch, projList] = await Promise.all([
      getJson('/topics'),
      getJson('/posts?limit=1'),
      getJson('/posts?type=claim&limit=1'),
      getJson('/posts?type=discussion&limit=1'),
      getJson('/posts?type=claim&sort=latest&limit=50'),
      getJson('/projects?limit=8'),
    ]);

    const topicsArr = Array.isArray(topicsRaw) ? topicsRaw : [];
    const topics = topicsArr
      .map(t => ({ name: t.name, slug: t.slug, emoji: t.emoji, posts: t.post_count || 0, contributors: t.contributor_count || 0 }))
      .filter(t => DESCI_SLUGS.has(t.slug))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 8);

    const payload = {
      totals: {
        posts: allHead.total ?? null,
        claims: claimHead.total ?? null,
        discussions: discHead.total ?? null,
        topics: topicsArr.length || null,
        contributors: topicsArr.reduce((s, t) => s + (t.contributor_count || 0), 0),
      },
      // "Trending" = most-engaged of the recent claim batch (upvotes + comments
      // + reactions). The upstream `sort=trending` is recency-weighted and floods
      // the top with brand-new 0-engagement claims, so we rank the batch here.
      trending: ((claimBatch && claimBatch.data) || [])
        .filter(p => !p.topic || DESCI_TOPIC_NAMES.has(p.topic.name))
        .sort((a, b) =>
          ((b.upvote_count || 0) + (b.comment_count || 0) + (b.reaction_count || 0)) -
          ((a.upvote_count || 0) + (a.comment_count || 0) + (a.reaction_count || 0)))
        .slice(0, 8)
        .map(mapPost),
      projects: ((projList && projList.data) || [])
        .map(p => ({ id: p.id, title: p.title, summary: (p.summary || '').replace(/\s+/g, ' ').slice(0, 160), status: p.status || null }))
        .slice(0, 6),
      topics,
      fetchedAt: new Date().toISOString(),
    };

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
