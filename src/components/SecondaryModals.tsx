import { Bookmark, Heart, Play, Power, X } from 'lucide-react';
import type { AdaptivePalette, GameItem } from '../types/skyline';

interface SecondaryModalsProps {
  activeModal: 'detail' | 'suspend';
  selectedGame: GameItem | null;
  palette: AdaptivePalette;
  onClose: () => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleBacklog: (gameId: string) => void;
  onLaunchGame: (game: GameItem) => void;
}

export function SecondaryModals({
  activeModal,
  selectedGame,
  palette,
  onClose,
  onToggleFavorite,
  onToggleBacklog,
  onLaunchGame,
}: SecondaryModalsProps) {
  const surfaceBg = palette.isDark ? '#1A1D24' : '#F8FAFC';
  const cardBg = palette.isDark ? '#232730' : '#FFFFFF';
  const textPrimary = palette.isDark ? '#F1F5F9' : '#0F172A';
  const textMuted = palette.isDark ? '#94A3B8' : '#475569';
  const hairline = palette.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';

  if (activeModal === 'suspend') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sleep Mode"
        className="animate-ns2-fade fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white p-6"
        onClick={onClose}
      >
        <Power className="w-12 h-12 mb-4 opacity-80" />
        <h2 className="text-2xl font-ud-bold tracking-tight mb-2">Console Entering Sleep Mode</h2>
        <p className="text-sm text-slate-400 mb-6 font-ud-regular">
          Click anywhere or press any key to wake Retroid Pocket 5 display
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-full text-sm font-ud-semibold text-white cursor-pointer"
          style={{ backgroundColor: palette.borderPrimary }}
        >
          Wake Screen
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game Details"
      className="animate-ns2-fade fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        style={{
          backgroundColor: surfaceBg,
          color: textPrimary,
          border: `1px solid ${hairline}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${hairline}` }}
        >
          <h2 className="text-lg font-ud-bold tracking-tight">
            {selectedGame?.title ?? 'Game Details'}
          </h2>
          <button
            type="button"
            aria-label="Close Dialog"
            onClick={onClose}
            className="p-2 rounded-lg cursor-pointer hover:opacity-75"
            style={{ backgroundColor: cardBg, color: textPrimary }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selectedGame && (
          <div className="p-6 flex flex-col sm:flex-row gap-6">
            <div className="w-44 h-44 rounded-2xl overflow-hidden shrink-0 shadow-lg">
              <img
                src={selectedGame.coverUrl}
                alt={selectedGame.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover ${selectedGame.coverCropClass ?? ''}`}
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-xs font-ud-semibold" style={{ color: textMuted }}>
                  {selectedGame.platform} · {selectedGame.developer} · {selectedGame.releaseYear} ·{' '}
                  {selectedGame.playTimeHours} hrs played
                </div>
                <p className="text-sm mt-2 leading-relaxed font-ud-regular">
                  {selectedGame.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onLaunchGame(selectedGame);
                    onClose();
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-ud-bold text-white cursor-pointer"
                  style={{ backgroundColor: palette.borderPrimary }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch Game</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(selectedGame.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-ud-semibold cursor-pointer"
                  style={{ backgroundColor: cardBg, border: `1px solid ${hairline}` }}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      selectedGame.favorite ? 'fill-current' : ''
                    }`}
                    style={{
                      color: selectedGame.favorite ? palette.favoriteHeartBg : textMuted,
                    }}
                  />
                  <span>{selectedGame.favorite ? 'Favorited' : 'Add Favorite'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBacklog(selectedGame.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-ud-semibold cursor-pointer"
                  style={{ backgroundColor: cardBg, border: `1px solid ${hairline}` }}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{selectedGame.inBacklog ? 'In Backlog' : 'Add to Backlog'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
