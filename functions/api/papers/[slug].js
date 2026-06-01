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

// Two query modes, both still server-side and curated:
//   mode: 'author'  — papers BY the project's named scientists. Needs real
//     founder/PI names; `highlight` bolds them client-side. Rich team-track-
//     record signal. (SpineDAO: five founding spine surgeons.)
//   mode: 'project' — papers that NAME the project (funding line, acknowledge-
//     ments, or body text). No scientist names needed; `highlight` is empty so
//     the client just leads with the paper's own first authors. KW topic terms
//     fence out false hits from the bare project string.
// Every query keeps SRC:MED (Medline = peer-reviewed; excludes preprints/books)
// and every returned paper must carry a DOI. Queries are hand-verified against
// live Europe PMC so only papers genuinely tied to the project surface — see
// the per-entry note for what was checked.
const PROJECT_QUERIES = {
  // Five founding spine surgeons. KW topic terms keep the result set tight
  // (Lafage V alone has 339+ Medline papers across multiple domains).
  spinedao: {
    mode: 'author',
    query: '(AUTH:"Lafage V" OR AUTH:"Diebo BG" OR AUTH:"Lonjon G" OR AUTH:"Challier V" OR AUTH:"Cristini J") AND SRC:MED AND (KW:"spine" OR KW:"lumbar" OR KW:"vertebra")',
    label: 'By the founding surgeons',
    highlight: ['Lafage V', 'Diebo BG', 'Lonjon G', 'Challier V', 'Cristini J'],
    exploreUrl: 'https://europepmc.org/search?query=%28AUTH%3A%22Lafage%20V%22%20OR%20AUTH%3A%22Diebo%20BG%22%20OR%20AUTH%3A%22Lonjon%20G%22%20OR%20AUTH%3A%22Challier%20V%22%20OR%20AUTH%3A%22Cristini%20J%22%29%20AND%20SRC%3AMED',
  },

  // project-mode. Bare `"HairDAO" AND SRC:MED` already returns a tight set — all
  // 6 Medline hits are androgenetic-alopecia / follicular-delivery papers from
  // the HairDAO-funded Gelfuso–Gratieri lab (verified live, no topic fence
  // needed). Includes the Clinical & Experimental Dermatology 2025 DOI.
  hairdao: {
    mode: 'project',
    query: '"HairDAO" AND SRC:MED',
    label: 'Peer-reviewed research naming HairDAO',
    highlight: [],
    exploreUrl: 'https://europepmc.org/search?query=' + encodeURIComponent('"HairDAO" AND SRC:MED'),
  },

  // project-mode. The bare string alone pulls an unrelated HIV-burden paper via
  // a funding mention, so a longevity KW fence is required — with it, all top
  // hits are aging/senescence work (senescence biomarker, Clinical Trials
  // Targeting Aging, NAD+ in aging). Verified live against Europe PMC.
  vitadao: {
    mode: 'project',
    query: '"VitaDAO" AND SRC:MED AND (KW:"aging" OR KW:"longevity" OR KW:"senescence" OR KW:"ageing")',
    label: 'Aging research naming VitaDAO',
    highlight: [],
    exploreUrl: 'https://europepmc.org/search?query=' + encodeURIComponent('"VitaDAO" AND SRC:MED AND (KW:"aging" OR KW:"longevity" OR KW:"senescence")'),
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
