const STORAGE_RECENT = 'gf-recent-plays';
const STORAGE_FAVES = 'gf-favorites';
const MAX_RECENT = 16;
const MAX_FAVES = 48;

export type PlayedGame = {
  slug: string;
  title: string;
  thumb: string;
  category: string;
  at: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizePlayed(entry: unknown): PlayedGame | null {
  if (!isPlainObject(entry)) return null;
  const slug = typeof entry.slug === 'string' ? entry.slug.trim().slice(0, 120) : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return null;
  const title = typeof entry.title === 'string' ? entry.title.trim().slice(0, 160) : slug;
  const category =
    typeof entry.category === 'string' ? entry.category.trim().slice(0, 60) : '';
  let thumb = typeof entry.thumb === 'string' ? entry.thumb.trim().slice(0, 500) : '';
  if (thumb && !thumb.startsWith('/') && !/^https:\/\//i.test(thumb)) thumb = '';
  const at = typeof entry.at === 'number' && Number.isFinite(entry.at) ? entry.at : Date.now();
  return { slug, title, thumb, category, at };
}

function readList(key: string): PlayedGame[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 200_000) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizePlayed).filter((g): g is PlayedGame => Boolean(g));
  } catch {
    return [];
  }
}

function writeList(key: string, items: PlayedGame[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* quota / private mode */
  }
}

export function recordPlayed(game: Omit<PlayedGame, 'at'>) {
  const next = [
    { ...game, at: Date.now() },
    ...readList(STORAGE_RECENT).filter((g) => g.slug !== game.slug),
  ].slice(0, MAX_RECENT);
  writeList(STORAGE_RECENT, next);
}

export function getRecentPlays(): PlayedGame[] {
  return readList(STORAGE_RECENT);
}

export function getFavorites(): PlayedGame[] {
  return readList(STORAGE_FAVES);
}

export function isFavorite(slug: string): boolean {
  return getFavorites().some((g) => g.slug === slug);
}

export function toggleFavorite(game: Omit<PlayedGame, 'at'>): boolean {
  const current = getFavorites();
  const exists = current.some((g) => g.slug === game.slug);
  const next = exists
    ? current.filter((g) => g.slug !== game.slug)
    : [{ ...game, at: Date.now() }, ...current].slice(0, MAX_FAVES);
  writeList(STORAGE_FAVES, next);
  return !exists;
}

function cardMatches(
  el: HTMLElement,
  activeCategory: string,
  q: string,
): boolean {
  const title = (el.dataset.title || '').toLowerCase();
  const category = el.dataset.category || '';
  const tags = (el.dataset.tags || '').toLowerCase();
  const catOk = activeCategory === 'All' || category === activeCategory;
  const qOk =
    !q ||
    title.includes(q) ||
    tags.includes(q) ||
    category.toLowerCase().includes(q);
  return catOk && qOk;
}

