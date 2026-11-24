export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type UiKitBorderPreset = 'adaptive' | 'prism' | 'aqua' | 'violet' | 'magenta' | 'frost';

export type HudColorThemeId =
  | 'auto'
  | 'mario'
  | 'luigi'
  | 'peach'
  | 'yoshi'
  | 'dk'
  | 'bowser'
  | 'switchCyan';

export interface AdaptivePalette {
  isDark: boolean;
  dominantHex: string;
  accentHex: string;
  accentGlowHex: string;
  iridescentGradient: string;
  canvasBg: string;
  backdropWash: string;
  gameTitleColor: string;
  topBarText: string;
  topBarIcon: string;
  statusPillBg: string;
  borderPrimary: string;
  borderPulse: string;
  cardSurface: string;
  dockBg: string; // Solid color without border
  dockIcon: string;
  dockActiveCircle: string;
  dockActiveIcon: string;
  dockRingColor: string; // Solid UI-matched focus ring (no rainbow)
  dockLabel: string;
  helpBarText: string;
  helpBarIcon: string;
  favoriteHeartBg: string;
  favoriteHeartIcon: string;
  overlaySheetBg: string;
  overlayCardBg: string;
  overlayDivider: string;
  overlayText: string;
  overlayMuted: string;
}

export type UiKitCharacterId = 'mario' | 'luigi' | 'peach' | 'yoshi' | 'dk' | 'bowser';

export interface UserProfile {
  id: string;
  name: string;
  characterId: UiKitCharacterId;
  friendCode?: string;
}

export interface GameItem {
  id: string;
  title: string;
  platform: string;
  platformShort: string;
  developer: string;
  releaseYear: string;
  genre: string;
  playTimeHours: number;
  lastPlayedByUser?: string;
  lastPlayedAt?: string;
  favorite: boolean;
  inBacklog?: boolean;
  coverUrl: string;
  coverCropClass?: string;
  sampleRegion?: { x: number; y: number; w: number; h: number };
  summary: string;
  fallbackDominant: RgbColor;
  fallbackAccent: RgbColor;
  apkportsSlug?: string;
  version?: string;
}

export type ThemeAppearanceMode = 'auto' | 'light' | 'dark';

export type BrowserOpenMode = 'in-app' | 'chrome';

export interface AlbumPhotoItem {
  id: string;
  name: string;
  url: string;
  addedAt?: string;
}

export interface SkylineConfig {
  username: string;
  appearanceMode: ThemeAppearanceMode;
  adaptiveColors: boolean;
  hudThemeId: HudColorThemeId;
  borderPreset: UiKitBorderPreset;
  uiSoundsEnabled: boolean;
  cardSizePct: number;
  allSoftwareSizePct: number;
  cardSpacingRatio: number;
  borderGapPx720: number;
  borderThicknessPx720: number;
  dockHeightPct: number;
  brightnessPct: number;
  browserMode: BrowserOpenMode;
  albumFolderLabel: string;
  showBatteryPercent: boolean;
  showWifi: boolean;
  timeFormat: '12hr' | '24hr';
  enableBackgroundArt: boolean;
  backgroundDimPct: number; // Controls Game Background opacity (0-100%)
  rp5FrameMode: 'fit-16-9' | 'fill';
}

export type FocusZone = 'profile' | 'games' | 'dock';
export type ActiveModal =
  | null
  | 'userSelect'
  | 'gameEdit'
  | 'gamePage'
  | 'browser'
  | 'settings'
  | 'store'
  | 'software'
  | 'nso'
  | 'chat'
  | 'news'
  | 'album'
  | 'gameshare'
  | 'controllers'
  | 'detail'
  | 'suspend';

export interface ApkpCategory {
  name: string;
  slug: string;
}

export interface ApkpGameSummary {
  id: string;
  slug: string;
  title: string;
  coverUrl: string;
  rawImageUrl: string;
  version: string;
  portType: 'official' | 'unofficial' | 'fan-game';
  categories: string[];
  franchises: string[];
}

export interface ApkpGameDetail extends ApkpGameSummary {
  description: string;
  requirements?: string;
  developer?: string;
  releaseDate?: string;
  fileSize?: string;
  screenshots: string[];
  sourceUrl: string;
}

export interface ApkpLibraryResponse {
  games: ApkpGameSummary[];
  totalCount: number;
  totalPages: number;
  page: number;
  categories: ApkpCategory[];
  source: 'live' | 'cache' | 'fallback';
}

export type NewsCategoryId =
  | 'news'
  | 'sports'
  | 'tech'
  | 'android_ports'
  | 'finance'
  | 'politics'
  | 'puerto_rico';

export interface NewsFeedItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  sourceName: string;
  publishedAt: string;
  imageUrl: string;
  url: string;
  category: string;
  videoUrl?: string;
}

export interface NewsFeedResponse {
  items: NewsFeedItem[];
  source: 'live' | 'cache' | 'fallback';
  page?: number;
  hasMore?: boolean;
}

export interface ArticleReaderPayload {
  url: string;
  title?: string;
  paragraphs: string[];
  heroImageUrl?: string;
  videoUrl?: string;
}
