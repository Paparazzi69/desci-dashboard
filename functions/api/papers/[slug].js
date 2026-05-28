// GET /api/papers/<slug>
// Returns top-cited peer-reviewed papers for a deep-dive project, queried
// live against Europe PMC. The query map is server-side and curated — each
// project's query is hand-built from known founder names + topic keywords
// so we don't surface noise. Clients only pass the project slug.
//
// Response shape:
//   { slug, label, papers: [...], fetchedAt, stale?: boolean }
// Paper shape:
//   { title, authors, journal, year, doi, pmid, citedBy }
//
// Peer-reviewed filter: SRC:MED restricts to Medline records, which excludes
// preprints, books, and other non-peer-reviewed sources. Every returned
// paper also has a DOI so the title link always resolves.

import {
  jsonResponse, cacheGet, cachePut, kvGetStale, kvRefreshStale,
} from '../../_shared.js';

const PROJECT_QUERIES = {
  // Five founding spine surgeons. KW topic terms keep the result set tight
  // (Lafage V alone has 339+ Medline papers across multiple domains).
  // `highlight` is the canonical founder list — names in this list are kept
  // in the displayed author string even if they appear past position 2, and
  // the client wraps them in <b>. This makes the SpineDAO connection visible
  // per-row instead of requiring the reader to trust the section subtitle.
  spinedao: {
    query: '(AUTH:"Lafage V" OR AUTH:"Diebo BG" OR AUTH:"Lonjon G" OR AUTH:"Challier V" OR AUTH:"Cristini J") AND SRC:MED AND (KW:"spine" OR KW:"lumbar" OR KW:"vertebra")',
    label: 'By the founding surgeons',
    highlight: ['Lafage V', 'Diebo BG', 'Lonjon G', 'Challier V', 'Cristini J'],
    exploreUrl: 'https://europepmc.org/search?query=%28AUTH%3A%22Lafage%20V%22%20OR%20AUTH%3A%22Diebo%20BG%22%20OR%20AUTH%3A%22Lonjon%20G%22%20OR%20AUTH%3A%22Challier%20V%22%20OR%20AUTH%3A%22Cristini%20J%22%29%20AND%20SRC%3AMED',
  },
};

const FRESH_TTL_S = 60 * 60 * 12;       // 12h fresh cache (papers don't move)
const STALE_TTL_S = 60 * 60 * 24 * 7;   // 7d KV backup for EPMC outages
const PAGE_SIZE = 6;

export async function onRequest({ params, env }) {
  const slug = params.slug;
  const cfg = PROJECT_QUERIES[slug];
  if (!cfg) {
    return jsonResponse({ error: 'unknown project', papers: [] }, 404);
  }

  // v2 added `highlightAuthors` to the payload and the founder-pinned author
  // shortening — bump on any payload-shape change so callers don't get a
  // stale shape from caches.default or KV.
  const cacheKey = `papers:${slug}:v2`;
  const fresh = await cacheGet(cacheKey);
  if (fresh) return jsonResponse(fresh);

  try {
    const papers = await fetchEuropePmc(cfg.query, cfg.highlight || []);
    const payload = {
      slug,
      label: cfg.label,
      exploreUrl: cfg.exploreUrl,
      highlightAuthors: cfg.highlight || [],
      papers,
      fetchedAt: new Date().toISOString(),
    };
    await Promise.all([
      cachePut(cacheKey, payload, FRESH_TTL_S),
      kvRefreshStale(env, cacheKey, payload, STALE_TTL_S),
    ]);
    return jsonResponse(payload);
  } catch (e) {
    // EPMC fetch failed — serve the last good payload from KV if any.
    const stale = await kvGetStale(env, cacheKey);
    if (stale) {
      return jsonResponse({ ...stale, stale: true, error: String(e.message || e) });
    }
    return jsonResponse({ error: String(e.message || e), papers: [] }, 502);
  }
}

async function fetchEuropePmc(query, highlight) {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search`
    + `?query=${encodeURIComponent(query)}`
    + `&format=json&pageSize=${PAGE_SIZE * 2}&resultType=core`
    + `&sort=${encodeURIComponent('CITED desc')}`;
  const r = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`Europe PMC ${r.status}`);
  const data = await r.json();
  const results = data.resultList?.result || [];
  // Belt-and-braces: SRC:MED is in the query, but we also enforce it client-
  // side and require a DOI so every title link resolves.
  return results
    .filter(p => p.doi && p.source === 'MED')
    .slice(0, PAGE_SIZE)
    .map(p => ({
      title: (p.title || '').replace(/\.$/, ''),
      authors: shortenAuthors(p.authorString || '', highlight),
      journal: p.journalInfo?.journal?.title || null,
      year: Number(p.pubYear) || null,
      doi: p.doi,
      pmid: p.pmid || null,
      citedBy: Number(p.citedByCount) || 0,
    }));
}

// "Schwab F, Patel A, Ungar B, Farcy JP, Lafage V" → "Schwab F, Patel A,
// Lafage V et al." when Lafage V is in the highlight list. Founder names
// are pinned into the displayed slice so the project connection stays
// visible even when they're past position 2 in the credit order.
function shortenAuthors(s, highlight = []) {
  const cleaned = s.replace(/\.$/, '');
  const parts = cleaned.split(',').map(x => x.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.join(', ');
  const head = parts.slice(0, 2);
  const pinned = highlight.filter(h => parts.includes(h) && !head.includes(h));
  const shown = [...head, ...pinned];
  const more = shown.length < parts.length;
  return shown.join(', ') + (more ? ' et al.' : '');
}
