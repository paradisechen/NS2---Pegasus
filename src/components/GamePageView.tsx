import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Clock,
  Heart,
  MoreHorizontal,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import type { AdaptivePalette, GameItem, SkylineConfig } from '../types/skyline';
import type { Switch2LayoutMetrics } from '../utils/rp5Layout';
import { BottomControllerGlyph } from './BottomControllerGlyph';
import { SwitchPdfIcon } from './SwitchPdfIcons';

interface GamePageViewProps {
  game: GameItem;
  config: SkylineConfig;
  palette: AdaptivePalette;
  metrics: Switch2LayoutMetrics;
  onPlayRequest: (game: GameItem) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleBacklog: (gameId: string) => void;
  onOpenGameEdit: () => void;
  onClose: () => void;
}

/**
 * Full-screen Edge-to-Edge Game Page replicating Gheovgos/skylineOS2 GameDetailScreen.qml:
 * - Full-bleed game artwork backdrop + horizontal/bottom vignettes
 * - Rounded square cover + platform badge + large title + play time + summary
 * - Back, Play (triggers "Who is playing?" profile picker), and Options (...) row
 */
export function GamePageView({
  game,
  config,
  palette,
  metrics,
  onPlayRequest,
  onToggleFavorite,
  onToggleBacklog,
  onOpenGameEdit,
  onClose,
}: GamePageViewProps) {
  const [focusedBtn, setFocusedBtn] = useState<'back' | 'play' | 'options'>('play');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);

  const [clockText, setClockText] = useState(() => {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    if (config.timeFormat === '24hr') return `${h.toString().padStart(2, '0')}:${m}`;
    const p = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${p}`;
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      setClockText(
        config.timeFormat === '24hr'
          ? `${h.toString().padStart(2, '0')}:${m}`
          : `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`
      );
    }, 15000);
    return () => window.clearInterval(timer);
  }, [config.timeFormat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showOptionsMenu) setShowOptionsMenu(false);
        else onClose();
        return;
      }
      const order: ('back' | 'play' | 'options')[] = ['back', 'play', 'options'];
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedBtn((cur) => order[(order.indexOf(cur) + 1) % order.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedBtn((cur) => order[(order.indexOf(cur) - 1 + order.length) % order.length]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedBtn === 'back') onClose();
        else if (focusedBtn === 'play') onPlayRequest(game);
        else setShowOptionsMenu((v) => !v);
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(game.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [focusedBtn, game, onClose, onPlayRequest, onToggleFavorite, showOptionsMenu]);

  const h = metrics.viewportHeight;
  const padX = Math.max(28, Math.round(metrics.screenMargin * 1.05));
  const coverSize = Math.max(96, Math.round(h * 0.23));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${game.title} Game Page`}
      data-testid="game-page-view"
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col justify-between overflow-hidden select-none bg-[#101216] text-white"
    >
      {/* Full Edge-to-Edge Artwork Background */}
      <img
        src={game.coverUrl}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className={`absolute inset-0 w-full h-full object-cover scale-105 ${game.coverCropClass ?? ''}`}
      />

      {/* Horizontal & Bottom Vignette Gradients matching skylineOS2 GameDetailScreen.qml */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.50) 48%, rgba(0,0,0,0.12) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.08) 55%, rgba(0,0,0,0.78) 100%)',
        }}
      />

      {/* Top Status Strip */}
      <div
        className="relative z-10 flex items-center justify-between"
        style={{
          paddingLeft: `${padX}px`,
          paddingRight: `${padX}px`,
          paddingTop: `${Math.max(18, Math.round(h * 0.036))}px`,
        }}
      >
        <div className="flex items-center gap-2 text-xs font-ud-regular text-white/85">
          <span>{game.developer}</span>
          <span>·</span>
          <span>{game.releaseYear}</span>
          <span>·</span>
          <span>{game.genre}</span>
        </div>

        <div className="flex items-center gap-4 text-white/95 font-ud-regular">
          <span style={{ fontSize: `${metrics.statusFontSize}px` }} className="tabular-nums">
            {clockText}
          </span>
          {config.showBatteryPercent && (
            <span style={{ fontSize: `${metrics.statusFontSize}px` }} className="tabular-nums">
              86%
            </span>
          )}
        </div>
      </div>

      {/* Bottom Info Column + Action Row */}
      <div
        className="relative z-10 flex flex-col justify-end gap-5"
        style={{
          paddingLeft: `${padX}px`,
          paddingRight: `${padX}px`,
          paddingBottom: `${Math.max(20, Math.round(h * 0.04))}px`,
        }}
      >
        {/* Cover Frame + Platform Badge */}
        <div className="flex items-end gap-4">
          <div
            className="overflow-hidden shrink-0 bg-[#1B1E26]"
            style={{
              width: `${coverSize}px`,
              height: `${coverSize}px`,
              borderRadius: `${Math.max(14, Math.round(coverSize * 0.14))}px`,
              border: `2px solid rgba(255,255,255,0.22)`,
            }}
          >
            <img
              src={game.coverUrl}
              alt={game.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover block ${game.coverCropClass ?? ''}`}
            />
          </div>

          <div className="flex flex-col gap-2 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-3 py-1 rounded-lg text-xs font-ud-semibold"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  border: `1.5px solid ${palette.borderPrimary}`,
                }}
              >
                {game.platform}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-ud-regular bg-black/45 text-white/90">
                <Clock className="w-3.5 h-3.5" />
                <span>{game.playTimeHours} hrs played</span>
              </span>
              {game.lastPlayedByUser && (
                <span className="px-3 py-1 rounded-lg text-xs font-ud-regular bg-black/45 text-white/80">
                  Last: {game.lastPlayedByUser}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Game Title & Summary */}
        <div className="max-w-2xl space-y-2">
          <h1
            data-testid="game-page-title"
            className="font-ud-bold leading-tight tracking-tight text-white"
            style={{ fontSize: `${Math.max(26, Math.round(h * 0.056))}px` }}
          >
            {game.title}
          </h1>
          <p
            onClick={() => setExpandDesc((v) => !v)}
            className={`font-ud-regular text-white/85 leading-relaxed cursor-pointer ${
              expandDesc ? '' : 'line-clamp-2'
            }`}
            style={{ fontSize: `${Math.max(12, Math.round(h * 0.023))}px` }}
          >
            {game.summary}
          </p>
        </div>

        {/* Action Row: Back Circle + White Pill Play + Options Circle */}
        <div className="flex items-center justify-between pt-1">
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              data-testid="game-page-back"
              aria-label="Back to Home"
              onMouseEnter={() => setFocusedBtn('back')}
              onClick={onClose}
              className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus:outline-none"
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: focusedBtn === 'back' ? `3px solid ${palette.borderPrimary}` : '3px solid transparent',
              }}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            <button
              type="button"
              data-testid="game-page-play"
              onMouseEnter={() => setFocusedBtn('play')}
              onClick={() => onPlayRequest(game)}
              className="h-12 px-7 rounded-full flex items-center gap-2.5 bg-white text-[#111317] font-ud-bold cursor-pointer transition-transform active:scale-95 focus:outline-none"
              style={{
                fontSize: `${Math.max(13, Math.round(h * 0.023))}px`,
                border: focusedBtn === 'play' ? `3px solid ${palette.borderPrimary}` : '3px solid transparent',
              }}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play</span>
            </button>

            <button
              type="button"
              data-testid="game-page-options"
              aria-label="Game Options"
              onMouseEnter={() => setFocusedBtn('options')}
              onClick={() => setShowOptionsMenu((v) => !v)}
              className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus:outline-none"
              style={{
                backgroundColor: showOptionsMenu ? palette.borderPrimary : 'rgba(255,255,255,0.2)',
                border: focusedBtn === 'options' ? `3px solid ${palette.borderPrimary}` : '3px solid transparent',
              }}
            >
              <MoreHorizontal className="w-5 h-5 text-white" />
            </button>

            {showOptionsMenu && (
              <div
                className="absolute bottom-14 left-24 w-56 rounded-xl p-2 space-y-1 z-20"
                style={{ backgroundColor: 'rgba(24, 26, 32, 0.96)', border: '1px solid rgba(255,255,255,0.14)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onToggleFavorite(game.id);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-ud-semibold hover:bg-white/10 cursor-pointer text-left"
                >
                  <Heart className={`w-4 h-4 ${game.favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{game.favorite ? 'Remove Favorite' : 'Add to Favorites'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleBacklog(game.id);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-ud-semibold hover:bg-white/10 cursor-pointer text-left"
                >
                  <Bookmark className={`w-4 h-4 ${game.inBacklog ? 'fill-sky-400 text-sky-400' : ''}`} />
                  <span>{game.inBacklog ? 'Remove from Backlog' : 'Queue in Backlog'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onOpenGameEdit();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-ud-semibold hover:bg-white/10 cursor-pointer text-left"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Edit Artwork &amp; Title</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-5">
            <BottomControllerGlyph size={metrics.helpIconSize} color="#FFFFFF" />
            <div className="flex items-center gap-2 text-xs font-ud-regular text-white/90">
              <SwitchPdfIcon button="B" size={20} fillColor="#FFFFFF" cutoutColor="#101216" />
              <span>Back</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-ud-regular text-white/90">
              <SwitchPdfIcon button="A" size={20} fillColor="#FFFFFF" cutoutColor="#101216" />
              <span>Play</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
