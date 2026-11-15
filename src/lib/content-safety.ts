type SafetyGame = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  url: string;
  source?: string;
};

/** Sources / categories excluded for AdSense & family-safe positioning */
export const BLOCKED_SOURCES = new Set(['ported2browser']);
export const BLOCKED_CATEGORIES = new Set(['ports']);

/**
 * Family / AdSense inventory filter.
 * Conservative keyword screen — reduces adult, extreme violence, gambling, and drug content.
 * Not a guarantee that every remaining title is suitable for young children.
 */
const UNSAFE_RE =
  /\b(adult|nsfw|porn|hentai|xxx|nude|naked|sex\b|erotic|18\+|onlyfans|striptease|prostitut|gore|gory|torture|massacre|rape|suicid|self[-\s]?harm|drug\s*deal|cocaine|meth\b|heroin|cannabis\s*shop|weed\s*farm|casino|slot\s*machine|poker\s*real|betting|gambling|loot\s*box\s*real\s*money|bloodbath|dismember|horror\s*porn)\b/i;

const FRANCHISE_PORT_RE =
  /\b(gta\s*[v3]?|grand theft auto|call of duty|modern warfare|cyberpunk\s*2077|hollow knight|cuphead|fifa\s*\d{2}|nba\s*2k|counter[-\s]?strike|half[-\s]?life\b|resident evil|god of war|red dead|assassin'?s creed|elden ring)\b/i;

const PORT_HINT_RE =
  /\b(browser\s*port|web\s*port|emulator|rom\s*hack|romhack|ported\s*to\s*browser|unofficial\s*port)\b/i;

export function isFamilySafeGame(game: SafetyGame): boolean {
  const source = (game.source || '').toLowerCase();
  const category = (game.category || '').trim().toLowerCase();
  if (BLOCKED_SOURCES.has(source)) return false;
  if (BLOCKED_CATEGORIES.has(category)) return false;

  const blob = `${game.title}\n${game.tags.join(' ')}\n${game.description.slice(0, 500)}`;
  if (UNSAFE_RE.test(blob)) return false;

  if (FRANCHISE_PORT_RE.test(game.title) && PORT_HINT_RE.test(blob)) return false;
  if (FRANCHISE_PORT_RE.test(game.title) && /ported2browser|truffled\.lol|webports/i.test(game.url)) {
    return false;
  }

  return true;
}

/** Short audience notice for footers / play pages */
export const AUDIENCE_NOTICE =
  'Geroforge is a general-audience, family-oriented entertainment site. It is not directed to children under 13. Parents and guardians should supervise younger players.';
