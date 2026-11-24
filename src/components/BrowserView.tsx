import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Globe, Home, RotateCw, Star } from 'lucide-react';
import type { AdaptivePalette } from '../types/skyline';
import type { Switch2LayoutMetrics } from '../utils/rp5Layout';
import {
  BROWSER_HOME_URL,
  DEFAULT_BROWSER_BOOKMARKS,
  normalizeBrowserInput,
  type BrowserBookmark,
} from '../utils/browserHelper';
import { BottomControllerGlyph } from './BottomControllerGlyph';
import { SwitchPdfIcon } from './SwitchPdfIcons';
import { UiKitBrowserIcon } from './UiKitIcons';

interface BrowserViewProps {
  initialUrl?: string;
  palette: AdaptivePalette;
  metrics: Switch2LayoutMetrics;
  onClose: () => void;
}

const FAVORITES_STORAGE_KEY = 'skyline2_browser_favorites_v1';

function loadSavedFavorites(): BrowserBookmark[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.url === 'string' && typeof x.label === 'string')
      .map((x) => ({ label: x.label, url: x.url, isFavorite: true }));
  } catch {
    return [];
  }
}

function buildUrlLabel(url: string, title?: string): string {
  if (title && title.trim().length >= 2) {
    return title.trim().slice(0, 26);
  }
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 24);
  }
}

