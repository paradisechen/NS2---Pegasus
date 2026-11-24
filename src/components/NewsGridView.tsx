import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Newspaper, Play, RefreshCw } from 'lucide-react';
import type {
  AdaptivePalette,
  ArticleReaderPayload,
  BrowserOpenMode,
  NewsCategoryId,
  NewsFeedItem,
  NewsFeedResponse,
} from '../types/skyline';
import type { Switch2LayoutMetrics } from '../utils/rp5Layout';
import { NEWS_FALLBACK_BY_CATEGORY, NSO_FALLBACK_ITEMS } from '../utils/rssFeedParser';
import { BottomControllerGlyph } from './BottomControllerGlyph';
import { SwitchPdfIcon } from './SwitchPdfIcons';
import { UiKitNewsIcon, UiKitNsoIcon } from './UiKitIcons';

interface NewsGridViewProps {
  mode: 'nso' | 'news';
  browserMode: BrowserOpenMode;
  palette: AdaptivePalette;
  metrics: Switch2LayoutMetrics;
  onOpenInBrowser: (url: string) => void;
  onClose: () => void;
}

const NEWS_CATEGORIES: { id: NewsCategoryId; label: string }[] = [
  { id: 'news', label: 'News' },
  { id: 'sports', label: 'Sports' },
  { id: 'tech', label: 'Tech' },
  { id: 'android_ports', label: 'Android Game Ports' },
  { id: 'finance', label: 'Finance' },
  { id: 'politics', label: 'Politics' },
  { id: 'puerto_rico', label: 'Puerto Rico Noticias' },
];

/**
 * Powers both Nintendo Switch Online and News (7 categories in 2x2 grid).
 * Features:
 * - High-resolution images + full multi-paragraph story reader via /api/feeds/article
 * - Video detection with "Play Video (In-App)" and "Open in Browser" actions
 * - Press (X) to refresh feeds live
 * - > 3 pages support (loads additional batches dynamically on demand)
 */
