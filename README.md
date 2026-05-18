# DeSci Dashboard

A curated tracker for the Decentralized Science (DeSci) sector. Live token
prices via CoinGecko and GeckoTerminal, plus hand-curated deep dives on the
BioAgents, IP-Tokens, and platforms driving the space. Static frontend on
Cloudflare Pages with a thin layer of Pages Functions for API proxying and
KV caching.

> **Live target:** [descidash.com](https://descidash.com)

## What's on the site

- **Main dashboard** (`/`): live token index, sector bubble map, narrative
  filters, and per-token drawers with sparklines, FDV, ATH/ATL.
- **BioAgent Tracker** (`/bioagent-tracker`): four-tab view of 25 tracked
  BioAgents, IPTs, platforms, and adjacent projects with status, chain,
  pipeline stage, and last-signal date.
- **Project deep dives** (`/projects/<slug>`): in-depth curated pages on
  AUBRAI, PeptAI, SpineDAO, Science Beach, and OX2R-004.
- **Methodology** (`/methodology`): how projects are sourced, scored, and
  verified. Editorial criteria, primary sources, conflict-of-interest
  statement, and changelog.
- **Privacy** (`/privacy`): no accounts, no analytics, no tracking.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Static frontend (HTML / CSS / vanilla ES modules)       │
│  index.html  ·  /assets/css  ·  /assets/js               │
└──────────────────────────────────────────────────────────┘
                           │
                           │  /api/prices  /api/coin/:id
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Cloudflare Pages Functions (/functions)                 │
│  • Proxy CoinGecko (key stays server-side)               │
│  • Proxy GeckoTerminal (free, no key)                    │
│  • Cache in KV ("CACHE" binding)                         │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
                  CoinGecko · GeckoTerminal
```

- **No build step.** No npm install. The frontend is plain HTML/CSS/JS using
  native ES modules — open `index.html` directly to inspect.
- **All external API calls happen server-side.** The browser only ever talks
  to `/api/*` on this same origin, so the CoinGecko key is never exposed and
  CORS is never a problem.
- **Frontend bundle** is well under 200 KB excluding fonts.

## UX principle: graceful degradation

Every external dependency on this dashboard can fail. We treat that as a
first-class concern, not an afterthought:

| Failure mode | What the user sees | What's actually happening |
| --- | --- | --- |
| CoinGecko hits a 429 rate limit | LIVE indicator turns **amber** ("STALE"), top-of-page banner explains | Pages Function serves a stale cache stored in KV with a longer TTL |
| CoinGecko is unreachable on first load | Empty-state card: "Couldn't load prices. Retrying every 60s." | Frontend keeps polling; once a response lands, the table fills in live |
| GeckoTerminal times out for a Solana/Base token | That row falls back to last known cached values | Per-row TTL is shortened so the next refresh retries |
| Network slow / drawer detail fetch hangs | Drawer opens immediately with the data we already have; description shows "Loading…" until it arrives | `/api/coin/:id` is awaited but never blocks the drawer from opening |

The LIVE indicator in the header is the single source of truth for data
freshness — green = fresh (< 90s old), amber = stale, red = offline,
muted = still loading.

## Local development (optional)

You can preview locally with Wrangler:

```bash
npm i -g wrangler              # one-time
wrangler pages dev . --kv CACHE
```

Or just open `index.html` in a browser — the frontend will fail at `/api/*`
calls and you'll see the empty states (which is also a useful test).

To pass a CoinGecko API key locally, create `.dev.vars`:

```
COINGECKO_API_KEY=your_demo_key_here
```

## Deploy to Cloudflare Pages

These are the manual steps. **Do them in order.**

### 1. Get a CoinGecko Demo API key

Sign up free at [coingecko.com/en/developers/dashboard](https://www.coingecko.com/en/developers/dashboard).
Generate a Demo tier key. Copy it — you'll paste it in step 4.

### 2. Connect this repo to Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize Cloudflare to access your GitHub account if you haven't already.
3. Select the `Paparazzi69/desci-dashboard` repo.
4. **Build configuration:**
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: `/` *(yes, the project root)*
   - Root directory: *(leave blank)*
5. Click **Save and Deploy.** The first build will fail or 500 because the KV
   binding isn't wired up yet — that's expected. Continue to step 3.

After this step you'll have an assigned URL like
`https://desci-dashboard.pages.dev` (or `<random-slug>-desci-dashboard.pages.dev`).

### 3. Create the KV namespace and bind it

1. In the Cloudflare dashboard go to **Workers & Pages** → **KV** → **Create a namespace.**
2. Name it `desci-dashboard-cache` (the name on disk doesn't matter, only the binding name does).
3. Open your Pages project → **Settings** → **Functions** → **KV namespace bindings** → **Add binding.**
4. **Variable name:** `CACHE` (must match exactly — the Functions look for `env.CACHE`).
5. **KV namespace:** select the one you just created.
6. Click **Save.**

### 4. Add the CoinGecko API key

In the same project's **Settings** → **Environment variables** → **Production**:

1. **Add variable.**
2. **Name:** `COINGECKO_API_KEY`
3. **Value:** *(paste the key from step 1)*
4. Click **Encrypt** before saving (so it's stored as a secret, not plain text).
5. **Save.**

### 5. Trigger a fresh deploy

Either push any new commit to `main`, or in the dashboard:
**Deployments** → **(your project)** → **Retry deployment** on the latest one.

Within ~30 seconds the site should be live at
`https://desci-dashboard.pages.dev` with real CoinGecko prices.

### 6. Verify it works

Open the dashboard and check:

- [ ] LIVE indicator goes green within ~5 seconds of page load
- [ ] At least 9 ETH tokens populate the table (BIO, VITA, TRAC, RSC, etc.)
- [ ] GeckoTerminal-sourced rows (AUBRAI, SYNA, SpineDAO, PEPTAI) populate
- [ ] Sparklines render on every row
- [ ] Filter chips work (try "Longevity" or "Micro-caps")
- [ ] Clicking a row opens the drawer with description, stats, links
- [ ] Sector Bubble Map renders below the sector cards

If the LIVE indicator stays amber, check the Pages Function logs in the
dashboard — almost always it means the KV binding isn't named exactly
`CACHE`, or the CoinGecko key has a typo.

## Configuration reference

| File | What it controls |
| --- | --- |
| `wrangler.toml` | Cloudflare Pages config. `pages_build_output_dir = "."` is the only required line — KV bindings are easier to configure in the dashboard. |
| `assets/js/data.js` | Token classification (focus, tags, chain, isMicroCap, twitter). **Keyed by CoinGecko id** — never hardcode symbol → id mapping. |
| `functions/_shared.js` | The list of CoinGecko ids to fetch (`TOKEN_IDS`) and the GeckoTerminal contract map (`GT_TOKENS`). Edit here when you add a new token to the index. |
| `data/milestones.json` | Hardcoded research milestones rendered at the bottom of the page. |

## Costs

- **Cloudflare Pages:** free tier (500 builds/month, unlimited bandwidth).
- **Cloudflare KV:** free tier (100k reads/day, 1k writes/day) is more than
  enough — the cache TTLs (60s for prices, 5m for drawer details) keep us
  well under.
- **CoinGecko Demo:** free tier, ~30 calls/min. With server-side 60s caching
  the dashboard makes at most 1 call/min regardless of visitor count.
- **GeckoTerminal:** free, no key. Soft limit ~30 req/min, well under the
  cache layer's needs.

Total cost at small/medium scale: **$0/month**.

## License

MIT.
