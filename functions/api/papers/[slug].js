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

  // v3 changes `authors` from a string to a {founders, others, moreOthers}
  // shape so the client can render "Lafage V · with Schwab F et al." instead
  // of leading with non-SpineDAO co-authors. Bump on any payload-shape
  // change so callers don't get a stale shape from caches.default or KV.
  const cacheKey = `papers:${slug}:v3`;
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
      authors: shapeAuthors(p.authorString || '', highlight),
      journal: p.journalInfo?.journal?.title || null,
      year: Number(p.pubYear) || null,
      doi: p.doi,
      pmid: p.pmid || null,
      citedBy: Number(p.citedByCount) || 0,
    }));
}

// Splits the author list into founders + everyone else so the client can
// lead with the SpineDAO surgeons and demote unrelated co-authors. Academic
// credit order (first author = primary contributor, last = senior PI) is
// preserved within each group — we don't claim a founder is the lead author
// when they're not, we just re-rank for relevance to this dashboard.
//
// "Schwab F, Patel A, Ungar B, Farcy JP, Lafage V" with founder Lafage V →
//   { founders: ['Lafage V'], others: ['Schwab F', 'Patel A'], moreOthers: true }
function shapeAuthors(s, highlight = []) {
  const cleaned = s.replace(/\.$/, '');
  const parts = cleaned.split(',').map(x => x.trim()).filter(Boolean);
  const founders = parts.filter(p => highlight.includes(p));
  const others = parts.filter(p => !highlight.includes(p));
  const shownOthers = others.slice(0, 2);
  return {
    founders,
    others: shownOthers,
    moreOthers: others.length > shownOthers.length,
  };
}
