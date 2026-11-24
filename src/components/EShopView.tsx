import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Gamepad2,
  Heart,
  LayoutGrid,
  Lightbulb,
  Search,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';
import type {
  AdaptivePalette,
  ApkpCategory,
  ApkpGameDetail,
  ApkpGameSummary,
  ApkpLibraryResponse,
  GameItem,
  UserProfile,
} from '../types/skyline';
import type { Switch2LayoutMetrics } from '../utils/rp5Layout';
import { APKP_FALLBACK_CATALOG } from '../utils/apkportsParser';
import { UiKitAvatar } from './UiKitAvatar';
import { SwitchPdfIcon } from './SwitchPdfIcons';
import { BottomControllerGlyph } from './BottomControllerGlyph';

type EShopSectionId =
  | 'highlights'
  | 'search'
  | 'forYou'
  | 'wishlist'
  | 'official'
  | 'unofficial'
  | 'charts'
  | 'recent'
  | 'fanGames';

interface EShopViewProps {
  metrics: Switch2LayoutMetrics;
  palette: AdaptivePalette;
  activeUser: UserProfile;
  wishlistIds: string[];
  installedSlugs: string[];
  onToggleWishlist: (id: string) => void;
  onInstallToHome: (game: ApkpGameSummary, detail?: ApkpGameDetail | null) => void;
  onOpenUserSelect: () => void;
  onClose: () => void;
}

const SIDEBAR_ITEMS: { id: EShopSectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'highlights', label: 'Highlights', icon: Star },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'forYou', label: 'For You', icon: Lightbulb },
  { id: 'wishlist', label: 'Wish List', icon: Heart },
  { id: 'official', label: 'Official Ports', icon: Tag },
  { id: 'unofficial', label: 'Unofficial Ports', icon: Gamepad2 },
  { id: 'charts', label: 'Charts', icon: BarChart2 },
  { id: 'recent', label: 'Recent Releases', icon: Clock },
  { id: 'fanGames', label: 'Fan Games', icon: Sparkles },
];

