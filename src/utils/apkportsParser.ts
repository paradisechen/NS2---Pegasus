import type { ApkpCategory, ApkpGameDetail, ApkpGameSummary } from '../types/skyline';

const APKP_ORIGIN = 'https://www.apkports.com';

export function resolveRawApkPortsImageUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `${APKP_ORIGIN}${raw}`;
  }
  return `${APKP_ORIGIN}/${raw}`;
}

export function normalizeApkPortsImageUrl(raw: string | undefined | null): string {
  const absolute = resolveRawApkPortsImageUrl(raw);
  if (!absolute) return '';
  return `/api/apkports/image?url=${encodeURIComponent(absolute)}`;
}

/**
 * Decodes React Router v7 / Turbo-Stream style `enqueue("...")` payloads
 * embedded in www.apkports.com SSR responses.
 */
export function decodeRouterFlightPayload(html: string): Record<string, unknown> | null {
  const matches = [...html.matchAll(/enqueue\(("[\s\S]*?")\);/g)];
  for (const m of matches) {
    try {
      const innerJson = JSON.parse(m[1]) as string;
      const rawArr = JSON.parse(innerJson) as unknown[];
      if (!Array.isArray(rawArr) || rawArr.length === 0) continue;

      const resolveNode = (idx: unknown, depth = 0): unknown => {
        if (depth > 10 || typeof idx !== 'number') return idx;
        if (idx === -5) return undefined;
        if (idx === -7) return null;
        if (idx < 0 || idx >= rawArr.length) return idx;
        const val = rawArr[idx];
        if (Array.isArray(val)) {
          return val.map((item) => resolveNode(item, depth + 1));
        }
        if (val && typeof val === 'object') {
          const out: Record<string, unknown> = {};
          for (const [k, vIdx] of Object.entries(val)) {
            const keyName =
              k.startsWith('_') && Number.isFinite(Number(k.slice(1)))
                ? String(rawArr[Number(k.slice(1))] ?? k)
                : k;
            out[keyName] = resolveNode(vIdx, depth + 1);
          }
          return out;
        }
        return val;
      };

      const root = resolveNode(0) as Record<string, unknown> | null;
      if (root && typeof root === 'object' && root.loaderData) {
        return root;
      }
    } catch {
      // Try next enqueue block
    }
  }
  return null;
}

function mapRawGameToSummary(
  item: Record<string, unknown>,
  defaultPortType: 'official' | 'unofficial' | 'fan-game' = 'unofficial'
): ApkpGameSummary {
  const thumbs = (item.main_image_thumbs ?? {}) as Record<string, unknown>;
  const preferredThumb =
    (typeof thumbs['640'] === 'string' && thumbs['640']) ||
    (typeof thumbs['480'] === 'string' && thumbs['480']) ||
    (typeof thumbs['320'] === 'string' && thumbs['320']) ||
    (typeof item.main_image === 'string' && item.main_image) ||
    '';

  const portRaw = String(item.port_type ?? item.portType ?? defaultPortType).toLowerCase();
  const portType: 'official' | 'unofficial' | 'fan-game' =
    portRaw === 'official'
      ? 'official'
      : portRaw.includes('fan')
        ? 'fan-game'
        : 'unofficial';

  return {
    id: String(item.id ?? item.slug ?? Math.random()),
    slug: String(item.slug ?? ''),
    title: String(item.title ?? 'Untitled Port'),
    rawImageUrl: resolveRawApkPortsImageUrl(preferredThumb),
    coverUrl: normalizeApkPortsImageUrl(preferredThumb),
    version: item.version ? String(item.version) : portType === 'official' ? 'Official' : 'Port',
    portType,
    categories: Array.isArray(item.categories) ? item.categories.map(String) : [],
    franchises: Array.isArray(item.franchises) ? item.franchises.map(String) : [],
  };
}

