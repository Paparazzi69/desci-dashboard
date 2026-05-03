-- One-off cleanup for rows ingested before the decodeEntities fix.
-- Each UPDATE is idempotent (REPLACE on a string without the needle is a
-- no-op), so re-running this script is safe. After the JS fix is deployed
-- new rows are decoded at insert time, so this is for the historical
-- backlog only — not a recurring maintenance step.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=scripts/decode-html-entities.sql
--
-- Spot-check after:
--   wrangler d1 execute DB --remote \
--     --command="SELECT id, source, title FROM news_items WHERE title LIKE '%&#%' OR summary LIKE '%&#%'"

-- &amp; first so any double-encoded entities collapse correctly.
UPDATE news_items SET title   = REPLACE(title,   '&amp;', '&');
UPDATE news_items SET summary = REPLACE(summary, '&amp;', '&');

-- Numeric decimal entities seen in current rows + likely siblings.
UPDATE news_items SET title   = REPLACE(title,   '&#8217;', char(8217));   -- '
UPDATE news_items SET summary = REPLACE(summary, '&#8217;', char(8217));
UPDATE news_items SET title   = REPLACE(title,   '&#8216;', char(8216));   -- '
UPDATE news_items SET summary = REPLACE(summary, '&#8216;', char(8216));
UPDATE news_items SET title   = REPLACE(title,   '&#8220;', char(8220));   -- "
UPDATE news_items SET summary = REPLACE(summary, '&#8220;', char(8220));
UPDATE news_items SET title   = REPLACE(title,   '&#8221;', char(8221));   -- "
UPDATE news_items SET summary = REPLACE(summary, '&#8221;', char(8221));
UPDATE news_items SET title   = REPLACE(title,   '&#8230;', char(8230));   -- …
UPDATE news_items SET summary = REPLACE(summary, '&#8230;', char(8230));
UPDATE news_items SET title   = REPLACE(title,   '&#8211;', char(8211));   -- –
UPDATE news_items SET summary = REPLACE(summary, '&#8211;', char(8211));
UPDATE news_items SET title   = REPLACE(title,   '&#8212;', char(8212));   -- —
UPDATE news_items SET summary = REPLACE(summary, '&#8212;', char(8212));
UPDATE news_items SET title   = REPLACE(title,   '&#183;',  char(183));    -- ·
UPDATE news_items SET summary = REPLACE(summary, '&#183;',  char(183));
UPDATE news_items SET title   = REPLACE(title,   '&#160;',  ' ');          -- nbsp
UPDATE news_items SET summary = REPLACE(summary, '&#160;',  ' ');
UPDATE news_items SET title   = REPLACE(title,   '&#39;',   char(39));     -- '
UPDATE news_items SET summary = REPLACE(summary, '&#39;',   char(39));
UPDATE news_items SET title   = REPLACE(title,   '&#34;',   char(34));     -- "
UPDATE news_items SET summary = REPLACE(summary, '&#34;',   char(34));

-- Common named entities.
UPDATE news_items SET title   = REPLACE(title,   '&quot;',  char(34));
UPDATE news_items SET summary = REPLACE(summary, '&quot;',  char(34));
UPDATE news_items SET title   = REPLACE(title,   '&apos;',  char(39));
UPDATE news_items SET summary = REPLACE(summary, '&apos;',  char(39));
UPDATE news_items SET title   = REPLACE(title,   '&nbsp;',  ' ');
UPDATE news_items SET summary = REPLACE(summary, '&nbsp;',  ' ');
UPDATE news_items SET title   = REPLACE(title,   '&lt;',    '<');
UPDATE news_items SET summary = REPLACE(summary, '&lt;',    '<');
UPDATE news_items SET title   = REPLACE(title,   '&gt;',    '>');
UPDATE news_items SET summary = REPLACE(summary, '&gt;',    '>');
UPDATE news_items SET title   = REPLACE(title,   '&hellip;', char(8230));
UPDATE news_items SET summary = REPLACE(summary, '&hellip;', char(8230));
UPDATE news_items SET title   = REPLACE(title,   '&mdash;', char(8212));
UPDATE news_items SET summary = REPLACE(summary, '&mdash;', char(8212));
UPDATE news_items SET title   = REPLACE(title,   '&ndash;', char(8211));
UPDATE news_items SET summary = REPLACE(summary, '&ndash;', char(8211));
UPDATE news_items SET title   = REPLACE(title,   '&lsquo;', char(8216));
UPDATE news_items SET summary = REPLACE(summary, '&lsquo;', char(8216));
UPDATE news_items SET title   = REPLACE(title,   '&rsquo;', char(8217));
UPDATE news_items SET summary = REPLACE(summary, '&rsquo;', char(8217));
UPDATE news_items SET title   = REPLACE(title,   '&ldquo;', char(8220));
UPDATE news_items SET summary = REPLACE(summary, '&ldquo;', char(8220));
UPDATE news_items SET title   = REPLACE(title,   '&rdquo;', char(8221));
UPDATE news_items SET summary = REPLACE(summary, '&rdquo;', char(8221));

-- ── Hex entities — added after second spot-check found 9 rows still dirty.
-- SQL REPLACE is case-sensitive, so each x/X prefix and hex-digit a/A case
-- gets its own pair. Going forward the JS regex /&#x[0-9a-f]+;/gi catches
-- all of these on ingest; this block is for the historical backlog only.

-- &#x2013; / 0x2013 = en dash (–)
UPDATE news_items SET title   = REPLACE(title,   '&#x2013;', char(8211));
UPDATE news_items SET summary = REPLACE(summary, '&#x2013;', char(8211));
UPDATE news_items SET title   = REPLACE(title,   '&#X2013;', char(8211));
UPDATE news_items SET summary = REPLACE(summary, '&#X2013;', char(8211));

