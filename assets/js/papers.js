// Shared hydrator for the live peer-reviewed papers block.
// Finds every .papers-block[data-papers-project] on the page and fills it from
// /api/papers/<slug> (Europe PMC, Medline-filtered, server-side curated query).
// Used by /papers, where several projects render at once. Mirrors the SpineDAO
// deep-dive hydration (assets/js/spinedao.js "Papers block" section) but loops
// over all blocks and renders both query modes:
//   author-mode  → founders bolded and led, co-authors demoted ("· with X et al.")
//   project-mode → no founders; just the paper's own leading authors
// On fetch failure the skeleton is left in place — a quietly absent block beats
// a broken-looking one.
(function () {
  var blocks = document.querySelectorAll('.papers-block[data-papers-project]');
  for (var i = 0; i < blocks.length; i++) hydratePapers(blocks[i]);

  async function hydratePapers(el) {
    var slug = el.dataset.papersProject;
    try {
      var r = await fetch('/api/papers/' + encodeURIComponent(slug), {
        headers: { accept: 'application/json' },
      });
      if (!r.ok) throw new Error('papers ' + r.status);
      var json = await r.json();
      renderPapers(el, json);
    } catch (err) {
      console.warn('[papers] fetch failed for ' + slug + ':', err);
    }
  }

  function renderPapers(el, json) {
    var list = el.querySelector('[data-papers-list]');
    var exploreLink = el.querySelector('[data-papers-explore]');
    var papers = Array.isArray(json.papers) ? json.papers : [];
    if (json.exploreUrl && exploreLink) exploreLink.href = json.exploreUrl;
    if (!list || !papers.length) {
      // Empty payload — keep the skeleton so layout height doesn't collapse.
      return;
    }
    list.innerHTML = papers.map(paperRowHtml).join('');
  }

  function paperRowHtml(p) {
    var title   = escapeHtml(p.title || '');
    var authors = renderAuthors(p.authors);
    var journal = p.journal ? '<span class="journal">' + escapeHtml(p.journal) + '</span>' : '';
    var year    = p.year || '';
    var cited   = (p.citedBy > 0) ? '<span class="cited">' + p.citedBy + '</span> cited' : '';
    var meta    = [year, journal, cited].filter(Boolean).join(' · ');
    var href    = p.doi ? 'https://doi.org/' + encodeURI(p.doi) : '#';
    return '' +
      '<li class="paper-row">' +
        '<a class="paper-title-link" href="' + href + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' +
        '<div class="paper-meta">' + meta + '</div>' +
        '<div class="paper-authors">' + authors + '</div>' +
      '</li>';
  }

  // Structured authors object: { founders, others, moreOthers }.
  //   author-mode  → "<b>Lafage V</b> · with Schwab F, Patel A et al."
  //   project-mode → founders is empty, so just "Andrade JFM, Verbinnen A et al."
  function renderAuthors(a) {
    if (!a) return '';
    var founders = Array.isArray(a.founders) ? a.founders : [];
    var others = Array.isArray(a.others) ? a.others.map(escapeHtml) : [];
    var tail = others.join(', ') + (a.moreOthers ? ' et al.' : '');
    if (founders.length) {
      var founderHtml = founders.map(function (n) { return '<b>' + escapeHtml(n) + '</b>'; }).join(', ');
      return tail ? founderHtml + ' <span class="with">· with ' + tail + '</span>' : founderHtml;
    }
    return tail;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
