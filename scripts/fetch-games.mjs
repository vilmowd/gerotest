#!/usr/bin/env node
/**
 * Fetches free HTML5 games from GameMonetize / GameArter and writes
 * a normalized src/data/games.json. Falls back to mock data offline.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'games.json');
const INDEX_PATH = join(__dirname, '..', 'public', 'games-index.json');
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const CATALOG_MAX = Number(process.env.CATALOG_MAX || 2500);

const GAMEARTER_FEED =
  'https://www.gamearter.com/api/v1/catalog/games';
const PORTED2BROWSER_INDEX =
  'https://ported2browser.org/games/index.md';
/** Pull the full directory by default (override with PORTED2BROWSER_MAX=N) */
const PORTED2BROWSER_MAX = Number(process.env.PORTED2BROWSER_MAX || 500);

/** Multiple GameMonetize feed shapes to maximize unique HTML5 titles */
const GAMEMONETIZE_FEEDS = [
  'https://gamemonetize.com/feed.php?format=0&num=1000',
  'https://gamemonetize.com/feed.php?format=0&num=500',
  'https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=newest&company=All&amount=100',
  'https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=mostplayed&company=All&amount=100',
  'https://rss.gamemonetize.com/rssfeed.php?format=json&category=All&type=html5&popularity=hottest&company=All&amount=100',
  // Common category IDs used by the RSS builder (best-effort; bad IDs are skipped)
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
    (id) =>
      `https://rss.gamemonetize.com/rssfeed.php?format=json&category=${id}&type=html5&popularity=newest&company=All&amount=100`,
  ),
];

/** Canonical display names for known feed categories / aliases */
/** Broad genres only — never single-game franchise names */
const CATEGORY_MAP = {
  '3d': '3D',
  '.io': 'IO',
  io: 'IO',
  action: 'Action',
  adventure: 'Adventure',
  ai: 'Arcade',
  arcade: 'Arcade',
  'baby hazel': 'Girls',
  babyhazel: 'Girls',
  bejeweled: 'Puzzle',
  board: 'Puzzle',
  boys: 'Boys',
  bubble: 'Puzzle',
  casual: 'Hypercasual',
  clicker: 'Clicker',
  cooking: 'Cooking',
  dressup: 'Girls',
  'dress-up': 'Girls',
  driving: 'Racing',
  educational: 'Educational',
  fighting: 'Fighting',
  fps: 'Shooting',
  girls: 'Girls',
  hypercasual: 'Hypercasual',
  idle: 'Clicker',
  jewel: 'Puzzle',
  jewels: 'Puzzle',
  matching: 'Puzzle',
  match3: 'Puzzle',
  'match-3': 'Puzzle',
  multiplayer: 'Multiplayer',
  '2 player': 'Multiplayer',
  '2-player': 'Multiplayer',
  platformer: 'Arcade',
  ports: 'Ports',
  puzzle: 'Puzzle',
  puzzles: 'Puzzle',
  racing: 'Racing',
  rpg: 'Adventure',
  shooting: 'Shooting',
  shooter: 'Shooting',
  simulation: 'Simulation',
  skill: 'Arcade',
  soccer: 'Sports',
  football: 'Sports',
  sports: 'Sports',
  stickman: 'Stickman',
  strategy: 'Strategy',
};

const ALLOWED_CATEGORIES = new Set([
  '3D',
  'Action',
  'Adventure',
  'Arcade',
  'Boys',
  'Clicker',
  'Cooking',
  'Educational',
  'Fighting',
  'Girls',
  'Hypercasual',
  'IO',
  'Multiplayer',
  'Ports',
  'Puzzle',
  'Racing',
  'Shooting',
  'Simulation',
  'Sports',
  'Stickman',
  'Strategy',
]);

function slugify(text) {
  return String(text || 'game')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'game';
}