export function parseApkPortsListHtml(
  html: string,
  section: string = 'games'
): {
  games: ApkpGameSummary[];
  totalCount: number;
  totalPages: number;
  page: number;
  categories: ApkpCategory[];
} {
  const root = decodeRouterFlightPayload(html);
  const loaderData = (root?.loaderData ?? {}) as Record<string, Record<string, unknown>>;

  const routeKey =
    Object.keys(loaderData).find((k) => k !== 'root' && loaderData[k]) ?? 'routes/games';
  const payload = loaderData[routeKey] ?? {};

  const rawGames = (
    Array.isArray(payload.games)
      ? payload.games
      : Array.isArray(payload.results)
        ? payload.results
        : []
  ) as Record<string, unknown>[];

  const defaultPort = section === 'fan-games' ? 'fan-game' : 'unofficial';
  const games = rawGames
    .filter((g) => g && typeof g === 'object' && g.title)
    .map((g) => mapRawGameToSummary(g, defaultPort));

  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const categories: ApkpCategory[] = rawCategories
    .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
    .map((c) => ({
      name: String(c.name ?? ''),
      slug: String(c.slug ?? ''),
    }))
    .filter((c) => c.name && c.slug);

  return {
    games,
    totalCount: Number(payload.totalCount ?? games.length) || games.length,
    totalPages: Number(payload.totalPages ?? 1) || 1,
    page: Number(payload.page ?? 1) || 1,
    categories,
  };
}

export function parseApkPortsDetailHtml(html: string, slug: string): ApkpGameDetail | null {
  const root = decodeRouterFlightPayload(html);
  const loaderData = (root?.loaderData ?? {}) as Record<string, Record<string, unknown>>;
  const routeKey = Object.keys(loaderData).find((k) => k !== 'root' && loaderData[k]?.game);
  const payload = routeKey ? loaderData[routeKey] : null;
  const g = payload?.game as Record<string, unknown> | undefined;
  if (!g) return null;

  const base = mapRawGameToSummary(g);
  const secondary = Array.isArray(g.secondary_images) ? g.secondary_images : [];
  const screenshots = secondary
    .map((entry) => {
      if (typeof entry === 'string') return normalizeApkPortsImageUrl(entry);
      if (entry && typeof entry === 'object') {
        const rec = entry as Record<string, unknown>;
        const mirrors = (rec.mirrors ?? {}) as Record<string, unknown>;
        const chosen =
          (typeof mirrors.local_backup === 'string' && mirrors.local_backup) ||
          (typeof rec.url === 'string' && rec.url) ||
          (typeof mirrors.pixhost === 'string' && mirrors.pixhost) ||
          '';
        return normalizeApkPortsImageUrl(chosen);
      }
      return '';
    })
    .filter(Boolean);

  const rawDesc = String(g.description ?? g.short_description ?? '').replace(/<[^>]+>/g, ' ').trim();

  return {
    ...base,
    slug: base.slug || slug,
    description:
      rawDesc ||
      `${base.title} Android port indexed from APKPorts.com with controller support tuned for handheld devices like the Retroid Pocket 5.`,
    requirements: g.requirements ? String(g.requirements) : 'Android 10+ · Snapdragon 865 / Adreno GPU recommended',
    developer: g.developer ? String(g.developer) : base.franchises[0] || 'APKPorts Community',
    releaseDate: g.updated_at ? String(g.updated_at).slice(0, 10) : '2026',
    fileSize: g.file_size ? String(g.file_size) : undefined,
    screenshots: screenshots.length > 0 ? screenshots : [base.coverUrl],
    sourceUrl: `${APKP_ORIGIN}/game/${encodeURIComponent(base.slug || slug)}`,
  };
}

