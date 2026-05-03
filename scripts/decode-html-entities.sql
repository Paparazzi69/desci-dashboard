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
