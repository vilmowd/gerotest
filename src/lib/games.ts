import gamesData from '../data/games.json';
import { remapGameCategory } from './categories';
import { isFamilySafeGame } from './content-safety';

export type Game = {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructions: string;
  category: string;
  tags: string[];
  thumb: string;
  url: string;
  width: number;
  height: number;
  publishedAt: string;
  source?: string;
};

export type CategoryCount = {
  name: string;
  count: number;
};

type GamesFile = {
  generatedAt?: string;
  source?: string;
  count?: number;
  games: Game[];
};

const data = gamesData as GamesFile;
const rawGames: Game[] = (data.games ?? []).map((g) => remapGameCategory(g as Game));

/** Public catalog — Ports excluded; family/AdSense keyword screen applied */
export const allGames: Game[] = rawGames.filter(isFamilySafeGame);

export function getGameBySlug(slug: string): Game | undefined {
  return allGames.find((g) => g.slug === slug);
}

export function getGamesByCategory(category: string): Game[] {
  if (!category || category === 'All') return allGames;
  return allGames.filter(
    (g) => g.category.toLowerCase() === category.toLowerCase(),
  );
}

export function getSimilarGames(game: Game, limit = 4): Game[] {
  return allGames
    .filter((g) => g.slug !== game.slug && g.category === game.category)
    .slice(0, limit);
}

export function takeFullRows<T>(items: T[], columns: number): T[] {
  if (columns <= 0 || items.length < columns) return items;
  return items.slice(0, Math.floor(items.length / columns) * columns);
}

export function getTrendingGames(limit = 6): Game[] {
  const sorted = [...allGames].sort((a, b) =>
    String(b.publishedAt).localeCompare(String(a.publishedAt)),
  );
  return sorted.slice(0, limit);
}

export function getPopularGames(limit = 12, offset = 0): Game[] {
  if (!allGames.length) return [];
  const out: Game[] = [];
  const start = offset % allGames.length;
  for (let i = 0; i < Math.min(limit, allGames.length); i++) {
    out.push(allGames[(start + i * 7) % allGames.length]);
  }
  const seen = new Set<string>();
  return out.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

export function getPopularInCategory(category: string, limit = 8): Game[] {
  return getGamesByCategory(category).slice(0, limit);
}

export function getTopCategories(limit = 6): CategoryCount[] {
  return getCategoriesWithContent().slice(0, limit);
}

/** Stable URL slug for a category name, e.g. "3D" → "3d". */
export function categorySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryPath(name: string): string {
  return `/category/${categorySlug(name)}/`;
}

export function getCategoriesWithContent(): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const game of allGames) {
    const name = (game.category || '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