export function EShopView({
  metrics,
  palette,
  activeUser,
  wishlistIds,
  installedSlugs,
  onToggleWishlist,
  onInstallToHome,
  onOpenUserSelect,
  onClose,
}: EShopViewProps) {
  const [section, setSection] = useState<EShopSectionId>('highlights');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest' | 'title'>('popular');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [games, setGames] = useState<ApkpGameSummary[]>(APKP_FALLBACK_CATALOG);
  const [categories, setCategories] = useState<ApkpCategory[]>([]);
  const [totalCount, setTotalCount] = useState(APKP_FALLBACK_CATALOG.length);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);

  const [detailGame, setDetailGame] = useState<ApkpGameDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [slideDir, setSlideDir] = useState<'none' | 'next' | 'prev'>('none');

  const savedCatalogRef = useRef<Record<string, ApkpGameSummary>>({});

  const fetchLibrary = useCallback(async () => {
    if (section === 'wishlist') {
      const items = wishlistIds.map((id) => savedCatalogRef.current[id]).filter(Boolean);
      setGames(items);
      setTotalCount(items.length);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set('page', String(page));

      if (section === 'search' && submittedSearch.trim()) {
        sp.set('q', submittedSearch.trim());
      } else if (section === 'fanGames') {
        sp.set('section', 'fan-games');
      } else {
        if (section === 'recent') sp.set('sort', 'newest');
        else if (section === 'charts' || section === 'highlights') sp.set('sort', sort);
        else if (section === 'forYou') {
          sp.set('sort', 'popular');
          if (!selectedCategory) sp.set('category', 'action');
        } else {
          sp.set('sort', sort);
        }

        if (section === 'official') sp.set('portType', 'official');
        if (section === 'unofficial') sp.set('portType', 'unofficial');
        if (selectedCategory) sp.set('category', selectedCategory);
      }

      const res = await fetch(`/api/apkports/games?${sp.toString()}`);
      const json = (await res.json()) as ApkpLibraryResponse;

      for (const g of json.games) {
        savedCatalogRef.current[g.id] = g;
      }

      setGames(json.games);
      setTotalCount(json.totalCount);
      setTotalPages(json.totalPages);
      if (json.categories.length > 0) setCategories(json.categories);
      setSelectedCardIdx(0);
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [page, section, sort, selectedCategory, submittedSearch, wishlistIds]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const openDetail = useCallback(async (item: ApkpGameSummary) => {
    setDetailLoading(true);
    setDetailGame({
      ...item,
      description: 'Loading APKPorts release notes and device requirements...',
      screenshots: [item.coverUrl],
      sourceUrl: `https://www.apkports.com/game/${encodeURIComponent(item.slug)}`,
    });
    try {
      const res = await fetch(`/api/apkports/game/${encodeURIComponent(item.slug)}`);
      if (res.ok) {
        const full = (await res.json()) as ApkpGameDetail;
        setDetailGame(full);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Keyboard support inside eShop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (detailGame) setDetailGame(null);
        else onClose();
        return;
      }
      if (detailGame) return;

      const visibleCount = Math.min(6, games.length);
      if (visibleCount === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCardIdx((p) => (p + 1 < visibleCount ? p + 1 : 0));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCardIdx((p) => (p > 0 ? p - 1 : visibleCount - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCardIdx((p) => (p + 3 < visibleCount ? p + 3 : p));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCardIdx((p) => (p - 3 >= 0 ? p - 3 : p));
      } else if (e.key.toLowerCase() === 'x' && games[selectedCardIdx]) {
        e.preventDefault();
        e.stopPropagation();
        onToggleWishlist(games[selectedCardIdx].id);
      } else if (e.key === 'Enter' && games[selectedCardIdx]) {
        e.preventDefault();
        e.stopPropagation();
        openDetail(games[selectedCardIdx]);
      } else if ((e.key.toLowerCase() === 'q' || e.key === '[' || e.key === 'PageUp') && page > 1) {
        e.preventDefault();
        e.stopPropagation();
        setSlideDir('prev');
        setPage((p) => Math.max(1, p - 1));
      } else if ((e.key.toLowerCase() === 'e' || e.key === ']' || e.key === 'PageDown') && page < totalPages) {
        e.preventDefault();
        e.stopPropagation();
        setSlideDir('next');
        setPage((p) => Math.min(totalPages, p + 1));
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [detailGame, games, page, totalPages, selectedCardIdx, onClose, onToggleWishlist, openDetail]);

  const h = metrics.viewportHeight;
  const displayedGames = games.slice(0, 6);
  const selectedGame = displayedGames[selectedCardIdx] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="eShop"
      data-testid="eshop-view"
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: '#191A1D', color: '#F3F4F6' }}
    >
      {/* Main Split Layout: Left Red Header + Sidebar / Right Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Navigation Sidebar (~22%) */}
        <aside
          className="flex flex-col shrink-0 h-full"
          style={{
            width: '21.5%',
            backgroundColor: '#232428',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Nintendo Red eShop Banner (Clean pure white shopping bag silhouette, NO box/artifacts) */}
          <div
            className="flex items-center gap-2.5 px-4 shrink-0"
            style={{
              height: `${Math.max(42, Math.round(h * 0.095))}px`,
              backgroundColor: '#E60012',
              color: '#FFFFFF',
            }}
          >
            <svg
              width={Math.max(20, Math.round(h * 0.038))}
              height={Math.max(20, Math.round(h * 0.038))}
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M11.5 11V8.8a4.5 4.5 0 0 1 9 0V11"
                stroke="#FFFFFF"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M6.6 11.5h18.8l1.2 13.3a2.2 2.2 0 0 1-2.2 2.4H7.6a2.2 2.2 0 0 1-2.2-2.4l1.2-13.3Z"
                stroke="#FFFFFF"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <path
                d="M12.2 15.2a3.8 3.8 0 0 0 7.6 0"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <span
              className="font-ud-bold tracking-tight truncate"
              style={{ fontSize: `${Math.max(13, Math.round(h * 0.028))}px` }}
            >
              eShop
            </span>
          </div>

          {/* Nav Links */}
          <nav aria-label="eShop Categories" className="flex-1 overflow-y-auto py-2 no-scrollbar">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`eshop-nav-${item.id}`}
                  onClick={() => {
                    setDetailGame(null);
                    setSection(item.id);
                    setPage(1);
                  }}
                  className="relative w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors hover:bg-white/5"
                  style={{
                    color: isActive ? '#FFFFFF' : '#D1D5DB',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                    fontSize: `${Math.max(11, Math.round(h * 0.022))}px`,
                  }}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-full"
                      style={{ backgroundColor: '#E60012' }}
                    />
                  )}
                  <Icon className="w-4 h-4 shrink-0 ml-1 opacity-90" />
                  <span className={isActive ? 'font-ud-bold' : 'font-ud-regular'}>
                    {item.label}
                  </span>
                  {item.id === 'wishlist' && wishlistIds.length > 0 && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/15 font-mono-tabular">
                      {wishlistIds.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 h-full px-6 pt-3 pb-2 overflow-hidden">
          {detailGame ? (
            /* In-eShop Port Detail Subpage */
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setDetailGame(null)}
                  className="flex items-center gap-2 text-xs font-ud-regular text-gray-300 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to APKPorts Catalog</span>
                </button>
                <a
                  href={detailGame.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-ud-regular"
                >
                  <span>View on apkports.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-12 gap-6 py-4">
                <div className="col-span-5 space-y-3">
                  <div
                    className="aspect-video rounded-md overflow-hidden"
                    style={{ boxShadow: '0 0 0 2px #4FD1FF' }}
                  >
                    <img
                      src={detailGame.coverUrl}
                      alt={detailGame.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {detailGame.screenshots.length > 1 && (
                    <div className="grid grid-cols-3 gap-2">
                      {detailGame.screenshots.slice(0, 3).map((shot, idx) => (
                        <div key={idx} className="aspect-video rounded overflow-hidden bg-black/40">
                          <img
                            src={shot}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-7 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-ud-bold uppercase"
                        style={{
                          backgroundColor:
                            detailGame.portType === 'official' ? '#0891B2' : '#E60012',
                          color: '#FFFFFF',
                        }}
                      >
                        {detailGame.portType} Port
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-tabular bg-white/10 text-gray-200">
                        v{detailGame.version}
                      </span>
                      {detailGame.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded text-[11px] bg-white/5 text-gray-300"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>

                    <h2
                      className="font-ud-bold tracking-tight"
                      style={{ fontSize: `${Math.max(18, Math.round(h * 0.04))}px` }}
                    >
                      {detailGame.title}
                    </h2>

                    <p className="text-xs text-gray-300 leading-relaxed">
                      {detailLoading
                        ? 'Fetching full release notes from www.apkports.com...'
                        : detailGame.description}
                    </p>

                    {detailGame.requirements && (
                      <div className="p-2.5 rounded bg-white/5 text-[11px] text-gray-300">
                        <span className="font-ud-bold text-white">Device Notes: </span>
                        {detailGame.requirements}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      data-testid="eshop-install-home"
                      onClick={() => onInstallToHome(detailGame, detailGame)}
                      disabled={installedSlugs.includes(detailGame.slug)}
                      className="flex items-center gap-2 px-4 py-2 rounded text-xs font-ud-bold text-white cursor-pointer disabled:opacity-60 transition-opacity"
                      style={{ backgroundColor: '#E60012' }}
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {installedSlugs.includes(detailGame.slug)
                          ? 'Installed on Home'
                          : 'Add to RP5 Home Screen'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleWishlist(detailGame.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded text-xs font-ud-regular border border-white/25 hover:bg-white/10 cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          wishlistIds.includes(detailGame.id) ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                      <span>
                        {wishlistIds.includes(detailGame.id) ? 'In Wish List' : 'Add to Wish List'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Main 3x2 Switch 2 eShop Grid matching switch-2-novaya-era-nintendo-9-3-screenshot_9b1ebe41.webp */
            <>
              {/* Top Info + User Avatar */}
              <div className="flex items-start justify-between shrink-0 mb-2">
                <div
                  className="text-gray-300 leading-snug font-ud-regular"
                  style={{ fontSize: `${Math.max(11, Math.round(h * 0.019))}px` }}
                >
                  <div>Select Any Title to Download directly to your Device</div>
                  <div className="text-gray-400 font-ud-thin">
                    This are Unofficial ports &amp; results may vary
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenUserSelect}
                  aria-label={`Active user ${activeUser.name}`}
                  className="rounded-full overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform"
                >
                  <UiKitAvatar
                    characterId={activeUser.characterId}
                    size={Math.max(30, Math.round(h * 0.056))}
                    roundedClass="rounded-full"
                    alt={activeUser.name}
                  />
                </button>
              </div>

              {/* Search bar if in Search section */}
              {section === 'search' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                    setSubmittedSearch(searchQuery);
                  }}
                  className="flex items-center gap-2 mb-2 shrink-0"
                >
                  <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded bg-[#26282E] border border-white/15">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search apkports.com library (e.g. GTA, Zelda, Dark Souls)..."
                      className="w-full bg-transparent text-xs text-white focus:outline-none font-ud-regular"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded text-xs font-ud-bold text-white cursor-pointer"
                    style={{ backgroundColor: '#E60012' }}
                  >
                    Search
                  </button>
                </form>
              )}

              {/* Toolbar Row: Items Count + Filter + Popularity Dropdown */}
              <div className="flex items-center justify-between shrink-0 mb-2.5">
                <div
                  className="font-ud-regular text-gray-200 tabular-nums"
                  style={{ fontSize: `${Math.max(11, Math.round(h * 0.022))}px` }}
                >
                  Items: {totalCount}
                  {selectedCategory && (
                    <span className="ml-2 text-sky-400 text-[11px]">· {selectedCategory}</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    className="px-3.5 py-1 rounded text-xs font-ud-regular cursor-pointer transition-colors"
                    style={{
                      border: `1px solid ${showFilters ? '#4FD1FF' : 'rgba(255,255,255,0.28)'}`,
                      backgroundColor: showFilters ? 'rgba(79,209,255,0.12)' : 'transparent',
                    }}
                  >
                    Filter
                  </button>

                  <div className="relative flex items-center">
                    <select
                      aria-label="Sort APKPorts catalog"
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value as 'popular' | 'newest' | 'title');
                        setPage(1);
                      }}
                      className="appearance-none bg-[#232429] text-gray-100 text-xs font-ud-regular pl-3 pr-8 py-1 rounded border border-white/25 cursor-pointer focus:outline-none"
                    >
                      <option value="popular">Popularity</option>
                      <option value="newest">Recent Releases</option>
                      <option value="title">Title (A–Z)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-300 pointer-events-none absolute right-2" />
                  </div>
                </div>
              </div>

              {/* Optional Category Filter Bar */}
              {showFilters && categories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('');
                      setPage(1);
                    }}
                    className="px-2.5 py-0.5 rounded text-[11px] font-ud-regular whitespace-nowrap cursor-pointer"
                    style={{
                      backgroundColor: selectedCategory === '' ? '#E60012' : '#2A2C32',
                      color: '#FFFFFF',
                    }}
                  >
                    All Genres
                  </button>
                  {categories.slice(0, 14).map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.slug);
                        setPage(1);
                      }}
                      className="px-2.5 py-0.5 rounded text-[11px] font-ud-regular whitespace-nowrap cursor-pointer"
                      style={{
                        backgroundColor: selectedCategory === cat.slug ? '#E60012' : '#2A2C32',
                        color: '#FFFFFF',
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* 3x2 Software Card Grid matching uploaded photo */}
              <div className="flex-1 min-h-0 flex items-center justify-center">
                {loading && games.length === 0 ? (
                  <div className="grid grid-cols-3 gap-3.5 w-full">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded overflow-hidden bg-[#26282E]/80"
                        style={{ height: `${Math.round(h * 0.255)}px` }}
                      />
                    ))}
                  </div>
                ) : displayedGames.length === 0 ? (
                  <div className="text-center space-y-2 text-gray-400 text-xs">
                    <LayoutGrid className="w-8 h-8 mx-auto opacity-50" />
                    <div>
                      {section === 'wishlist'
                        ? 'Your Wish List is empty. Press (X) on any game to add it.'
                        : 'No matching ports found in apkports.com.'}
                    </div>
                  </div>
                ) : (
                  <div
                    key={`${section}-${page}-${sort}-${selectedCategory}`}
                    data-testid="eshop-grid"
                    className={`grid grid-cols-3 gap-3.5 w-full ${
                      slideDir === 'next'
                        ? 'animate-eshop-next'
                        : slideDir === 'prev'
                          ? 'animate-eshop-prev'
                          : ''
                    }`}
                  >
                    {displayedGames.map((item, idx) => {
                      const isFocused = selectedCardIdx === idx;
                      const isWished = wishlistIds.includes(item.id);
                      const isInstalled = installedSlugs.includes(item.slug);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`eshop-card-${idx}`}
                          onMouseEnter={() => setSelectedCardIdx(idx)}
                          onClick={() => openDetail(item)}
                          className="relative flex flex-col overflow-hidden text-left cursor-pointer focus:outline-none transition-transform duration-150"
                          style={{
                            borderRadius: '4px',
                            backgroundColor: '#26282E',
                            border: isFocused
                              ? `3px solid ${palette.borderPrimary}`
                              : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {/* 16:9 Cover Banner */}
                          <div className="relative w-full aspect-video overflow-hidden bg-black/50">
                            <img
                              src={item.coverUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover block"
                            />

                            {/* Top-right Official / Fan-Game badge matching "FREE DEMO" */}
                            {(item.portType === 'official' || item.portType === 'fan-game') && (
                              <span
                                className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-ud-bold uppercase tracking-wide rounded-xs"
                                style={{ backgroundColor: '#1C8AEB', color: '#FFFFFF' }}
                              >
                                {item.portType === 'official' ? 'OFFICIAL' : 'FAN GAME'}
                              </span>
                            )}

                            {/* Bottom-right category/installed badge matching "Bundle" */}
                            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-ud-regular rounded-xs bg-black/75 text-gray-100">
                              {isInstalled
                                ? 'Installed'
                                : item.categories[0] || 'APK Port'}
                            </span>

                            {isWished && (
                              <span className="absolute top-1.5 left-1.5 rounded-full p-1 bg-black/65">
                                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                              </span>
                            )}
                          </div>

                          {/* Bottom Price/Version Strip matching uploaded photo */}
                          <div className="px-2 py-1.5 bg-[#202227] flex items-center justify-between gap-2">
                            <div className="text-[11px] font-ud-regular text-gray-100 truncate">
                              {item.title}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="px-1.5 py-0.5 text-[9px] font-ud-bold rounded-xs tabular-nums"
                                style={{ backgroundColor: '#E60012', color: '#FFFFFF' }}
                              >
                                v{item.version.replace(/^v/i, '')}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Controller Help Bar matching uploaded eShop screenshot */}
      <footer
        className="flex items-center justify-between px-6 shrink-0"
        style={{
          height: `${Math.max(38, Math.round(h * 0.082))}px`,
          backgroundColor: '#191A1D',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-4">
          <BottomControllerGlyph size={metrics.helpIconSize} color="#E5E7EB" />
          {!detailGame && (
            <div className="flex items-center gap-2.5 text-xs text-gray-200 font-ud-semibold">
              <button
                type="button"
                data-testid="eshop-prev-page"
                disabled={page <= 1}
                onClick={() => {
                  setSlideDir('prev');
                  setPage((p) => Math.max(1, p - 1));
                }}
                aria-label="Previous page (L1)"
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 disabled:opacity-35 cursor-pointer"
              >
                <SwitchPdfIcon button="L1" size={18} fillColor="#FFFFFF" cutoutColor="#191A1D" />
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-tabular text-gray-300">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                data-testid="eshop-next-page"
                disabled={page >= totalPages}
                onClick={() => {
                  setSlideDir('next');
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                aria-label="Next page (R2)"
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 disabled:opacity-35 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <SwitchPdfIcon button="R2" size={18} fillColor="#FFFFFF" cutoutColor="#191A1D" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 text-xs font-ud-semibold text-gray-100">
          {selectedGame && !detailGame && (
            <button
              type="button"
              onClick={() => onToggleWishlist(selectedGame.id)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
            >
              <SwitchPdfIcon button="X" size={18} fillColor="#FFFFFF" cutoutColor="#191A1D" />
              <span>Wish List (Add/Remove)</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (detailGame) setDetailGame(null);
              else onClose();
            }}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
          >
            <SwitchPdfIcon button="B" size={18} fillColor="#FFFFFF" cutoutColor="#191A1D" />
            <span>Back</span>
          </button>
          {selectedGame && !detailGame && (
            <button
              type="button"
              onClick={() => openDetail(selectedGame)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
            >
              <SwitchPdfIcon button="A" size={18} fillColor="#FFFFFF" cutoutColor="#191A1D" />
              <span>Confirm</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