export function BrowserView({
  initialUrl = BROWSER_HOME_URL,
  palette,
  metrics,
  onClose,
}: BrowserViewProps) {
  const startUrl = normalizeBrowserInput(initialUrl || BROWSER_HOME_URL);
  const [historyState, setHistoryState] = useState<{ stack: string[]; index: number }>({
    stack: [startUrl],
    index: 0,
  });
  const [addressInput, setAddressInput] = useState<string>(startUrl);
  const [pageTitle, setPageTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [favorites, setFavorites] = useState<BrowserBookmark[]>(loadSavedFavorites);

  const historyStack = historyState.stack;
  const historyIndex = historyState.index;
  const activeUrl = historyStack[historyIndex] ?? startUrl;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  const isCurrentFavorite = useMemo(
    () => favorites.some((f) => f.url === activeUrl),
    [favorites, activeUrl]
  );

  const allBookmarks = useMemo<BrowserBookmark[]>(() => {
    const baseUrls = new Set(DEFAULT_BROWSER_BOOKMARKS.map((b) => b.url));
    const extraFavs = favorites.filter((f) => !baseUrls.has(f.url));
    return [
      ...DEFAULT_BROWSER_BOOKMARKS.map((b) => ({
        ...b,
        isFavorite: favorites.some((f) => f.url === b.url),
      })),
      ...extraFavs,
    ];
  }, [favorites]);

  const navigateTo = useCallback((raw: string) => {
    const normalized = normalizeBrowserInput(raw);
    setHistoryState((prev) => {
      const sliced = prev.stack.slice(0, prev.index + 1);
      if (sliced[sliced.length - 1] === normalized) {
        return { stack: sliced, index: sliced.length - 1 };
      }
      const nextStack = [...sliced, normalized];
      return { stack: nextStack, index: nextStack.length - 1 };
    });
    setAddressInput(normalized);
    setPageTitle('');
    setIsLoading(true);
    setReloadNonce((n) => n + 1);
  }, []);

  const goBack = useCallback(() => {
    if (historyState.index <= 0) return;
    const nextIdx = historyState.index - 1;
    const target = historyState.stack[nextIdx];
    setHistoryState((prev) => ({ ...prev, index: nextIdx }));
    setAddressInput(target);
    setPageTitle('');
    setIsLoading(true);
    setReloadNonce((n) => n + 1);
  }, [historyState]);

  const goForward = useCallback(() => {
    if (historyState.index >= historyState.stack.length - 1) return;
    const nextIdx = historyState.index + 1;
    const target = historyState.stack[nextIdx];
    setHistoryState((prev) => ({ ...prev, index: nextIdx }));
    setAddressInput(target);
    setPageTitle('');
    setIsLoading(true);
    setReloadNonce((n) => n + 1);
  }, [historyState]);

  const goHome = useCallback(() => {
    navigateTo(BROWSER_HOME_URL);
  }, [navigateTo]);

  const toggleFavorite = useCallback(() => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.url === activeUrl);
      const next = exists
        ? prev.filter((f) => f.url !== activeUrl)
        : [{ label: buildUrlLabel(activeUrl, pageTitle), url: activeUrl, isFavorite: true }, ...prev];
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, [activeUrl, pageTitle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'skyline-browser-nav' && typeof data.url === 'string') {
        navigateTo(data.url);
      } else if (data.type === 'skyline-browser-loaded') {
        setIsLoading(false);
        if (typeof data.title === 'string' && data.title.trim()) {
          setPageTitle(data.title.trim());
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigateTo]);

  const openExternalChrome = (targetUrl: string) => {
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
  };

  const iframeSrc = `/api/browser/view?url=${encodeURIComponent(activeUrl)}&r=${reloadNonce}`;

  const h = metrics.viewportHeight;
  const padX = Math.max(24, Math.round(metrics.screenMargin * 0.92));
  const isDark = palette.isDark;
  const bg = isDark ? '#1A1C21' : '#EFEFEF';
  const cardBg = isDark ? '#252830' : '#FFFFFF';
  const textMain = isDark ? '#F3F4F6' : '#1F2329';
  const textMuted = isDark ? '#9CA3AF' : '#5E6570';
  const divider = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Internet Browser"
      data-testid="browser-view"
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: bg, color: textMain }}
    >
      {/* Top Address & Tools Toolbar */}
      <div style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div
          className="flex items-center gap-2"
          style={{ height: `${Math.max(48, Math.round(h * 0.108))}px` }}
        >
          <UiKitBrowserIcon size={24} color="#0EA5E9" />

          {/* Back / Next / Home / Reload Tools */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Previous page"
              data-testid="browser-back-btn"
              disabled={!canGoBack}
              onClick={goBack}
              className="p-1.5 rounded-lg cursor-pointer disabled:opacity-35 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: cardBg, border: `1px solid ${divider}` }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              aria-label="Next page"
              data-testid="browser-next-btn"
              disabled={!canGoForward}
              onClick={goForward}
              className="p-1.5 rounded-lg cursor-pointer disabled:opacity-35 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: cardBg, border: `1px solid ${divider}` }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              aria-label="Home page"
              data-testid="browser-home-btn"
              onClick={goHome}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: cardBg, border: `1px solid ${divider}` }}
            >
              <Home className="w-4 h-4" />
            </button>

            <button
              type="button"
              aria-label="Reload page"
              data-testid="browser-reload-btn"
              onClick={() => {
                setIsLoading(true);
                setReloadNonce((n) => n + 1);
              }}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: cardBg, border: `1px solid ${divider}` }}
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigateTo(addressInput);
            }}
            className="flex-1 flex items-center gap-1.5 min-w-0"
          >
            <div
              className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg min-w-0"
              style={{ backgroundColor: cardBg, border: `1px solid ${divider}` }}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: textMuted }} />
              <input
                type="text"
                aria-label="Browser address"
                data-testid="browser-url-input"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                className="w-full bg-transparent text-xs font-ud-regular focus:outline-none"
                style={{ color: textMain }}
              />
            </div>
            <button
              type="submit"
              data-testid="browser-go-btn"
              className="px-3 py-1.5 rounded-lg text-xs font-ud-semibold text-white cursor-pointer shrink-0"
              style={{ backgroundColor: '#0EA5E9' }}
            >
              Go
            </button>
          </form>

          {/* Favorite Star Toggle */}
          <button
            type="button"
            aria-label={isCurrentFavorite ? 'Remove favorite' : 'Add favorite'}
            aria-pressed={isCurrentFavorite}
            data-testid="browser-favorite-btn"
            onClick={toggleFavorite}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-ud-semibold cursor-pointer shrink-0 transition-colors"
            style={{
              backgroundColor: isCurrentFavorite ? '#F59E0B' : cardBg,
              color: isCurrentFavorite ? '#FFFFFF' : textMain,
              border: `1px solid ${isCurrentFavorite ? '#F59E0B' : divider}`,
            }}
          >
            <Star
              className="w-3.5 h-3.5"
              fill={isCurrentFavorite ? '#FFFFFF' : 'none'}
            />
            <span>{isCurrentFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          <button
            type="button"
            data-testid="browser-open-chrome"
            onClick={() => openExternalChrome(activeUrl)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-ud-semibold text-white cursor-pointer shrink-0"
            style={{ backgroundColor: palette.borderPrimary }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Chrome</span>
          </button>
        </div>

        {/* Bookmarks & Favorites Strip */}
        <div className="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar">
          {allBookmarks.map((bm) => {
            const active = activeUrl === bm.url || activeUrl.startsWith(`${bm.url}/`);
            return (
              <button
                key={bm.url}
                type="button"
                data-testid={`bookmark-${bm.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onClick={() => navigateTo(bm.url)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-ud-semibold whitespace-nowrap cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? '#0EA5E9' : cardBg,
                  color: active ? '#FFFFFF' : textMain,
                  border: `1px solid ${active ? '#0EA5E9' : divider}`,
                }}
              >
                {bm.isFavorite && (
                  <Star
                    className="w-3 h-3"
                    fill={active ? '#FFFFFF' : '#F59E0B'}
                    color={active ? '#FFFFFF' : '#F59E0B'}
                  />
                )}
                <span>{bm.label}</span>
              </button>
            );
          })}
        </div>
        <div className="w-full h-px" style={{ backgroundColor: divider }} />
      </div>

      {/* Browser Viewport Frame */}
      <div
        className="flex-1 min-h-0 flex flex-col"
        style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px`, paddingTop: '10px', paddingBottom: '10px' }}
      >
        <div
          className="relative w-full h-full rounded-xl overflow-hidden bg-white flex flex-col"
          style={{ border: `1px solid ${divider}` }}
        >
          <iframe
            key={`${activeUrl}-${reloadNonce}`}
            src={iframeSrc}
            title="SkylineOS 2 In-App Browser"
            data-testid="browser-iframe"
            onLoad={() => setIsLoading(false)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            className="w-full flex-1 border-0 bg-white"
          />
          <div
            className="px-4 py-1.5 flex items-center justify-between text-[11px] font-ud-regular shrink-0"
            style={{ backgroundColor: cardBg, color: textMuted, borderTop: `1px solid ${divider}` }}
          >
            <span className="truncate">{pageTitle ? `${pageTitle} · ${activeUrl}` : activeUrl}</span>
            <span>{isLoading ? 'Loading…' : `History ${historyIndex + 1}/${historyStack.length}`}</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <footer style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div className="w-full h-px" style={{ backgroundColor: divider }} />
        <div
          className="flex items-center justify-between"
          style={{ height: `${Math.max(40, Math.round(h * 0.085))}px` }}
        >
          <BottomControllerGlyph size={metrics.helpIconSize} color={textMain} />
          <button
            type="button"
            data-testid="browser-close-btn"
            onClick={onClose}
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
        </div>
      </footer>
    </div>
  );
}
