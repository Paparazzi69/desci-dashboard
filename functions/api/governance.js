// GET /api/governance
// Live Snapshot governance liveness for the DeSci DAOs behind tracked projects.
// Powers the "governance" chip on the BioAgent Tracker (data/bioagents.json
// `govSpace` fields). Extends the liveness theme (code repo, token, and now
// DAO governance) with the same two-tier KV cache as /api/openlabs.
//
// Signal per space: when did the DAO last put up a proposal, is anything live
// right now, and how deep is its proposal history. A flagship DAO going quiet
// in governance is a real, non-obvious health signal.
//
// Response shape:
//   { spaces: { "<space.eth>": { name, lastProposal, lastState, proposals, active, followers, url } }, fetchedAt, stale? }

import {
  jsonResponse, cacheGet, cachePut, kvGetStale, kvRefreshStale,
} from '../_shared.js';

// Snapshot space ids, verified 2026-07-01 against hub.snapshot.org (name +
// followers matched the project). Only spaces that genuinely belong to the DAO
// behind a tracked project — never a name match.
const SPACES = [
  'vote.vitadao.eth',   // VitaDAO  -> aubrai, vitastem, vitarna
  'psydao.eth',         // PsyDAO   -> beeard
  'cerebrumdao.eth',    // CerebrumDAO -> percepta
  'athenadao.eth',      // AthenaDAO -> athenadao
  'hairdao.eth',        // HairDAO (Verified List)
  'genomesdao.eth',     // GenomesDAO (token index)
];

const HUB = 'https://hub.snapshot.org/graphql';
const FRESH_TTL_S = 60 * 60 * 6;    // 6h — proposals don't appear minute-to-minute
const STALE_TTL_S = 60 * 60 * 24;   // 24h KV backup for Snapshot outages
const CACHE_KEY = 'governance:v1';

async function gql(query) {
  const r = await fetch(HUB, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`Snapshot ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error(`Snapshot gql: ${JSON.stringify(j.errors).slice(0, 120)}`);
  return j.data;
}

export async function onRequest({ env }) {
  const fresh = await cacheGet(CACHE_KEY);
  if (fresh) return jsonResponse(fresh);

  try {
    // One query for space metadata, then the latest proposal per space. The
    // latest-proposal calls run in parallel; a single failure drops that space
    // rather than the whole endpoint.
    const idsArg = JSON.stringify(SPACES);
    const meta = await gql(`query { spaces(where:{id_in:${idsArg}}, first:30){ id name followersCount proposalsCount activeProposals } }`);
    const metaById = {};
    (meta.spaces || []).forEach(s => { metaById[s.id] = s; });

    const settled = await Promise.allSettled((meta.spaces || []).map(async (s) => {
      const d = await gql(`query { proposals(first:1, where:{space:"${s.id}"}, orderBy:"created", orderDirection:desc){ created state } }`);
      const p = (d.proposals || [])[0] || null;
      return [s.id, {
        name: s.name,
        lastProposal: p ? new Date(p.created * 1000).toISOString().slice(0, 10) : null,
        lastState: p ? p.state : null,
        proposals: s.proposalsCount ?? null,
        active: s.activeProposals ?? 0,
        followers: s.followersCount ?? null,
        url: `https://snapshot.org/#/${s.id}`,
      }];
    }));

    const spaces = {};
    settled.forEach(res => { if (res.status === 'fulfilled') spaces[res.value[0]] = res.value[1]; });
    if (!Object.keys(spaces).length) throw new Error('no spaces resolved');

    const payload = { spaces, fetchedAt: new Date().toISOString() };
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
