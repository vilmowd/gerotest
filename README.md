# Geroforge — Static HTML5 Game Portal

Zero-maintenance, **100% static** browser game portal built with [Astro](https://astro.build) (`output: 'static'`) and Tailwind CSS. Designed for free hosting on **Cloudflare Pages** or **GitHub Pages**.

## Features

- Daily auto-refresh of free HTML5 games via `scripts/fetch-games.mjs` + GitHub Actions
- SEO-ready game pages with Open Graph tags and JSON-LD `VideoGame` schema
- AdSense-safe layout with labeled ad placeholders and `public/ads.txt`
- Legal pages: About, Privacy Policy, Terms, Contact
- Minimal vanilla JS (search, category filters, fullscreen / theater mode)
- Automatic `sitemap-index.xml` via `@astrojs/sitemap`

## Quick start

```bash
npm install
npm run fetch-games   # writes src/data/games.json (falls back to 12 mock games offline)
npm run dev           # http://localhost:4321
npm run build         # static output → dist/
npm run preview       # preview the production build
```

### Environment

Optional: set your production URL so sitemap / canonical / OG URLs are correct:

```bash
# Windows PowerShell
$env:SITE_URL="https://your-domain.com"
npm run build

# macOS / Linux
SITE_URL=https://your-domain.com npm run build
```

Also update `site` in `astro.config.mjs` (or rely on `SITE_URL`) and the `Sitemap:` line in `public/robots.txt`.

## Fetching games

```bash
npm run fetch-games
```

The script tries:

1. [GameMonetize feed](https://gamemonetize.com/feed.php?format=0&num=500)
2. [GameArter catalog](https://www.gamearter.com/api/v1/catalog/games) (fallback)
3. [Ported2Browser](https://ported2browser.org/games/index.md) directory for console/PC browser ports (added as category **Ports**)

If feeds fail (or you’re offline), it writes **12 realistic mock games** so local builds always work.

Port listings point at third-party project sites (via the Ported2Browser directory). Some ports need your own game files or may block iframes — the play page includes an **Open original site** button.

Normalized fields in `src/data/games.json`:

`id`, `slug`, `title`, `description`, `instructions`, `category`, `tags`, `thumb`, `url`, `width`, `height`, `publishedAt`

## GitHub Actions auto-updater

`.github/workflows/update-games.yml` runs daily at `03:00 UTC` and on `workflow_dispatch`. It:

1. Runs `node scripts/fetch-games.mjs`
2. Commits `src/data/games.json` when the catalog changes
3. Pushes to the default branch (which triggers your Pages rebuild)

Enable Actions on the repo and grant the default `GITHUB_TOKEN` write permission (the workflow sets `contents: write`).

## Google AdSense readiness

Before applying / going live:

1. Set a real domain + `SITE_URL` in `src/data/site.ts`
2. Replace `adsenseClient` with your `ca-pub-…` ID and fill `adsenseSlots`
3. Replace `googleAnalyticsId` with your GA4 `G-…` ID
4. Copy Google’s exact line into `public/ads.txt` (never leave `pub-XXXXXXXX`)
5. Update Privacy / Terms / security.txt to match your identity
6. Prefer Cloudflare Pages so `_headers` (CSP allowing AdSense + Analytics) apply

Cookie popup: visitors must **Accept all** before AdSense/GA scripts load, or **Reject non-essential** for essential storage only (Google Consent Mode defaults stay denied).

Adult-keyword listings and **Ports / Ported2Browser** are excluded from the public catalog for AdSense safety. Set `INCLUDE_PORTS=1` when fetching only if you intentionally want ports back. Ad units only render when a real publisher ID + slot IDs are configured; they are labeled and kept outside the play frame.

To grow the catalog: `npm run fetch-games`. Cap: `CATALOG_MAX=2500` (default).

## Security & performance

Built-in hardening for a static game portal:

- **HTTP headers** via `public/_headers` (Cloudflare Pages): CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP
- **Meta CSP** fallback for hosts without custom headers (e.g. plain GitHub Pages)
- **Click-to-play** + **sandboxed** HTTPS-only game iframes (no auto-load of third-party embeds)
- **Self-hosted fonts** (no Google Fonts third-party requests)
- **Catalog fetch** rejects non-HTTPS URLs, caps response size, writes a slim `public/games-index.json` (no embed URLs)
- **Caching**: long-cache hashed `/_astro/*` assets; HTML always revalidated
- **Dependabot** weekly npm + Actions updates

Update `public/.well-known/security.txt` canonical URLs before go-live.

## Deploy to Railway

No database required. Railway builds the static Astro site and serves `dist/` with Node.

1. Push this repo to GitHub (or deploy from the Railway CLI).
2. In Railway → **New Project** → **Deploy from GitHub** → select this repo.
3. Set environment variables:
   - `SITE_URL` = your Railway domain (e.g. `https://geroforge-production.up.railway.app`) or custom domain
4. Railway uses `railway.toml` / `nixpacks.toml`:
   - **Build:** `npm run build`
   - **Start:** `npm start` (serves `dist/` on `$PORT`)
5. Optional custom domain: Railway project → **Settings** → **Networking** → generate domain / add custom domain.
6. After the first deploy, update `SITE_URL` to the final public URL and redeploy so sitemap/canonicals match.

Local check:

```bash
npm run build && npm start
```

Optional: refresh the catalog during build on Railway by changing the build command to:

```text
npm run fetch-games && npm run build
```

## Deploy to Cloudflare Pages

1. Push this repo to GitHub (or connect another git remote).
2. In Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Build settings:
   - **Framework preset:** Astro (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `SITE_URL` = `https://your-project.pages.dev` (or your custom domain)
4. **Custom domain:** Pages → your project → **Custom domains** → add the domain and follow DNS instructions (usually a CNAME to `your-project.pages.dev`).
5. Prefer Cloudflare in front of the site so `_headers` (CSP/HSTS/cache) are applied.

Optional: add a build step to refresh games before every deploy:

```text
npm run fetch-games && npm run build
```

## Deploy to GitHub Pages

1. Set `SITE_URL` to `https://<user>.github.io/<repo>` (or your custom domain).
2. Use an Astro/GitHub Pages workflow or Cloudflare-style static deploy of the `dist/` folder.
3. If the site is served from a subpath, set `base` in `astro.config.mjs` accordingly.

## AdSense & game network IDs

1. **AdSense**
   - Replace `pub-XXXXXXXXXXXXXXXX` in `public/ads.txt`
   - Replace `adsenseClient` in `src/data/site.ts`
   - Add your AdSense script in the site layout when approved (Auto ads can place units without hardcoded placeholders)

2. **GameMonetize / GameArter**
   - Create a publisher account with your chosen network
   - Paste your publisher ID into `src/data/site.ts` (`gamemonetizeId`) and optionally into `public/ads.txt`
   - Prefer official embed URLs from the feed so revenue attribution works

3. **Site identity**
   - Update `name`, `url`, and social handles in `src/data/site.ts`
   - Fill in About / Privacy / Terms copy with your real business details before applying to AdSense

## Project structure

```text
├── .github/workflows/update-games.yml
├── public/
│   ├── ads.txt
│   ├── favicon.svg
│   ├── geroforge-logo.jpg
│   ├── og-default.jpg
│   └── robots.txt
├── scripts/fetch-games.mjs
├── src/
│   ├── components/     # Navbar, Footer, GameCard, GameBanner, CategorySidebar
│   ├── data/           # site.ts + games.json
│   ├── layouts/
│   ├── lib/games.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── privacy-policy.astro
│   │   ├── terms.astro
│   │   └── game/[slug].astro
│   └── styles/global.css
├── astro.config.mjs
└── package.json
```

## License

Site scaffolding is provided as-is for your project. Individual games remain © their respective owners.