function uniqueSlug(base, used) {
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i++}`;
  }
  used.add(slug);
  return slug;
}

function titleCaseCategory(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.toUpperCase() === '3D' || word.toUpperCase() === 'IO') {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeCategory(raw) {
  const key = String(raw || '')
    .toLowerCase()
    .split(/[,|/]/)[0]
    .trim();
  if (!key) return 'Arcade';
  if (CATEGORY_MAP[key]) return CATEGORY_MAP[key];
  const compact = key.replace(/\s+/g, '');
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (compact === k.replace(/\s+/g, '')) return v;
  }
  if (/hazel|barbie|princess/.test(key)) return 'Girls';
  if (/bejeweled|jewel|candy\s*crush|match\s*3|mahjong/.test(key)) return 'Puzzle';
  const titled = titleCaseCategory(key);
  if (ALLOWED_CATEGORIES.has(titled)) return titled;
  return 'Arcade';
}

function parseTags(raw) {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,|]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isHttpsUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    return u.protocol === 'https:' && !u.username && !u.password && Boolean(u.hostname);
  } catch {
    return false;
  }
}

function normalizeGame(raw, source, usedSlugs) {
  const title =
    raw.title || raw.name || raw.game_name || raw.gameName || 'Untitled Game';
  const id = String(
    raw.id || raw.game_id || raw.gameId || `${source}-${slugify(title)}`,
  );
  const slug = uniqueSlug(slugify(title), usedSlugs);
  const description =
    raw.description ||
    raw.desc ||
    raw.game_description ||
    `Play ${title} online for free in your browser.`;
  const instructions =
    raw.instructions ||
    raw.controls ||
    raw.howtoplay ||
    'Use keyboard or touch controls. Click / tap to start.';
  const category = normalizeCategory(
    raw.category || raw.genre || raw.categories || raw.type,
  );
  const tags = parseTags(raw.tags || raw.keywords || category);
  const thumb =
    raw.thumb ||
    raw.thumbnail ||
    raw.image ||
    raw.thumb_1 ||
    raw.banner_image ||
    '';
  const url =
    raw.url ||
    raw.game_url ||
    raw.embed ||
    raw.embed_url ||
    raw.iframe ||
    raw.link ||
    '';
  if (!url || !isHttpsUrl(url)) return null;
  const thumbUrl = String(thumb || '').trim();
  if (thumbUrl && !thumbUrl.startsWith('/') && !isHttpsUrl(thumbUrl)) {
    // Drop unsafe remote thumbs; keep empty so UI uses local fallback
  }

  return {
    id,
    slug,
    title: String(title).trim().slice(0, 160),
    description: String(description).trim().slice(0, 1200),
    instructions: String(instructions).trim().slice(0, 2000),
    category,
    tags: tags.length ? tags : [category.toLowerCase()],
    thumb: thumbUrl && (thumbUrl.startsWith('/') || isHttpsUrl(thumbUrl)) ? thumbUrl : '',
    url: String(url).trim(),
    width: toInt(raw.width, 800),
    height: toInt(raw.height, 600),
    publishedAt:
      raw.publishedAt ||
      raw.published ||
      raw.date ||
      raw.created_at ||
      new Date().toISOString().slice(0, 10),
    source,
  };
}

function mockGames() {
  const samples = [
    {
      id: 'mock-neon-dash',
      title: 'Neon Dash Runner',
      description:
        'Sprint through glowing cyber tunnels, dodge laser gates, and collect energy orbs before the timer runs out.',
      instructions:
        'Desktop: Arrow keys or A/D to move, Space to jump. Mobile: swipe left/right, tap to jump.',
      category: 'Action',
      tags: ['runner', 'endless', 'neon'],
      thumb: 'https://placehold.co/600x400/0ea5e9/0b0f1a?text=Neon+Dash',
      url: 'https://html5.gamemonetize.com/placeholder/neon-dash/',
      width: 960,
      height: 540,
    },
    {
      id: 'mock-block-fusion',
      title: 'Block Fusion Puzzle',
      description:
        'Merge matching blocks to clear the board. Plan ahead—one wrong move can lock the grid.',
      instructions:
        'Click or tap two adjacent matching blocks. Create combos of 3+ for bonus points.',
      category: 'Puzzle',
      tags: ['merge', 'match', 'casual'],
      thumb: 'https://placehold.co/600x400/8b5cf6/0b0f1a?text=Block+Fusion',
      url: 'https://html5.gamemonetize.com/placeholder/block-fusion/',
      width: 720,
      height: 1280,
    },
    {
      id: 'mock-turbo-drift',
      title: 'Turbo Drift Arena',
      description:
        'Race tight city circuits with arcade handling. Drift corners, hit nitro pads, and beat the ghost lap.',
      instructions:
        'Arrow keys / WASD to steer and accelerate. Space for handbrake drift. Shift for nitro.',
      category: 'Racing',
      tags: ['cars', 'drift', '3d'],
      thumb: 'https://placehold.co/600x400/f43f5e/0b0f1a?text=Turbo+Drift',
      url: 'https://html5.gamemonetize.com/placeholder/turbo-drift/',
      width: 1280,
      height: 720,
    },
    {
      id: 'mock-pixel-invaders',
      title: 'Pixel Invaders Retro',
      description:
        'Defend the last arcade cabinet from waves of pixel aliens. Upgrade weapons between rounds.',
      instructions:
        'Move with Left/Right arrows. Fire with Space or tap the fire button on mobile.',
      category: 'Arcade',
      tags: ['shooter', 'retro', 'waves'],
      thumb: 'https://placehold.co/600x400/34d399/0b0f1a?text=Pixel+Invaders',
      url: 'https://html5.gamemonetize.com/placeholder/pixel-invaders/',
      width: 800,
      height: 600,
    },
    {
      id: 'mock-orb-clash',
      title: 'Orb Clash Arena',
      description:
        'Real-time multiplayer arena where you grow by absorbing orbs and outmaneuvering rivals.',
      instructions:
        'Move with mouse or WASD. Hold Left Click to dash. Avoid larger players.',
      category: 'Multiplayer',
      tags: ['io', 'pvp', 'arena'],
      thumb: 'https://placehold.co/600x400/fbbf24/0b0f1a?text=Orb+Clash',
      url: 'https://html5.gamemonetize.com/placeholder/orb-clash/',
      width: 1024,
      height: 576,
    },
    {
      id: 'mock-shadow-strike',
      title: 'Shadow Strike Ops',
      description:
        'Stealth-action missions across rooftops. Take down targets quietly or go loud with dual pistols.',
      instructions:
        'WASD to move, Mouse to aim, Left Click shoot, E for silent takedown, Q for gadgets.',
      category: 'Shooting',
      tags: ['stealth', 'shooter', 'missions'],
      thumb: 'https://placehold.co/600x400/64748b/0b0f1a?text=Shadow+Strike',
      url: 'https://html5.gamemonetize.com/placeholder/shadow-strike/',
      width: 1280,
      height: 720,
    },
    {
      id: 'mock-hex-logic',
      title: 'Hex Logic Lab',
      description:
        'Rotate hexagonal tiles to reconnect circuits. Increasingly complex boards with limited moves.',
      instructions:
        'Click a hex to rotate clockwise. Clear the board before moves run out.',
      category: 'Clicker',
      tags: ['logic', 'hex', 'brain'],
      thumb: 'https://placehold.co/600x400/06b6d4/0b0f1a?text=Hex+Logic',
      url: 'https://html5.gamemonetize.com/placeholder/hex-logic/',
      width: 900,
      height: 900,
    },
    {
      id: 'mock-sky-rally',
      title: 'Sky Rally Championship',
      description:
        'High-altitude racing with jet cars. Collect rings for boost and avoid storm turbulence.',
      instructions:
        'Arrow keys to bank and throttle. Hold Space for afterburner when boost meter is full.',
      category: 'Sports',
      tags: ['flying', 'championship', 'boost'],
      thumb: 'https://placehold.co/600x400/3b82f6/0b0f1a?text=Sky+Rally',
      url: 'https://html5.gamemonetize.com/placeholder/sky-rally/',
      width: 1280,
      height: 720,
    },
    {
      id: 'mock-candy-pop',
      title: 'Candy Pop Blast',
      description:
        'Classic arcade match-blast. Chain colorful candies, trigger rockets, and chase high scores.',
      instructions:
        'Swipe or drag to swap adjacent candies. Match 3 or more to clear them.',
      category: 'Girls',
      tags: ['match3', 'casual', 'score'],
      thumb: 'https://placehold.co/600x400/ec4899/0b0f1a?text=Candy+Pop',
      url: 'https://html5.gamemonetize.com/placeholder/candy-pop/',
      width: 720,
      height: 1280,
    },
    {
      id: 'mock-tower-rush',
      title: 'Tower Rush Defense',
      description:
        'Build towers, upgrade paths, and stop waves of bots from reaching your core.',
      instructions:
        'Select a tower from the bottom bar and place it on empty tiles. Press Start Wave when ready.',
      category: 'Adventure',
      tags: ['tower-defense', 'strategy', 'waves'],
      thumb: 'https://placehold.co/600x400/10b981/0b0f1a?text=Tower+Rush',
      url: 'https://html5.gamemonetize.com/placeholder/tower-rush/',
      width: 1024,
      height: 768,
    },
    {
      id: 'mock-slide-sokoban',
      title: 'Slide Sokoban Mini',
      description:
        'Push crates onto targets in compact warehouse puzzles. Minimal moves, maximum brainpower.',
      instructions:
        'Arrow keys / swipe to move. Undo with Z or the Undo button. Restart resets the level.',
      category: 'Hypercasual',
      tags: ['sokoban', 'push', 'levels'],
      thumb: 'https://placehold.co/600x400/a855f7/0b0f1a?text=Slide+Sokoban',
      url: 'https://html5.gamemonetize.com/placeholder/slide-sokoban/',
      width: 800,
      height: 800,
    },
    {
      id: 'mock-lane-dash',
      title: 'Lane Dash Classic',
      description:
        'Pick a lane, dodge traffic, and survive as long as possible in this pure arcade reflex game.',
      instructions:
        'Left/Right arrows or tap sides to change lanes. Collect coins, avoid crashes.',
      category: '3D',
      tags: ['reflex', 'lanes', 'endless'],
      thumb: 'https://placehold.co/600x400/f97316/0b0f1a?text=Lane+Dash',
      url: 'https://html5.gamemonetize.com/placeholder/lane-dash/',
      width: 540,
      height: 960,
    },
  ];

  const used = new Set();
  return samples.map((g) =>
    normalizeGame(
      {
        ...g,
        publishedAt: '2024-01-15',
      },
      'mock',
      used,
    ),
  );
}

async function fetchText(url, timeoutMs = 20000) {
  if (!isHttpsUrl(url)) throw new Error(`Refusing non-HTTPS fetch: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/json, text/plain, text/markdown, */*',
        'User-Agent': 'GeroforgeGamePortalFetcher/1.0',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_RESPONSE_BYTES) {
      throw new Error(`Response too large (${len} bytes) for ${url}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(`Response too large (${buf.byteLength} bytes) for ${url}`);
    }
    return new TextDecoder('utf-8').decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = 15000) {
  const text = await fetchText(url, timeoutMs);
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Invalid JSON response');
  }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return (
    payload.games ||
    payload.data ||
    payload.items ||
    payload.results ||
    payload.catalog ||
    []
  );
}

async function fetchFromGameMonetize(usedSlugs) {
  const seenIds = new Set();
  const out = [];

  for (const feedUrl of GAMEMONETIZE_FEEDS) {
    try {
      const data = await fetchJson(feedUrl, 20000);
      const list = extractList(data);
      let added = 0;
      for (const item of list) {
        const game = normalizeGame(item, 'gamemonetize', usedSlugs);
        if (!game) continue;
        const key = game.url.toLowerCase();
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        out.push(game);
        added += 1;
      }
      console.log(`  · GM feed ok (+${added}) ${feedUrl.split('?')[0]}…`);
    } catch (err) {
      console.warn(`  · GM feed skip: ${err.message}`);
    }
  }

  return out;
}

async function fetchFromGameArter(usedSlugs) {
  const data = await fetchJson(GAMEARTER_FEED);
  const list = extractList(data);
  return list
    .map((item) => normalizeGame(item, 'gamearter', usedSlugs))
    .filter(Boolean);
}

function parsePortedIndex(markdown) {
  const entries = [];
  const re =
    /- \[([^\]]+)\]\(<([^>]+)>\)\s*—\s*([^\n]+)/g;
  let match;
  while ((match = re.exec(markdown))) {
    entries.push({
      title: match[1].trim(),
      pageUrl: match[2].trim(),
      blurb: match[3].trim(),
    });
  }
  return entries;
}

function portedSlugFromPageUrl(pageUrl) {
  const match = String(pageUrl).match(/\/games\/([^/]+)/i);
  return match?.[1] || slugify(pageUrl);
}

function extractPortedCoverFromHtml(html, slug) {
  const safeSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1) Explicit "Cover artwork" image for this page
  const byAlt =
    html.match(
      new RegExp(
        `src="(https://cdn\\.ported2browser\\.org/images/(?:covers|generated)/[^"]+)"[^>]*alt="Cover artwork`,
        'i',
      ),
    ) ||
    html.match(
      new RegExp(
        `alt="Cover artwork[^"]*"[^>]*src="(https://cdn\\.ported2browser\\.org/images/(?:covers|generated)/[^"]+)"`,
        'i',
      ),
    );
  if (byAlt?.[1]) return byAlt[1].replace(/\?.*$/, '');

  // 2) fetchpriority="high" hero cover
  const byPriority = html.match(
    /src="(https:\/\/cdn\.ported2browser\.org\/images\/(?:covers|generated)\/[^"]+)"[^>]*fetchpriority="high"/i,
  );
  if (byPriority?.[1]) return byPriority[1].replace(/\?.*$/, '');

  // 3) Any CDN image whose filename includes this game slug
  const bySlug = html.match(
    new RegExp(
      `cdn\\.ported2browser\\.org/images/(?:covers|generated)/[^"'\\s>]*${safeSlug}[^"'\\s>]*\\.webp`,
      'i',
    ),
  );
  if (bySlug?.[0]) return `https://${bySlug[0].replace(/\?.*$/, '')}`;

  return null;
}

async function resolvePortedThumbnail(entry) {
  const slug = portedSlugFromPageUrl(entry.pageUrl);
  const coverGuess = `https://cdn.ported2browser.org/images/covers/${slug}.webp`;
  try {
    const head = await fetch(coverGuess, {
      method: 'HEAD',
      headers: { 'User-Agent': 'GeroforgeGamePortalFetcher/1.0' },
    });
    if (head.ok) return coverGuess;
  } catch {
    // continue to HTML scrape
  }

  const htmlUrl = `https://ported2browser.org/games/${slug}/`;
  try {
    const html = await fetchText(htmlUrl);
    const fromHtml = extractPortedCoverFromHtml(html, slug);
    if (fromHtml) return fromHtml;
  } catch {
    // fall through
  }

  // Last resort: Steam store capsule (best-effort artwork)
  try {
    const steamRes = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(entry.title)}&l=english&cc=US`,
      { headers: { 'User-Agent': 'GeroforgeGamePortalFetcher/1.0' } },
    );
    if (steamRes.ok) {
      const steam = await steamRes.json();
      const item = steam.items?.[0];
      if (item?.id) {
        return `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/capsule_616x353.jpg`;
      }
    }
  } catch {
    // ignore
  }

  return `https://placehold.co/640x400/0b0f1a/9fd4b8?text=${encodeURIComponent(entry.title.slice(0, 28))}`;
}

function parsePortedGamePage(markdown, meta, thumb) {
  const genre =
    markdown.match(/- Genre:\s*([^\n]+)/i)?.[1]?.trim() || 'Ports';
  const platform =
    markdown.match(/- Original platform:\s*([^\n]+)/i)?.[1]?.trim() ||
    'PC / Console';
  const year = markdown.match(/- Year:\s*([^\n]+)/i)?.[1]?.trim() || '';
  const controls =
    markdown.match(/- Controls:\s*([^\n]+)/i)?.[1]?.trim() ||
    'Keyboard / mouse / gamepad depending on the port project.';
  const projectMatch = markdown.match(
    /- Project:\s*\[([^\]]+)\]\(<([^>]+)>\)/i,
  );
  const playUrl = projectMatch?.[2]?.trim();
  if (!playUrl) return null;

  const summary =
    markdown
      .split('\n')
      .map((l) => l.trim())
      .find(
        (l) =>
          l &&
          !l.startsWith('#') &&
          !l.startsWith('-') &&
          !l.startsWith('Source:') &&
          !l.startsWith('Also known') &&
          !l.startsWith('A listing describes'),
      ) || meta.blurb;

  return {
    id: `p2b-${slugify(meta.title)}`,
    title: meta.title,
    description: `${summary} Discovered via Ported2Browser directory of browser ports.`,
    instructions: `This is a third-party browser port (${platform}${year ? `, ${year}` : ''}). Controls: ${controls}. Some ports may require your own legally owned game files or may block embedding — use “Open original site” if the frame stays blank.`,
    category: 'Ports',
    tags: [
      'ports',
      'ported2browser',
      genre.toLowerCase(),
      platform.toLowerCase().split(',')[0].trim(),
    ].filter(Boolean),
    thumb,
    url: playUrl,
    width: 960,
    height: 600,
    publishedAt: new Date().toISOString().slice(0, 10),
    directoryUrl: meta.pageUrl.replace(/index\.md$/, ''),
  };
}

async function fetchFromPorted2Browser(usedSlugs) {
  const indexMd = await fetchText(PORTED2BROWSER_INDEX);
  const entries = parsePortedIndex(indexMd).slice(0, PORTED2BROWSER_MAX);
  if (!entries.length) return [];

  const pages = await mapPool(entries, 6, async (entry) => {
    try {
      const [md, thumb] = await Promise.all([
        fetchText(entry.pageUrl),
        resolvePortedThumbnail(entry),
      ]);
      return parsePortedGamePage(md, entry, thumb);
    } catch {
      return null;
    }
  });

  return pages
    .filter(Boolean)
    .map((item) => normalizeGame(item, 'ported2browser', usedSlugs))
    .filter(Boolean);
}

function dedupeByUrl(games) {
  const seen = new Set();
  const out = [];
  for (const g of games) {
    const key = g.url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

async function main() {
  const usedSlugs = new Set();
  let games = [];
  let source = 'mock';

  try {
    console.log('Fetching GameMonetize feed…');
    const gm = await fetchFromGameMonetize(usedSlugs);
    if (gm.length) {
      games = gm;
      source = 'gamemonetize';
      console.log(`  ✓ ${gm.length} games from GameMonetize`);
    } else {
      console.log('  ⚠ Empty GameMonetize response');
    }
  } catch (err) {
    console.warn(`  ✗ GameMonetize failed: ${err.message}`);
  }

  if (games.length < 12) {
    try {
      console.log('Fetching GameArter catalog…');
      const ga = await fetchFromGameArter(usedSlugs);
      if (ga.length) {
        games = dedupeByUrl([...games, ...ga]);
        source = games.some((g) => g.source === 'gamemonetize')
          ? 'mixed'
          : 'gamearter';
        console.log(`  ✓ Added GameArter games (total ${games.length})`);
      }
    } catch (err) {
      console.warn(`  ✗ GameArter failed: ${err.message}`);
    }
  }

  // Ports omitted by default for AdSense safety. Set INCLUDE_PORTS=1 to fetch them.
  if (process.env.INCLUDE_PORTS === '1') {
    try {
      console.log('Fetching Ported2Browser directory (INCLUDE_PORTS=1)…');
      const ports = await fetchFromPorted2Browser(usedSlugs);
      if (ports.length) {
        games = dedupeByUrl([...games, ...ports]);
        source = source === 'mock' ? 'ported2browser' : 'mixed';
        console.log(`  ✓ ${ports.length} browser ports from Ported2Browser (total ${games.length})`);
      } else {
        console.log('  ⚠ No Ported2Browser games parsed');
      }
    } catch (err) {
      console.warn(`  ✗ Ported2Browser failed: ${err.message}`);
    }
  } else {
    console.log('Skipping Ported2Browser (AdSense-safer). Set INCLUDE_PORTS=1 to enable.');
  }

  if (!games.length) {
    console.log('Using built-in mock catalog (12 sample games).');
    games = mockGames();
    source = 'mock';
  }

  games = dedupeByUrl(games)
    .filter((g) => isHttpsUrl(g.url))
    .slice(0, CATALOG_MAX);

  const payload = {
    generatedAt: new Date().toISOString(),
    source,
    count: games.length,
    games,
  };

  // Slim public index for fast client features (no embed URLs — reduces abuse surface)
  const slimIndex = {
    generatedAt: payload.generatedAt,
    count: games.length,
    games: games.map((g) => ({
      s: g.slug,
      t: g.title,
      c: g.category,
      i: g.thumb || '',
    })),
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await mkdir(dirname(INDEX_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(INDEX_PATH, `${JSON.stringify(slimIndex)}\n`, 'utf8');
  console.log(`Wrote ${games.length} games → ${OUT_PATH} (source: ${source})`);
  console.log(`Wrote slim index → ${INDEX_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