-- &#x2014; / 0x2014 = em dash (—)
UPDATE news_items SET title   = REPLACE(title,   '&#x2014;', char(8212));
UPDATE news_items SET summary = REPLACE(summary, '&#x2014;', char(8212));
UPDATE news_items SET title   = REPLACE(title,   '&#X2014;', char(8212));
UPDATE news_items SET summary = REPLACE(summary, '&#X2014;', char(8212));

-- &#x2018; / 0x2018 = left single quote (')
UPDATE news_items SET title   = REPLACE(title,   '&#x2018;', char(8216));
UPDATE news_items SET summary = REPLACE(summary, '&#x2018;', char(8216));
UPDATE news_items SET title   = REPLACE(title,   '&#X2018;', char(8216));
UPDATE news_items SET summary = REPLACE(summary, '&#X2018;', char(8216));

-- &#x2019; / 0x2019 = right single quote (')
UPDATE news_items SET title   = REPLACE(title,   '&#x2019;', char(8217));
UPDATE news_items SET summary = REPLACE(summary, '&#x2019;', char(8217));
UPDATE news_items SET title   = REPLACE(title,   '&#X2019;', char(8217));
UPDATE news_items SET summary = REPLACE(summary, '&#X2019;', char(8217));

-- &#x201C; / 0x201C = left double quote (")
UPDATE news_items SET title   = REPLACE(title,   '&#x201C;', char(8220));
UPDATE news_items SET summary = REPLACE(summary, '&#x201C;', char(8220));
UPDATE news_items SET title   = REPLACE(title,   '&#x201c;', char(8220));
UPDATE news_items SET summary = REPLACE(summary, '&#x201c;', char(8220));
UPDATE news_items SET title   = REPLACE(title,   '&#X201C;', char(8220));
UPDATE news_items SET summary = REPLACE(summary, '&#X201C;', char(8220));
UPDATE news_items SET title   = REPLACE(title,   '&#X201c;', char(8220));
UPDATE news_items SET summary = REPLACE(summary, '&#X201c;', char(8220));

-- &#x201D; / 0x201D = right double quote (")
UPDATE news_items SET title   = REPLACE(title,   '&#x201D;', char(8221));
UPDATE news_items SET summary = REPLACE(summary, '&#x201D;', char(8221));
UPDATE news_items SET title   = REPLACE(title,   '&#x201d;', char(8221));
UPDATE news_items SET summary = REPLACE(summary, '&#x201d;', char(8221));
UPDATE news_items SET title   = REPLACE(title,   '&#X201D;', char(8221));
UPDATE news_items SET summary = REPLACE(summary, '&#X201D;', char(8221));
UPDATE news_items SET title   = REPLACE(title,   '&#X201d;', char(8221));
UPDATE news_items SET summary = REPLACE(summary, '&#X201d;', char(8221));

-- &#x2026; / 0x2026 = horizontal ellipsis (…). Decimal &#8230; was covered
-- earlier; this is the hex form spotted in two truncated summaries.
UPDATE news_items SET title   = REPLACE(title,   '&#x2026;', char(8230));
UPDATE news_items SET summary = REPLACE(summary, '&#x2026;', char(8230));
UPDATE news_items SET title   = REPLACE(title,   '&#X2026;', char(8230));
UPDATE news_items SET summary = REPLACE(summary, '&#X2026;', char(8230));

-- &#xA0; / 0xA0 = non-breaking space
UPDATE news_items SET title   = REPLACE(title,   '&#xA0;', ' ');
UPDATE news_items SET summary = REPLACE(summary, '&#xA0;', ' ');
UPDATE news_items SET title   = REPLACE(title,   '&#xa0;', ' ');
UPDATE news_items SET summary = REPLACE(summary, '&#xa0;', ' ');
UPDATE news_items SET title   = REPLACE(title,   '&#XA0;', ' ');
UPDATE news_items SET summary = REPLACE(summary, '&#XA0;', ' ');
UPDATE news_items SET title   = REPLACE(title,   '&#Xa0;', ' ');
UPDATE news_items SET summary = REPLACE(summary, '&#Xa0;', ' ');

-- ── High-codepoint decimal entities (emoji used in ValleyDAO posts) ──
UPDATE news_items SET title   = REPLACE(title,   '&#128071;', char(128071));   -- 👇
UPDATE news_items SET summary = REPLACE(summary, '&#128071;', char(128071));
UPDATE news_items SET title   = REPLACE(title,   '&#128300;', char(128300));   -- 🔬
UPDATE news_items SET summary = REPLACE(summary, '&#128300;', char(128300));

-- ── Mid-entity truncation cleanup ────────────────────────────────────
-- The legacy decodeEntities only knew 7 entities, so &#8230; etc. got
-- truncated mid-stream by formatSummary. The rtrim chain peels off the
-- damage in order: trailing … (formatSummary's truncation suffix, if
-- present), trailing hex/dec digits, trailing x/X, trailing # and &.
-- Going forward the comprehensive decoder runs before truncation, so
-- this is for the historical backlog only.
UPDATE news_items
SET summary = rtrim(rtrim(rtrim(rtrim(summary,
    char(8230)),
    '0123456789abcdefABCDEF'),
    'xX'),
    '#&')
WHERE
  summary LIKE '%&#'
  OR summary LIKE '%&#_'
  OR summary LIKE '%&#__'
  OR summary LIKE '%&#___'
  OR summary LIKE '%&#____'
  OR summary LIKE '%&#x_'
  OR summary LIKE '%&#x__'
  OR summary LIKE '%&#x___'
  OR summary LIKE '%&#x____';