function trimFullRows(grid: HTMLElement | null) {
  if (!grid) return;
  const kids = [...grid.querySelectorAll<HTMLElement>('[data-game-card]')];
  kids.forEach((el) => el.classList.remove('row-trim-hide'));
  const visible = kids.filter((el) => !el.classList.contains('is-filtered-out'));
  if (!visible.length) return;
  const cols = getComputedStyle(grid)
    .gridTemplateColumns.split(' ')
    .filter(Boolean).length;
  if (cols < 2) return;
  const keep = Math.floor(visible.length / cols) * cols;
  if (keep === 0) return;
  visible.forEach((el, i) => {
    if (i >= keep) el.classList.add('row-trim-hide');
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safePathSegment(value: string) {
  return encodeURIComponent(value).replace(/%2F/gi, '');
}

function renderShelf(container: HTMLElement | null, items: PlayedGame[], emptyText: string) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="col-span-full py-6 text-sm text-arcade-muted">${escapeHtml(emptyText)}</p>`;
    container.hidden = false;
    return;
  }
  container.hidden = false;
  container.innerHTML = items
    .map((g) => {
      const slug = safePathSegment(g.slug);
      const title = escapeHtml(g.title || 'Game');
      const category = escapeHtml(g.category || '');
      const thumb = escapeHtml(g.thumb || '/og-default.jpg');
      return `
      <a href="/game/${slug}/" class="group block overflow-hidden rounded-xl border border-arcade-border/70 bg-arcade-card transition hover:-translate-y-0.5 hover:border-arcade-border hover:shadow-glow">
        <div class="relative aspect-[4/3] overflow-hidden bg-arcade-panel">
          <img src="${thumb}" alt="" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" width="320" height="240" />
          <span class="absolute left-2 top-2 rounded-md bg-arcade-bg/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-arcade-accent backdrop-blur">${category}</span>
        </div>
        <div class="p-2.5">
          <p class="line-clamp-1 text-sm font-semibold text-white group-hover:text-arcade-accent">${title}</p>
        </div>
      </a>`;
    })
    .join('');
}

function initShelves() {
  const recent = getRecentPlays();
  const faves = getFavorites();
  const continueSection = document.getElementById('continue-playing-section');
  const favoritesSection = document.getElementById('favorites-section');
  const continueGrid = document.getElementById('continue-playing-grid');
  const favoritesGrid = document.getElementById('favorites-grid');

  if (continueSection) {
    continueSection.hidden = recent.length === 0;
    if (recent.length) renderShelf(continueGrid as HTMLElement, recent.slice(0, 8), '');
  }
  if (favoritesSection) {
    favoritesSection.hidden = faves.length === 0;
    if (faves.length) renderShelf(favoritesGrid as HTMLElement, faves.slice(0, 8), '');
  }
}

function initRandomGame() {
  const btn = document.getElementById('surprise-game');
  const pool = document.querySelectorAll<HTMLElement>('#games-grid [data-game-card]');
  if (!btn || !pool.length) return;
  btn.addEventListener('click', () => {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const link = pick.querySelector('a') as HTMLAnchorElement | null;
    if (link?.href) window.location.href = link.href;
  });
}

function initFavoriteButton() {
  const btn = document.getElementById('favorite-toggle') as HTMLButtonElement | null;
  if (!btn) return;
  const slug = btn.dataset.slug || '';
  const sync = () => {
    const on = isFavorite(slug);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('is-faved', on);
    btn.textContent = on ? '♥ Saved' : '♡ Save';
  };
  sync();
  btn.addEventListener('click', () => {
    toggleFavorite({
      slug,
      title: btn.dataset.title || slug,
      thumb: btn.dataset.thumb || '',
      category: btn.dataset.category || '',
    });
    sync();
    initShelves();
  });
}

function initPlayedRecord() {
  const el = document.getElementById('played-meta');
  if (!el) return;
  recordPlayed({
    slug: el.dataset.slug || '',
    title: el.dataset.title || '',
    thumb: el.dataset.thumb || '',
    category: el.dataset.category || '',
  });
}

export function initCategoryUI() {
  const sidebar = document.getElementById('category-sidebar');
  const backdrop = document.getElementById('category-backdrop');
  const toggle = document.getElementById('category-toggle');
  const closeBtn = document.getElementById('category-close');
  const collapseBtn = document.getElementById('category-collapse');
  const search = document.getElementById('game-search') as HTMLInputElement | null;
  const pills = document.querySelectorAll<HTMLButtonElement>('#category-filters [data-category]');
  const cards = document.querySelectorAll<HTMLElement>('#games-grid [data-game-card]');
  const empty = document.getElementById('games-empty');
  const activeLabel = document.getElementById('active-category-label');
  const resultCount = document.getElementById('filter-result-count');
  const browseSections = document.querySelectorAll<HTMLElement>('[data-home-browse]');
  const catalog = document.getElementById('catalog-section');

  // Mark so we do not double-bind listeners after soft navigations
  if (document.body.dataset.gfUiBound === '1') {
    // still refresh shelves
    initShelves();
    return;
  }
  document.body.dataset.gfUiBound = '1';

  let activeCategory = 'All';
  const mq = window.matchMedia('(min-width: 1024px)');

  function isDesktop() {
    return mq.matches;
  }

  function setMobileOpen(open: boolean) {
    if (!sidebar) return;
    sidebar.dataset.open = open ? 'true' : 'false';
    sidebar.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    sidebar.setAttribute('aria-hidden', open || isDesktop() ? 'false' : 'true');
    if (backdrop) {
      backdrop.hidden = !open;
      backdrop.classList.toggle('opacity-0', !open);
      backdrop.classList.toggle('pointer-events-none', !open);
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    document.body.classList.toggle('overflow-hidden', open && !isDesktop());
    if (open && !isDesktop()) {
      closeBtn?.focus();
    }
  }

  function setDesktopCollapsed(collapsed: boolean) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    try {
      localStorage.setItem('gf-sidebar-collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (collapseBtn) collapseBtn.textContent = collapsed ? '»' : '«';
  }

  if (sidebar) {
    setDesktopCollapsed(false);
    setMobileOpen(isDesktop());

    toggle?.addEventListener('click', () => {
      if (isDesktop()) {
        setDesktopCollapsed(!document.body.classList.contains('sidebar-collapsed'));
      } else {
        setMobileOpen(sidebar.dataset.open !== 'true');
      }
    });
    closeBtn?.addEventListener('click', () => setMobileOpen(false));
    backdrop?.addEventListener('click', () => setMobileOpen(false));
    collapseBtn?.addEventListener('click', () => {
      setDesktopCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    });
    mq.addEventListener('change', () => {
      setDesktopCollapsed(false);
      setMobileOpen(isDesktop());
    });
  }

  function applyFilters(opts?: { scroll?: boolean }) {
    const q = (search?.value || '').trim().toLowerCase();
    const filtering = activeCategory !== 'All' || q.length > 0;
    let visible = 0;

    cards.forEach((card) => {
      card.classList.remove('row-trim-hide');
      const show = cardMatches(card, activeCategory, q);
      card.classList.toggle('is-filtered-out', !show);
      if (show) visible += 1;
    });

    browseSections.forEach((section) => {
      section.classList.toggle('is-browse-hidden', filtering);
    });

    trimFullRows(document.getElementById('games-grid'));

    if (empty) empty.classList.toggle('is-filtered-out', visible > 0);
    if (activeLabel) {
      activeLabel.textContent =
        activeCategory === 'All' ? (q ? `Search “${q}”` : 'All games') : activeCategory;
    }
    if (resultCount) {
      resultCount.textContent = filtering ? `${visible} shown` : '';
    }
    const live = document.getElementById('filter-live');
    if (live) {
      const label =
        activeCategory === 'All' ? (q ? `Search ${q}` : 'All games') : activeCategory;
      live.textContent = filtering
        ? `${label}: ${visible} games shown`
        : `Showing all ${visible} games`;
    }

    document.body.classList.toggle('is-filtering', filtering);

    if (opts?.scroll && filtering && catalog) {
      catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  search?.addEventListener('input', () => applyFilters({ scroll: false }));
  search?.setAttribute('aria-controls', 'games-grid');

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      activeCategory = pill.dataset.category || 'All';
      pills.forEach((p) => {
        const on = p === pill;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      applyFilters({ scroll: true });
      if (!isDesktop()) setMobileOpen(false);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar && !isDesktop() && sidebar.dataset.open === 'true') {
      setMobileOpen(false);
      toggle?.focus();
    }
  });

  window.addEventListener('resize', () => {
    trimFullRows(document.getElementById('games-grid'));
  });

  // Deep-link ?q= / ?category=
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q');
  const catParam = params.get('category');
  if (qParam && search) search.value = qParam;
  if (catParam) {
    const match = [...pills].find(
      (p) => (p.dataset.category || '').toLowerCase() === catParam.toLowerCase(),
    );
    if (match) {
      activeCategory = match.dataset.category || 'All';
      pills.forEach((p) => {
        const on = p === match;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  }

  applyFilters({ scroll: Boolean(qParam || catParam) });
  initShelves();
  initRandomGame();
  initPlayedRecord();
  initFavoriteButton();
}