/** Curated offline/fallback snapshot from www.apkports.com in case upstream blocks requests */
export const APKP_FALLBACK_CATALOG: ApkpGameSummary[] = [
  {
    id: '0ed7d4fb-37bd-4f69-b0d0-16b9307c0c2e',
    slug: 'grand-theft-auto-v-0ed7d4',
    title: 'Grand Theft Auto V',
    rawImageUrl:
      'https://www.apkports.com/uploads/thumbs/cover_0ed7d4fb-37bd-4f69-b0d0-16b9307c0c2e_e93b0cba2465-480.webp',
    coverUrl:
      '/api/apkports/image?url=' +
      encodeURIComponent(
        'https://www.apkports.com/uploads/thumbs/cover_0ed7d4fb-37bd-4f69-b0d0-16b9307c0c2e_e93b0cba2465-480.webp'
      ),
    version: '1.61',
    portType: 'unofficial',
    categories: ['Action', 'Adventure', 'Sandbox', 'Shooter'],
    franchises: ['GTA'],
  },
  {
    id: 'ed5e68a0-dfae-4cb5-a2c9-c6bb165eb08e',
    slug: 'dark-souls-ii-scholar-of-the-first-sin-ed5e68',
    title: 'DARK SOULS II: Scholar of the First Sin',
    rawImageUrl:
      'https://www.apkports.com/uploads/thumbs/cover_ed5e68a0-dfae-4cb5-a2c9-c6bb165eb08e_87d4e336025d-480.webp',
    coverUrl:
      '/api/apkports/image?url=' +
      encodeURIComponent(
        'https://www.apkports.com/uploads/thumbs/cover_ed5e68a0-dfae-4cb5-a2c9-c6bb165eb08e_87d4e336025d-480.webp'
      ),
    version: '0.1.4',
    portType: 'unofficial',
    categories: ['Action', 'RPG', 'Dark Fantasy'],
    franchises: ['Dark Souls'],
  },
  {
    id: 'dbcf6eb8-b3e3-4a5c-80d8-47d741829ddc',
    slug: 'left-4-dead-dbcf6e',
    title: 'Left 4 Dead',
    rawImageUrl:
      'https://www.apkports.com/uploads/thumbs/cover_dbcf6eb8-b3e3-4a5c-80d8-47d741829ddc_90c98f24d3bc-480.webp',
    coverUrl:
      '/api/apkports/image?url=' +
      encodeURIComponent(
        'https://www.apkports.com/uploads/thumbs/cover_dbcf6eb8-b3e3-4a5c-80d8-47d741829ddc_90c98f24d3bc-480.webp'
      ),
    version: '1.0.4',
    portType: 'unofficial',
    categories: ['Action', 'Co-op', 'Shooter'],
    franchises: ['Left 4 Dead'],
  },
  {
    id: 'a4fae8b8-709c-4d09-82fc-0be90af8fd39',
    slug: 'assassins-creed-iv-black-flag-a4fae8',
    title: "Assassin's Creed IV Black Flag",
    rawImageUrl:
      'https://www.apkports.com/uploads/thumbs/cover_a4fae8b8-709c-4d09-82fc-0be90af8fd39_6bc5a997bc60-320.webp',
    coverUrl:
      '/api/apkports/image?url=' +
      encodeURIComponent(
        'https://www.apkports.com/uploads/thumbs/cover_a4fae8b8-709c-4d09-82fc-0be90af8fd39_6bc5a997bc60-320.webp'
      ),
    version: '0.8.13-15',
    portType: 'unofficial',
    categories: ['Action', 'Adventure', 'Stealth'],
    franchises: ["Assassin's Creed"],
  },
  {
    id: 'a3e0dc4b-3d2a-421f-a1be-018b3ce1160c',
    slug: 'tony-hawks-pro-skater-4-a3e0dc',
    title: "Tony Hawk's Pro Skater 4",
    rawImageUrl:
      'https://www.apkports.com/uploads/thumbs/cover_a3e0dc4b-3d2a-421f-a1be-018b3ce1160c_7be9b245e915-480.webp',
    coverUrl:
      '/api/apkports/image?url=' +
      encodeURIComponent(
        'https://www.apkports.com/uploads/thumbs/cover_a3e0dc4b-3d2a-421f-a1be-018b3ce1160c_7be9b245e915-480.webp'
      ),
    version: '1.0.3',
    portType: 'unofficial',
    categories: ['Sports', 'Arcade'],
    franchises: ['Tony Hawk'],
  },
  {
    id: '7af1d216-f993-423c-b90d-6db8b1b7bd83',
    slug: 'the-sims-2-7af1d2',
    title: 'The Sims 2',
    rawImageUrl:
      'https://www.apkports.com/uploads/thumbs/cover_7af1d216-f993-423c-b90d-6db8b1b7bd83_a027a62a8609-480.webp',
    coverUrl:
      '/api/apkports/image?url=' +
      encodeURIComponent(
        'https://www.apkports.com/uploads/thumbs/cover_7af1d216-f993-423c-b90d-6db8b1b7bd83_a027a62a8609-480.webp'
      ),
    version: '0.1.1-dev',
    portType: 'unofficial',
    categories: ['Simulation', 'Life'],
    franchises: ['The Sims'],
  },
];