export function NewsGridView({
  mode,
  browserMode,
  palette,
  metrics,
  onOpenInBrowser,
  onClose,
}: NewsGridViewProps) {
  const [category, setCategory] = useState<NewsCategoryId>('news');
  const [items, setItems] = useState<NewsFeedItem[]>(
    mode === 'nso' ? NSO_FALLBACK_ITEMS : NEWS_FALLBACK_BY_CATEGORY.news
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreFromServer, setHasMoreFromServer] = useState(true);
  const [serverBatchPage, setServerBatchPage] = useState(1);
  const [pageIdx, setPageIdx] = useState(0);
  const [focusedIdx, setFocusedIdx] = useState(0);

  const [activeArticle, setActiveArticle] = useState<NewsFeedItem | null>(null);
  const [articleDetails, setArticleDetails] = useState<ArticleReaderPayload | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [playingVideoInApp, setPlayingVideoInApp] = useState(false);

  const latestReqIdRef = useRef(0);

  const fetchFeed = useCallback(
    async (forceRefresh = false, nextBatchPage = 1, append = false) => {
      const reqId = ++latestReqIdRef.current;
      if (!append) {
        const immediateFallback =
          mode === 'nso'
            ? NSO_FALLBACK_ITEMS
            : [...NEWS_FALLBACK_BY_CATEGORY[category], ...NSO_FALLBACK_ITEMS.slice(0, 12)];
        setItems(immediateFallback);
        setPageIdx(0);
        setFocusedIdx(0);
        setServerBatchPage(1);
      }
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const sp = new URLSearchParams();
        sp.set('page', String(nextBatchPage));
        if (forceRefresh) sp.set('refresh', '1');
        if (mode === 'news') sp.set('category', category);

        const endpoint =
          mode === 'nso'
            ? `/api/feeds/nso?${sp.toString()}`
            : `/api/feeds/news?${sp.toString()}`;
        const res = await fetch(endpoint);
        const json = (await res.json()) as NewsFeedResponse;
        if (reqId !== latestReqIdRef.current) return;

        if (Array.isArray(json.items) && json.items.length > 0) {
          if (append) {
            setItems((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              const extra = json.items.filter((x) => !seen.has(x.id));
              return [...prev, ...extra];
            });
          } else {
            setItems(json.items);
          }
          setHasMoreFromServer(Boolean(json.hasMore));
          setServerBatchPage(nextBatchPage);
        }
      } catch {
        // Keep immediateFallback
      } finally {
        if (reqId === latestReqIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [mode, category]
  );

  useEffect(() => {
    fetchFeed(false, 1, false);
  }, [fetchFeed]);

  const openStoryReader = useCallback(async (item: NewsFeedItem) => {
    setActiveArticle(item);
    setPlayingVideoInApp(false);
    setArticleDetails(null);
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/feeds/article?url=${encodeURIComponent(item.url)}`);
      if (res.ok) {
        const payload = (await res.json()) as ArticleReaderPayload;
        setArticleDetails(payload);
      }
    } catch {
      // Keep item fallback text
    } finally {
      setArticleLoading(false);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / 4));
  const pageItems = items.slice(pageIdx * 4, pageIdx * 4 + 4);

  const goNextPage = useCallback(() => {
    if (pageIdx + 1 < totalPages) {
      setPageIdx((p) => p + 1);
      setFocusedIdx(0);
    } else if (hasMoreFromServer && !loading) {
      fetchFeed(false, serverBatchPage + 1, true).then(() => {
        setPageIdx((p) => p + 1);
        setFocusedIdx(0);
      });
    }
  }, [fetchFeed, hasMoreFromServer, loading, pageIdx, serverBatchPage, totalPages]);

  const handleOpenExternalUrl = useCallback(
    (targetUrl: string) => {
      if (browserMode === 'in-app') {
        onOpenInBrowser(targetUrl);
      } else {
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
          window.location.href = `googlechrome://navigate?url=${encodeURIComponent(targetUrl)}`;
        } else {
          const link = document.createElement('a');
          link.href = targetUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    },
    [browserMode, onOpenInBrowser]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (playingVideoInApp) setPlayingVideoInApp(false);
        else if (activeArticle) setActiveArticle(null);
        else onClose();
        return;
      }
      if (activeArticle) return;

      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        e.stopPropagation();
        fetchFeed(true, 1, false);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIdx + 1 < pageItems.length) {
          setFocusedIdx((p) => p + 1);
        } else {
          goNextPage();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIdx > 0) {
          setFocusedIdx((p) => p - 1);
        } else if (pageIdx > 0) {
          setPageIdx((p) => p - 1);
          setFocusedIdx(3);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIdx((p) => (p + 2 < pageItems.length ? p + 2 : p));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIdx((p) => (p - 2 >= 0 ? p - 2 : p));
      } else if (e.key === 'Enter' && pageItems[focusedIdx]) {
        e.preventDefault();
        e.stopPropagation();
        openStoryReader(pageItems[focusedIdx]);
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    activeArticle,
    fetchFeed,
    focusedIdx,
    goNextPage,
    onClose,
    openStoryReader,
    pageIdx,
    pageItems,
    playingVideoInApp,
  ]);

  const h = metrics.viewportHeight;
  const padX = Math.max(24, Math.round(metrics.screenMargin * 0.92));
  const isDark = palette.isDark;
  const bg = isDark ? '#1A1C21' : '#EFEFEF';
  const cardBg = isDark ? '#252830' : '#FFFFFF';
  const textMain = isDark ? '#F3F4F6' : '#1F2329';
  const textMuted = isDark ? '#9CA3AF' : '#5E6570';
  const divider = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
  const accentColor = mode === 'nso' ? '#E60012' : '#2BAB23';

  const resolvedHeroImage =
    (activeArticle && articleDetails?.heroImageUrl) || activeArticle?.imageUrl || '';
  const resolvedVideoUrl =
    (activeArticle && articleDetails?.videoUrl) || activeArticle?.videoUrl;
  const storyParagraphs =
    activeArticle && articleDetails?.paragraphs && articleDetails.paragraphs.length > 0
      ? articleDetails.paragraphs
      : activeArticle?.content
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean) ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'nso' ? 'Nintendo Switch Online News' : 'News Channels'}
      data-testid={mode === 'nso' ? 'nso-view' : 'news-view'}
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: bg, color: textMain }}
    >
      {/* Top Header */}
      <div style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div
          className="flex items-center justify-between gap-4"
          style={{ height: `${Math.max(46, Math.round(h * 0.105))}px` }}
        >
          <div className="flex items-center gap-3 shrink-0">
            {mode === 'nso' ? (
              <UiKitNsoIcon size={28} highlighted={true} />
            ) : (
              <UiKitNewsIcon size={28} />
            )}
            <h1
              className="font-ud-semibold tracking-tight"
              style={{ fontSize: `${Math.max(17, Math.round(h * 0.034))}px` }}
            >
              {mode === 'nso' ? 'Nintendo Switch Online' : 'News'}
            </h1>
          </div>

          {!activeArticle && mode === 'news' && (
            <nav
              aria-label="News Categories"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
            >
              {NEWS_CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`news-cat-${cat.id}`}
                    onClick={() => setCategory(cat.id)}
                    className="px-3 py-1 rounded-full text-xs font-ud-regular whitespace-nowrap cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? accentColor : cardBg,
                      color: active ? '#FFFFFF' : textMain,
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </nav>
          )}

          {!activeArticle && mode === 'nso' && (
            <span
              data-testid="nso-header-subtitle"
              className="font-ud-regular text-xs"
              style={{ color: textMuted }}
            >
              Nintendo.com · Gaming · Updates
            </span>
          )}
        </div>
        <div className="w-full h-px" style={{ backgroundColor: divider }} />
      </div>

      {/* Main Content: Either Full-Page Flat Reader OR 2x2 Squared Cards Grid */}
      {activeArticle ? (
        <article
          data-testid="news-full-reader"
          className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden"
          style={{
            paddingLeft: `${padX}px`,
            paddingRight: `${padX}px`,
            paddingTop: `${Math.max(16, Math.round(h * 0.03))}px`,
            paddingBottom: `${Math.max(14, Math.round(h * 0.024))}px`,
            gap: '24px',
          }}
        >
          <div
            className="w-full md:w-[46%] h-full overflow-hidden shrink-0 relative"
            style={{ borderRadius: '10px', backgroundColor: cardBg }}
          >
            {playingVideoInApp && resolvedVideoUrl ? (
              resolvedVideoUrl.endsWith('.mp4') ? (
                <video
                  src={resolvedVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <iframe
                  src={`${resolvedVideoUrl}?autoplay=1`}
                  title={activeArticle.title}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="w-full h-full border-0 bg-black"
                />
              )
            ) : (
              <img
                src={resolvedHeroImage}
                alt={activeArticle.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover block"
              />
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 py-1">
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
              <div className="flex items-center gap-2.5 text-xs font-ud-regular">
                <span
                  className="px-2.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {activeArticle.sourceName}
                </span>
                <span style={{ color: textMuted }}>{activeArticle.publishedAt}</span>
                {articleLoading && (
                  <span style={{ color: textMuted }}>Loading full story...</span>
                )}
              </div>

              <h2
                className="font-ud-bold leading-snug tracking-tight"
                style={{ fontSize: `${Math.max(20, Math.round(h * 0.038))}px` }}
              >
                {activeArticle.title}
              </h2>

              <div className="w-full h-px" style={{ backgroundColor: divider }} />

              <div className="space-y-3 pb-2">
                {storyParagraphs.map((para, i) => (
                  <p
                    key={i}
                    className="font-ud-regular leading-relaxed"
                    style={{
                      fontSize: `${Math.max(13, Math.round(h * 0.022))}px`,
                      color: isDark ? '#D1D5DB' : '#374151',
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>

            <div
              className="pt-3 mt-2 shrink-0 flex flex-wrap items-center gap-3"
              style={{ borderTop: `1px solid ${divider}` }}
            >
              {resolvedVideoUrl && (
                <button
                  type="button"
                  data-testid="news-play-video-in-app"
                  onClick={() => setPlayingVideoInApp((v) => !v)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-ud-semibold text-white cursor-pointer"
                  style={{ backgroundColor: '#0EA5E9' }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{playingVideoInApp ? 'Show Cover Photo' : 'Play Video (In-App)'}</span>
                </button>
              )}

              <button
                type="button"
                data-testid="news-open-browser"
                onClick={() => handleOpenExternalUrl(resolvedVideoUrl || activeArticle.url)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-ud-semibold text-white cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                <span>Open in Browser</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </article>
      ) : (
        <div
          className="flex-1 flex flex-col justify-center min-h-0"
          style={{
            paddingLeft: `${padX}px`,
            paddingRight: `${padX}px`,
            paddingTop: `${Math.max(12, Math.round(h * 0.022))}px`,
            paddingBottom: `${Math.max(10, Math.round(h * 0.02))}px`,
          }}
        >
          {loading && pageItems.length === 0 ? (
            <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl"
                  style={{ backgroundColor: cardBg, opacity: 0.75 }}
                />
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-sm opacity-70">
              <Newspaper className="w-8 h-8" />
              <span>No articles available in this feed right now.</span>
            </div>
          ) : (
            <div
              data-testid="news-2x2-grid"
              className="grid grid-cols-2 grid-rows-2 gap-4 h-full min-h-0"
            >
              {pageItems.map((item, idx) => {
                const isSelected = focusedIdx === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`news-card-${idx}`}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    onClick={() => openStoryReader(item)}
                    className="flex flex-col overflow-hidden text-left cursor-pointer focus:outline-none transition-transform duration-150"
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: '10px',
                      border: isSelected
                        ? `3px solid ${palette.dockRingColor}`
                        : `1px solid ${divider}`,
                      boxShadow: 'none',
                    }}
                  >
                    {/* Top 50%: High-Res Photo */}
                    <div className="w-full h-1/2 overflow-hidden bg-black/20 shrink-0 relative">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover block"
                      />
                      <span
                        className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-ud-regular text-white"
                        style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
                      >
                        {item.sourceName}
                      </span>
                      {item.videoUrl && (
                        <span
                          className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-ud-semibold text-white flex items-center gap-1"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Video</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom 50%: Title + Description */}
                    <div className="w-full h-1/2 px-3.5 py-2 flex flex-col justify-center gap-1 min-h-0">
                      <h3
                        className="font-ud-semibold leading-snug line-clamp-2"
                        style={{
                          fontSize: `${Math.max(13, Math.round(h * 0.025))}px`,
                          color: textMain,
                        }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="font-ud-thin leading-snug line-clamp-2"
                        style={{
                          fontSize: `${Math.max(10, Math.round(h * 0.0175))}px`,
                          color: textMuted,
                        }}
                      >
                        {item.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom Bar with Pagination (>3 pages), (X) Refresh, (B) Back, (A) Read */}
      <footer style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div className="w-full h-px" style={{ backgroundColor: divider }} />
        <div
          className="flex items-center justify-between"
          style={{ height: `${Math.max(40, Math.round(h * 0.085))}px` }}
        >
          <div className="flex items-center gap-4">
            <BottomControllerGlyph size={metrics.helpIconSize} color={textMain} />

            {!activeArticle && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="news-prev-page"
                  disabled={pageIdx <= 0}
                  onClick={() => {
                    setPageIdx((p) => Math.max(0, p - 1));
                    setFocusedIdx(0);
                  }}
                  aria-label="Previous news page"
                  className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer disabled:opacity-35 hover:bg-black/5"
                >
                  <SwitchPdfIcon
                    button="STICK_L"
                    size={20}
                    fillColor={textMain}
                    cutoutColor={bg}
                  />
                  <span className="text-xs font-ud-regular">Prev</span>
                </button>
                <span
                  data-testid="news-page-indicator"
                  className="text-xs font-mono-tabular"
                  style={{ color: textMuted }}
                >
                  {pageIdx + 1} / {totalPages}
                  {hasMoreFromServer ? '+' : ''}
                </span>
                <button
                  type="button"
                  data-testid="news-next-page"
                  disabled={pageIdx + 1 >= totalPages && !hasMoreFromServer}
                  onClick={goNextPage}
                  aria-label="Next news page"
                  className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer disabled:opacity-35 hover:bg-black/5"
                >
                  <SwitchPdfIcon
                    button="STICK_R"
                    size={20}
                    fillColor={textMain}
                    cutoutColor={bg}
                  />
                  <span className="text-xs font-ud-regular">
                    {pageIdx + 1 >= totalPages && hasMoreFromServer ? 'Load More' : 'Next'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            {!activeArticle && (
              <button
                type="button"
                data-testid="news-refresh-btn"
                onClick={() => fetchFeed(true, 1, false)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-75"
              >
                <SwitchPdfIcon
                  button="X"
                  size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                  fillColor={textMain}
                  cutoutColor={bg}
                />
                <span
                  className="font-ud-regular flex items-center gap-1"
                  style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (playingVideoInApp) setPlayingVideoInApp(false);
                else if (activeArticle) setActiveArticle(null);
                else onClose();
              }}
              className="flex items-center gap-2 cursor-pointer hover:opacity-75"
            >
              <SwitchPdfIcon
                button="B"
                size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                fillColor={textMain}
                cutoutColor={bg}
              />
              <span
                className="font-ud-regular"
                style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
              >
                Back
              </span>
            </button>

            {!activeArticle && pageItems[focusedIdx] && (
              <button
                type="button"
                onClick={() => openStoryReader(pageItems[focusedIdx])}
                className="flex items-center gap-2 cursor-pointer hover:opacity-75"
              >
                <SwitchPdfIcon
                  button="A"
                  size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                  fillColor={textMain}
                  cutoutColor={bg}
                />
                <span
                  className="font-ud-regular"
                  style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
                >
                  Read Story
                </span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
