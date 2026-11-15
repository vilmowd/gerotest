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

type CatalogGame = { s: string; t: string; c: string; i: string };

function catalogMatches(game: CatalogGame, activeCategory: string, q: string): boolean {
  const title = game.t.toLowerCase();
  const category = game.c || '';
  const catOk = activeCategory === 'All' || category === activeCategory;
  const qOk =
    !q || title.includes(q) || category.toLowerCase().includes(q);
  return catOk && qOk;
}

function safeThumb(url: string): string {
  const t = (url || '').trim();
  if (!t) return '/og-default.jpg';
  if (t.startsWith('/')) return t;
  if (/^https:\/\//i.test(t)) return t;
  return '/og-default.jpg';
}

function catalogCardHtml(game: CatalogGame): string {
  const slug = safePathSegment(game.s);
  const title = escapeHtml(game.t || 'Game');
  const category = escapeHtml(game.c || '');
  const thumb = escapeHtml(safeThumb(game.i));
  const titleAttr = escapeHtml(game.t || '');
  const catAttr = escapeHtml(game.c || '');
  return `<article class="game-card group reveal is-visible" role="listitem" data-game-card="true" data-title="${titleAttr}" data-category="${catAttr}" data-tags="">
  <a href="/game/${slug}/" class="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arcade-accent">
    <div class="media-skel relative aspect-[4/3] overflow-hidden bg-arcade-panel">
      <img src="${thumb}" alt="${title} thumbnail" loading="lazy" decoding="async" width="600" height="400" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" referrerpolicy="no-referrer" />
      <div class="absolute inset-0 z-[3] flex items-center justify-center bg-arcade-bg/60 opacity-0 transition group-hover:opacity-100" aria-hidden="true">
        <span class="rounded-full bg-arcade-accent px-4 py-2 font-display text-sm font-bold text-arcade-bg shadow-glow">Play</span>
      </div>
      <span class="absolute left-2 top-2 z-[3] rounded-md bg-arcade-bg/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-arcade-accent backdrop-blur">${category}</span>
    </div>
    <div class="p-3">
      <h3 class="line-clamp-1 font-semibold text-white group-hover:text-arcade-accent">${title}</h3>
    </div>
  </a>
</article>`;
}

function trimFullRows(grid: HTMLElement | null) {
  if (!grid || grid.hasAttribute('data-catalog-grid')) return;
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

function initRandomGame(getPool: () => CatalogGame[] | Promise<CatalogGame[]>) {
  const btn = document.getElementById('surprise-game');
  if (!btn) return;
  btn.addEventListener('click', () => {
    void Promise.resolve(getPool()).then((pool) => {
      if (!pool.length) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      window.location.href = `/game/${safePathSegment(pick.s)}/`;
    });
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

function categorySlugClient(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function initCategoryUI() {
  const earlyParams = new URLSearchParams(window.location.search);
  const earlyCategory = earlyParams.get('category');
  if (earlyCategory) {
    const slug = categorySlugClient(earlyCategory);
    if (slug && slug !== 'all') {
      window.location.replace(`/category/${slug}/`);
      return;
    }
  }

  const sidebar = document.getElementById('category-sidebar');
  const backdrop = document.getElementById('category-backdrop');
  const toggle = document.getElementById('category-toggle');
  const closeBtn = document.getElementById('category-close');
  const collapseBtn = document.getElementById('category-collapse');
  const search = document.getElementById('game-search') as HTMLInputElement | null;
  const pills = document.querySelectorAll<HTMLButtonElement>('#category-filters [data-category]');
  const grid = document.getElementById('games-grid');
  const empty = document.getElementById('games-empty');
  const activeLabel = document.getElementById('active-category-label');
  const resultCount = document.getElementById('filter-result-count');
  const browseSections = document.querySelectorAll<HTMLElement>('[data-home-browse]');
  const catalog = document.getElementById('catalog-section');
  const loadMoreBtn = document.getElementById('catalog-load-more') as HTMLButtonElement | null;
  const pageStatus = document.getElementById('catalog-page-status');
  const catalogPlaceholder = document.getElementById('catalog-placeholder');

  // Mark so we do not double-bind listeners after soft navigations
  if (document.body.dataset.gfUiBound === '1') {
    // still refresh shelves
    initShelves();
    return;
  }
  document.body.dataset.gfUiBound = '1';

  let activeCategory = 'All';
  const mq = window.matchMedia('(min-width: 1024px)');

  const initialSize = Number(grid?.dataset.catalogInitial || 80) || 80;
  const stepSize = Number(grid?.dataset.catalogStep || 40) || 40;
  const catalogTotalHint = Number(grid?.dataset.catalogTotal || 0) || 0;
  let catalogGames: CatalogGame[] = [];
  let filteredGames: CatalogGame[] = [];
  let shownCount = initialSize;
  let catalogReady = false;
  let catalogActivated = false;
  let catalogLoading = false;

  function isDesktop() {
    return mq.matches;
  }

  function setMobileOpen(open: boolean) {
    if (!sidebar) return;
    sidebar.dataset.open = open ? 'true' : 'false';
    sidebar.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    const hideFromTree = !open && !isDesktop();
    sidebar.setAttribute('aria-hidden', hideFromTree ? 'true' : 'false');
    sidebar.inert = hideFromTree;
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

  function updateCatalogChrome(filtering: boolean) {
    const total = filteredGames.length;
    const showing = Math.min(shownCount, total);
    if (empty) empty.classList.toggle('is-filtered-out', !catalogReady || total > 0);
    if (activeLabel) {
      const q = (search?.value || '').trim();
      activeLabel.textContent =
        activeCategory === 'All' ? (q ? `Search “${q}”` : 'All games') : activeCategory;
    }
    if (resultCount) {
      resultCount.textContent = filtering && catalogReady ? `${total} match` : '';
    }
    if (pageStatus) {
      if (!catalogActivated) {
        pageStatus.textContent =
          catalogTotalHint > 0
            ? `${catalogTotalHint} games available — scroll here to load`
            : 'Scroll here to load the catalog';
      } else if (catalogLoading) {
        pageStatus.textContent = 'Loading catalog…';
      } else if (total === 0) {
        pageStatus.textContent = 'No games to show';
      } else {
        pageStatus.textContent = `Showing ${showing} of ${total}`;
      }
    }
    if (loadMoreBtn) {
      const more = catalogReady && showing < total;
      loadMoreBtn.hidden = !more;
      loadMoreBtn.disabled = !catalogReady || catalogLoading;
      loadMoreBtn.textContent = more
        ? `Load more games (${Math.min(stepSize, total - showing)} more)`
        : 'Load more games';
    }
    if (catalogPlaceholder) {
      catalogPlaceholder.hidden = catalogReady || catalogLoading;
      if (catalogLoading) catalogPlaceholder.textContent = 'Loading catalog…';
      else if (!catalogActivated) {
        catalogPlaceholder.textContent = 'Scroll here to load the full catalog…';
        catalogPlaceholder.hidden = false;
      }
    }
    const live = document.getElementById('filter-live');
    if (live && catalogReady) {
      const label =
        activeCategory === 'All'
          ? (search?.value || '').trim()
            ? `Search ${search?.value}`
            : 'All games'
          : activeCategory;
      live.textContent = `${label}: showing ${showing} of ${total} games`;
    }
  }

  function renderCatalogPage(opts?: { appendFrom?: number }) {
    if (!grid || !catalogReady) {
      updateCatalogChrome(activeCategory !== 'All' || Boolean((search?.value || '').trim()));
      return;
    }
    const slice = filteredGames.slice(0, shownCount);
    const appendFrom = opts?.appendFrom;
    if (typeof appendFrom === 'number' && appendFrom > 0 && appendFrom < slice.length) {
      const frag = document.createDocumentFragment();
      const wrap = document.createElement('div');
      wrap.innerHTML = slice.slice(appendFrom).map(catalogCardHtml).join('');
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      grid.appendChild(frag);
    } else {
      grid.innerHTML = slice.map(catalogCardHtml).join('');
    }
    if (slice.length) grid.setAttribute('role', 'list');
    else grid.removeAttribute('role');
    if (catalogPlaceholder) catalogPlaceholder.hidden = true;
    const filtering = activeCategory !== 'All' || Boolean((search?.value || '').trim());
    updateCatalogChrome(filtering);
  }

  function applyFilters(opts?: { scroll?: boolean; resetPage?: boolean; activate?: boolean }) {
    const q = (search?.value || '').trim().toLowerCase();
    const filtering = activeCategory !== 'All' || q.length > 0;

    browseSections.forEach((section) => {
      section.classList.toggle('is-browse-hidden', filtering);
    });
    document.body.classList.toggle('is-filtering', filtering);

    if (filtering || opts?.activate) {
      void activateCatalog();
    }

    if (catalogReady) {
      filteredGames = catalogGames.filter((g) => catalogMatches(g, activeCategory, q));
      if (opts?.resetPage !== false) shownCount = initialSize;
      renderCatalogPage();
    } else {
      if (empty) empty.classList.toggle('is-filtered-out', true);
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      updateCatalogChrome(filtering);
    }

    if (opts?.scroll && filtering && catalog) {
      catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function activateCatalog(): Promise<void> {
    if (catalogReady || catalogLoading) return Promise.resolve();
    if (!grid?.hasAttribute('data-catalog-grid')) return Promise.resolve();
    catalogActivated = true;
    catalogLoading = true;
    if (catalogPlaceholder) {
      catalogPlaceholder.hidden = false;
      catalogPlaceholder.textContent = 'Loading catalog…';
    }
    updateCatalogChrome(false);

    return fetch('/games-index.json', { credentials: 'same-origin', cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('index'))))
      .then((data: { games?: CatalogGame[] }) => {
        const list = Array.isArray(data?.games) ? data.games : [];
        catalogGames = list.filter(
          (g) => g && typeof g.s === 'string' && typeof g.t === 'string',
        );
        catalogReady = true;
        catalogLoading = false;
        shownCount = initialSize;
        applyFilters({ scroll: false, resetPage: true });
      })
      .catch(() => {
        catalogLoading = false;
        if (catalogPlaceholder) {
          catalogPlaceholder.hidden = false;
          catalogPlaceholder.textContent = 'Could not load the catalog. Refresh and try again.';
        }
        if (loadMoreBtn) {
          loadMoreBtn.hidden = true;
          loadMoreBtn.disabled = true;
        }
        if (pageStatus) pageStatus.textContent = 'Catalog unavailable';
      });
  }

  let searchTimer = 0;
  search?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      applyFilters({ scroll: false, resetPage: true, activate: true });
    }, 180);
  });
  search?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || document.getElementById('games-grid')) return;
    const q = (search?.value || '').trim();
    if (!q) return;
    event.preventDefault();
    window.location.href = `/?q=${encodeURIComponent(q)}`;
  });
  search?.setAttribute('aria-controls', 'games-grid');

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      activeCategory = pill.dataset.category || 'All';
      pills.forEach((p) => {
        const on = p === pill;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      applyFilters({
        scroll: true,
        resetPage: true,
        activate: activeCategory !== 'All',
      });
      if (!isDesktop()) setMobileOpen(false);
    });
  });

  loadMoreBtn?.addEventListener('click', () => {
    if (!catalogReady) return;
    const prev = shownCount;
    shownCount += stepSize;
    renderCatalogPage({ appendFrom: prev });
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

  const needsCatalogNow = Boolean(qParam || (catParam && activeCategory !== 'All'));
  applyFilters({
    scroll: needsCatalogNow,
    resetPage: true,
    activate: needsCatalogNow,
  });
  initShelves();
  initRandomGame(async () => {
    await activateCatalog();
    return filteredGames.length ? filteredGames : catalogGames;
  });
  initPlayedRecord();
  initFavoriteButton();

  // Only fetch + render All Games when the bottom catalog section is on screen
  if (grid?.hasAttribute('data-catalog-grid') && catalog) {
    updateCatalogChrome(false);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void activateCatalog();
      },
      { root: null, rootMargin: '160px 0px', threshold: 0.01 },
    );
    io.observe(catalog);
  }
}
