/**
 * Broad genre labels only — never single-game franchise categories.
 * Applied at catalog load and in fetch-games normalization.
 */
const CATEGORY_ALIASES: Record<string, string> = {
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
  bubbleshooter: 'Puzzle',
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
  mahjong: 'Puzzle',
  matching: 'Puzzle',
  match3: 'Puzzle',
  'match-3': 'Puzzle',
  merge: 'Puzzle',
  multiplayer: 'Multiplayer',
  '2 player': 'Multiplayer',
  '2-player': 'Multiplayer',
  twoplayer: 'Multiplayer',
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
  basketball: 'Sports',
  sports: 'Sports',
  stickman: 'Stickman',
  strategy: 'Strategy',
};

/** Allowed broad categories shown in the UI (others get remapped or become Arcade) */
const ALLOWED = new Set([
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

function titleCaseCategory(value: string): string {
  return value
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

/** Normalize a raw feed / JSON category into a broad genre label */
export function normalizeCategory(raw: string | null | undefined): string {
  const key = String(raw || '')
    .toLowerCase()
    .split(/[,|/]/)[0]
    .trim();
  if (!key) return 'Arcade';

  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];

  const compact = key.replace(/\s+/g, '');
  for (const [alias, label] of Object.entries(CATEGORY_ALIASES)) {
    if (compact === alias.replace(/\s+/g, '')) return label;
  }

  // Title-branded leftovers → nearest broad genre
  if (/hazel|barbie|frozen|princess/.test(key)) return 'Girls';
  if (/bejeweled|jewel|candy\s*crush|match\s*3|mahjong/.test(key)) return 'Puzzle';

  const titled = titleCaseCategory(key);
  if (ALLOWED.has(titled)) return titled;
  return 'Arcade';
}

export function remapGameCategory<T extends { category: string }>(game: T): T {
  return { ...game, category: normalizeCategory(game.category) };
}
