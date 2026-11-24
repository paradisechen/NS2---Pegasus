import type { NewsCategoryId, NewsFeedItem } from '../types/skyline';

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : '';
}

function isLowQualityThumbUrl(url: string): boolean {
  const low = url.toLowerCase();
  return (
    low.includes('favicon') ||
    low.includes('avatar') ||
    low.includes('emoji') ||
    low.includes('1x1') ||
    low.includes('pixel.') ||
    low.includes('gravatar') ||
    low.includes('/icon')
  );
}

function extractVideoFromBlock(block: string): string | undefined {
  const ytMatch =
    block.match(/https?:\/\/(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i) ||
    block.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/i) ||
    block.match(/https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
  if (ytMatch?.[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  const mp4Match = block.match(/https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/i);
  if (mp4Match?.[0]) {
    return mp4Match[0];
  }
  return undefined;
}

function extractImageFromBlock(block: string, fallbackImg: string): string {
  const candidates: string[] = [];
  const regexes = [
    /<media:content[^>]+url=["']([^"']+)["']/gi,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//gi,
    /<enclosure[^>]+type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/gi,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/gi,
    /<img[^>]+data-src=["']([^"']+)["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
  ];
  for (const re of regexes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      const u = m[1]?.trim();
      if (u && /^https?:\/\//i.test(u) && !isLowQualityThumbUrl(u)) {
        // Prefer original high-res over WordPress/CDN tiny thumbnails
        const upgraded = u.replace(/-\d{2,3}x\d{2,3}(\.(?:jpg|jpeg|png|webp))/i, '$1');
        candidates.push(upgraded);
      }
    }
  }
  const chosen = candidates[0];
  if (chosen) {
    return `/api/feeds/image?url=${encodeURIComponent(chosen)}`;
  }
  return fallbackImg;
}

export function extractArticleContentHtml(
  html: string,
  fallbackUrl: string
): { paragraphs: string[]; heroImageUrl?: string; videoUrl?: string } {
  const ogImg =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];

  const heroImageUrl =
    ogImg && /^https?:\/\//i.test(ogImg) && !isLowQualityThumbUrl(ogImg)
      ? `/api/feeds/image?url=${encodeURIComponent(ogImg)}`
      : undefined;

  const videoUrl = extractVideoFromBlock(html);

  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const pMatches = cleanedHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paragraphs: string[] = [];
  for (const rawP of pMatches) {
    const txt = stripHtml(rawP);
    if (txt.length >= 48 && !/cookie|subscribe|sign up|privacy policy|all rights reserved/i.test(txt)) {
      paragraphs.push(txt);
    }
    if (paragraphs.length >= 10) break;
  }

  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [`Full coverage available at ${fallbackUrl}`],
    heroImageUrl,
    videoUrl,
  };
}

export function makeSvgBannerDataUrl(label: string, c1: string, c2: string): string {
  const safeLabel = label.replace(/[<>&"']/g, '').slice(0, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="960" height="540" fill="url(#bg)"/><circle cx="810" cy="120" r="165" fill="#ffffff" opacity="0.08"/><circle cx="165" cy="450" r="210" fill="#ffffff" opacity="0.07"/><rect x="66" y="384" width="165" height="8" rx="4" fill="#ffffff" opacity="0.55"/><text x="66" y="348" fill="#ffffff" font-family="system-ui,sans-serif" font-size="44" font-weight="700" opacity="0.94">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function parseRssOrAtomXml(
  xml: string,
  sourceName: string,
  category: string,
  fallbackColors: [string, string] = ['#1D4ED8', '#0EA5E9']
): NewsFeedItem[] {
  const items: NewsFeedItem[] = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entryMatches = itemMatches.length > 0 ? [] : xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = [...itemMatches, ...entryMatches];

  blocks.forEach((block, idx) => {
    const rawTitle = extractTag(block, 'title');
    const title = stripHtml(rawTitle);
    if (!title) return;

    const linkTag = extractTag(block, 'link');
    const atomHref = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? '';
    const url = /^https?:\/\//i.test(linkTag) ? linkTag : atomHref || 'https://www.nintendo.com';

    const rawDesc =
      extractTag(block, 'content:encoded') ||
      extractTag(block, 'content') ||
      extractTag(block, 'description') ||
      extractTag(block, 'summary');
    const cleanBody = stripHtml(rawDesc);
    const summary =
      cleanBody.length > 150 ? `${cleanBody.slice(0, 147).trim()}...` : cleanBody || title;

    const pubRaw =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      '';
    const parsedDate = pubRaw ? new Date(pubRaw) : null;
    const publishedAt =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Latest';

    const fallbackImg = makeSvgBannerDataUrl(sourceName, fallbackColors[0], fallbackColors[1]);
    const imageUrl = extractImageFromBlock(block, fallbackImg);
    const videoUrl = extractVideoFromBlock(block);

    items.push({
      id: `${category}-${sourceName.toLowerCase().replace(/\W+/g, '-')}-${idx}`,
      title,
      summary,
      content: cleanBody || summary,
      sourceName,
      publishedAt,
      imageUrl,
      url,
      category,
      videoUrl,
    });
  });

  return items;
}

export function parseRedditJsonPosts(
  json: unknown,
  sourceLabel: string,
  category: string
): NewsFeedItem[] {
  const root = json as {
    data?: {
      children?: Array<{
        data?: {
          id?: string;
          title?: string;
          selftext?: string;
          permalink?: string;
          url?: string;
          created_utc?: number;
          thumbnail?: string;
          preview?: { images?: Array<{ source?: { url?: string } }> };
          media?: { reddit_video?: { fallback_url?: string } };
        };
      }>;
    };
  };
  const children = root?.data?.children ?? [];
  const items: NewsFeedItem[] = [];

  for (const child of children) {
    const post = child?.data;
    if (!post?.title) continue;

    const previewUrl = post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&');
    const thumb =
      previewUrl && /^https?:\/\//i.test(previewUrl)
        ? previewUrl
        : post.thumbnail && /^https?:\/\//i.test(post.thumbnail)
          ? post.thumbnail
          : '';

    const imageUrl = thumb
      ? `/api/feeds/image?url=${encodeURIComponent(thumb)}`
      : makeSvgBannerDataUrl('Android Ports', '#16A34A', '#0D9488');

    const bodyText = (post.selftext || '').replace(/\s+/g, ' ').trim();
    const summary = bodyText
      ? bodyText.length > 150
        ? `${bodyText.slice(0, 147)}...`
        : bodyText
      : `${sourceLabel} discussion on Android game ports, performance & handheld compatibility.`;

    const dateStr = post.created_utc
      ? new Date(post.created_utc * 1000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Trending';

    const videoUrl =
      post.media?.reddit_video?.fallback_url ||
      extractVideoFromBlock(post.url || '') ||
      undefined;

    items.push({
      id: `reddit-${post.id || items.length}`,
      title: decodeEntities(post.title),
      summary,
      content: bodyText || summary,
      sourceName: sourceLabel,
      publishedAt: dateStr,
      imageUrl,
      url: post.permalink ? `https://www.reddit.com${post.permalink}` : post.url || 'https://www.reddit.com',
      category,
      videoUrl,
    });
  }

  return items;
}

export const NSO_FALLBACK_ITEMS: NewsFeedItem[] = [
  {
    id: 'nso-fb-1',
    title: 'Nintendo Switch 2 Direct: Launch Lineup & GameChat Deep Dive',
    summary: 'Explore 120Hz handheld display modes, upgraded Joy-Con 2 magnetic rails, and cross-generation enhancements.',
    content:
      'Nintendo showcased the next wave of Switch 2 software including Mario Kart World, updated Switch 2 Editions, and native GameChat voice rooms with friend invites right from the HOME Menu.\n\nAlongside higher-bandwidth USB-C docked output and HDR support, Nintendo detailed faster eShop navigation, seamless GameShare invites for local handheld co-op, and upgraded frame rates for signature first-party releases.',
    sourceName: 'Nintendo.com',
    publishedAt: 'Featured',
    imageUrl: makeSvgBannerDataUrl('Nintendo Direct', '#E60012', '#991B1B'),
    url: 'https://www.nintendo.com/us/whatsnew/',
    category: 'nso',
    videoUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
  },
  {
    id: 'nso-fb-2',
    title: 'Nintendo Classics Update: GameCube & N64 Titles Added to Expansion Pack',
    summary: 'Rewind support, crisp CRT filters, and online multiplayer lobbies arrive for Nintendo Switch Online members.',
    content:
      'Members with Nintendo Switch Online + Expansion Pack can now jump into classic racing, RPG, and action favorites with customizable controller bindings and instant save states.\n\nThe latest update adds improved button remapping per game, four-player friend lobbies with low-latency rollback networking, and widescreen enhancements where supported.',
    sourceName: 'Nintendo Life',
    publishedAt: 'Today',
    imageUrl: makeSvgBannerDataUrl('Switch Online', '#B91C1C', '#F97316'),
    url: 'https://www.nintendolife.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-3',
    title: 'Mario Kart World Adds Knockout Tour & 24-Player Online Grand Prix',
    summary: 'Seamless open-route tracks connect stages across continents with dynamic weather and custom rules.',
    content:
      'Take on 23 rivals online in continuous cross-country rallies or team up via Nintendo Network friend lobbies for weekend tournaments.\n\nNew photo mode filters, off-road rail grinds, and instant GameChat party joining let handheld and docked players race together without interrupting active sessions.',
    sourceName: 'Nintendo.com',
    publishedAt: 'Latest',
    imageUrl: makeSvgBannerDataUrl('Mario Kart World', '#0284C7', '#1E3A8A'),
    url: 'https://www.nintendo.com/us/whatsnew/',
    category: 'nso',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  },
  {
    id: 'nso-fb-4',
    title: 'Handheld Performance Roundup: Indie Ports Targeting Locked 60 FPS',
    summary: 'Developers share frame-pacing tips for Snapdragon handhelds and Switch 2 portable mode.',
    content:
      'Independent studios continue optimizing shaders, adaptive resolution scaling, and controller glyphs so handheld players get responsive 60 FPS gameplay without battery drain.\n\nHighlights include upgraded Vulkan shader pre-caching, crisp UI typography at 1080p handheld density, and full button-prompt detection.',
    sourceName: 'Gematsu',
    publishedAt: 'This Week',
    imageUrl: makeSvgBannerDataUrl('Indie Showcase', '#7C3AED', '#2563EB'),
    url: 'https://www.gematsu.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-5',
    title: 'Metroid Prime 4: Beyond Showcases 120 FPS Performance Mode & Mouse Aim',
    summary: 'Retro Studios confirms dual performance profiles and magnetic Joy-Con pointer precision.',
    content:
      'Samus Aran returns across Planet Viewros with selectable Quality (4K60 docked / 1080p60 handheld) and Performance (1080p120 docked / 720p120 handheld) modes.\n\nPlayers can switch seamlessly between traditional dual-analog controls, gyro fine-tuning, and tabletop optical tracking.',
    sourceName: 'Nintendo.com',
    publishedAt: 'May 19',
    imageUrl: makeSvgBannerDataUrl('Metroid Prime 4', '#0F172A', '#0EA5E9'),
    url: 'https://www.nintendo.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-6',
    title: 'Zelda Notes App Update: Voice Memories & QR Blueprint Sharing',
    summary: 'Upload Autobuild schematics and share pinned map routes directly with Switch Online friends.',
    content:
      'The Switch 2 Editions of Breath of the Wild and Tears of the Kingdom introduce faster loading times, 60 FPS traversal across Hyrule Field, and cloud-synced community creations.\n\nFriends can scan shared codes directly into their inventory or follow GPS-style audio hints while exploring.',
    sourceName: 'Nintendo Life',
    publishedAt: 'May 18',
    imageUrl: makeSvgBannerDataUrl('Zelda Switch 2', '#047857', '#0EA5E9'),
    url: 'https://www.nintendolife.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-7',
    title: 'Donkey Kong Bananza Destruction Engine Breakdown & Co-Op Details',
    summary: 'Voxel-assisted terrain smashing opens hidden underground worlds and shortcut routes.',
    content:
      'Every cliffside, golden deposit, and subterranean temple reacts dynamically to Donkey Kong’s punches and throws, creating emergent platforming paths.\n\nLocal two-player co-op lets a second player assist with Pauline’s vocal shockwaves across vertical levels.',
    sourceName: 'VGC',
    publishedAt: 'May 17',
    imageUrl: makeSvgBannerDataUrl('DK Bananza', '#B45309', '#DC2626'),
    url: 'https://www.videogameschronicle.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-8',
    title: 'Silksong & Hades II Portable Frame-Time Benchmarks on Snapdragon OLED',
    summary: 'Tested frame times, thermals, and battery endurance across 16:9 1080p AMOLED handhelds.',
    content:
      'Action roguelikes and hand-drawn metroidvanias shine on 1080p AMOLED screens thanks to deep ink blacks and instant pixel response.\n\nBoth titles maintain locked frame delivery under modest TDP budgets for five-plus hours of untethered play.',
    sourceName: 'Nintendo Life',
    publishedAt: 'May 16',
    imageUrl: makeSvgBannerDataUrl('Hollow Knight', '#1E293B', '#E11D48'),
    url: 'https://www.nintendolife.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-9',
    title: 'GameCube Classics Controller Support & Analog Trigger Calibration',
    summary: 'Customize deadzones and half-press L/R sensitivity for classic racing and action games.',
    content:
      'The latest system firmware enables granular trigger curve adjustments so Sunshine water-pack aiming and F-Zero GX drift inputs feel spot-on across both Pro and third-party controllers.',
    sourceName: 'Gematsu',
    publishedAt: 'May 15',
    imageUrl: makeSvgBannerDataUrl('GameCube NSO', '#4338CA', '#7C3AED'),
    url: 'https://www.gematsu.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-10',
    title: 'Splatoon 3 Seasonal Update Adds Fresh Weapon Kits & Urchin Underpass',
    summary: 'Switch 2 compatibility patch sharpens ink reflections and lobby matchmaking speed.',
    content:
      'Players jumping back into Turf War and Salmon Run gain 30 new weapon kits alongside faster square-to-battle transitions and sharper UI badge rendering.',
    sourceName: 'Nintendo.com',
    publishedAt: 'May 14',
    imageUrl: makeSvgBannerDataUrl('Splatoon 3', '#4F46E5', '#EAB308'),
    url: 'https://www.nintendo.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-11',
    title: 'Kirby Air Riders Revealed: Sakurai Returns for High-Speed City Trial',
    summary: 'Boost-and-glide arena battles return with modernized online matchmaking.',
    content:
      'Masahiro Sakurai’s return to Dream Land’s cult-classic racer brings chaotic multi-stage City Trial stadiums, custom Warp Star builds, and online Ranked Events.',
    sourceName: 'VGC',
    publishedAt: 'May 13',
    imageUrl: makeSvgBannerDataUrl('Kirby Air Riders', '#EC4899', '#7C3AED'),
    url: 'https://www.videogameschronicle.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-12',
    title: 'Virtual Game Cards: Lending Digital Titles Across Family Accounts',
    summary: 'How to eject, transfer, and play shared software offline for up to 14 days.',
    content:
      'Nintendo’s Virtual Game Card system treats digital purchases like physical cartridges you can slot between household systems via local wireless proximity.',
    sourceName: 'Nintendo.com',
    publishedAt: 'May 12',
    imageUrl: makeSvgBannerDataUrl('Virtual Cards', '#0284C7', '#0F766E'),
    url: 'https://www.nintendo.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-13',
    title: 'Cyberpunk 2077 Switch 2 Edition: DLSS Handheld & Gyro Aiming Impressions',
    summary: 'Complete edition with Phantom Liberty fits on a 64GB card with cross-progression.',
    content:
      'CD Projekt Red demonstrated cross-save syncing from PC to handheld alongside crisp gyro ADS aiming and steady 40 FPS VRR/Performance presets in Dogtown.',
    sourceName: 'Nintendo Life',
    publishedAt: 'May 11',
    imageUrl: makeSvgBannerDataUrl('Night City 2077', '#EAB308', '#0F172A'),
    url: 'https://www.nintendolife.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-14',
    title: 'Street Fighter 6 Amiibo Cards & Local Table-Top Fighter Tournaments',
    summary: 'All Year 1–2 fighters join the portable roster with instant offline Versus.',
    content:
      'Capcom’s portable build preserves crossplay netcode and adds local wireless lobby support so two handhelds can run 60 FPS sets anywhere.',
    sourceName: 'Gematsu',
    publishedAt: 'May 10',
    imageUrl: makeSvgBannerDataUrl('Street Fighter 6', '#DC2626', '#7C3AED'),
    url: 'https://www.gematsu.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-15',
    title: 'Pokopia & Pokemon Legends: Z-A Showcases Real-Time Battle Movement',
    summary: 'Coordinated dodge timing and urban Lumiose verticality redefine trainer battles.',
    content:
      'Game Freak highlighted real-time positioning during wild encounters in Lumiose City alongside cozy island-building co-op in Pokopia.',
    sourceName: 'Nintendo.com',
    publishedAt: 'May 9',
    imageUrl: makeSvgBannerDataUrl('Pokemon Legends', '#059669', '#0284C7'),
    url: 'https://www.nintendo.com/',
    category: 'nso',
  },
  {
    id: 'nso-fb-16',
    title: 'Firmware Update 20.1: MicroSD Express Transfer & Sound Customization',
    summary: 'Faster screenshot imports, custom UI chimes, and brighter HDR calibration.',
    content:
      'The newest system update enhances album thumbnail indexing speed and adds clearer contrast controls for vivid AMOLED handheld displays.',
    sourceName: 'Nintendo.com',
    publishedAt: 'May 8',
    imageUrl: makeSvgBannerDataUrl('Firmware 20.1', '#334155', '#0EA5E9'),
    url: 'https://www.nintendo.com/',
    category: 'nso',
  },
];

export const NEWS_FALLBACK_BY_CATEGORY: Record<NewsCategoryId, NewsFeedItem[]> = {
  news: [
    {
      id: 'news-fb-1',
      title: 'Global Headlines: Major Energy & Transit Projects Accelerate in 2026',
      summary: 'Clean grid upgrades and rail modernization top international infrastructure reports this week.',
      content:
        'Regional planners highlighted battery storage expansions and high-efficiency transit corridors designed to lower commuter wait times and stabilize peak energy demand.',
      sourceName: 'World Wire',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('World News', '#1E40AF', '#3B82F6'),
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      category: 'news',
    },
    {
      id: 'news-fb-2',
      title: 'Science & Space: Lunar Relay Satellites Complete Telemetry Check',
      summary: 'High-bandwidth optical links passed initial orbital stress tests ahead of upcoming robotic missions.',
      content:
        'Mission engineers verified continuous optical data relay across deep-space ground stations, paving the way for higher-resolution telemetry from south-pole landers.',
      sourceName: 'Global Science',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Space & Earth', '#0F172A', '#0284C7'),
      url: 'https://www.bbc.com/news',
      category: 'news',
    },
    {
      id: 'news-fb-3',
      title: 'International Travel Digital Boarding Standards Roll Out',
      summary: 'Airports adopt faster contactless identity lanes to trim security queues during peak travel.',
      content:
        'Major aviation hubs are expanding biometric opt-in gates with encrypted mobile credentials stored locally on traveler devices.',
      sourceName: 'Daily Dispatch',
      publishedAt: 'Latest',
      imageUrl: makeSvgBannerDataUrl('Headlines', '#065F46', '#10B981'),
      url: 'https://www.reuters.com/',
      category: 'news',
    },
    {
      id: 'news-fb-4',
      title: 'Ocean Conservation Buoy Network Expands Reef Temperature Tracking',
      summary: 'Real-time coastal sensors help marine teams protect Caribbean and Pacific coral habitats.',
      content:
        'Automated solar buoys now transmit hourly subsurface telemetry to university marine stations for early bleaching alerts.',
      sourceName: 'Eco Report',
      publishedAt: 'This Week',
      imageUrl: makeSvgBannerDataUrl('Ocean Watch', '#0369A1', '#06B6D4'),
      url: 'https://www.npr.org/',
      category: 'news',
    },
  ],
  sports: [
    {
      id: 'sports-fb-1',
      title: 'Baseball & Basketball Highlights: Late-Inning Rallies Steal the Spotlight',
      summary: 'Clutch bullpen appearances and fourth-quarter defensive stops headline weekend action.',
      content:
        'Fans packed stadiums across the league as division leaders traded narrow victories heading into mid-season series.',
      sourceName: 'ESPN Sports',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Pro Sports', '#DC2626', '#991B1B'),
      url: 'https://www.espn.com/',
      category: 'sports',
    },
    {
      id: 'sports-fb-2',
      title: 'Caribbean Winter & BSN Basketball Stars Shine on International Courts',
      summary: 'Puerto Rican point guards and wing scorers post career highs in clutch playoff matchups.',
      content:
        'High-tempo perimeter shooting and lockdown transition defense powered thrilling overtime finishes for Caribbean fan favorites.',
      sourceName: 'Court Side',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Hoops Live', '#EA580C', '#B45309'),
      url: 'https://www.espn.com/nba/',
      category: 'sports',
    },
    {
      id: 'sports-fb-3',
      title: 'Champions Knockout Preview: Tactical Midfield Battles Take Center Stage',
      summary: 'Managers prepare high-press formations ahead of decisive second-leg European fixtures.',
      content:
        'Squad rotation and set-piece precision will be critical as clubs chase clean sheets on the road.',
      sourceName: 'Pitch Report',
      publishedAt: 'Latest',
      imageUrl: makeSvgBannerDataUrl('Football Desk', '#15803D', '#047857'),
      url: 'https://www.espn.com/soccer/',
      category: 'sports',
    },
    {
      id: 'sports-fb-4',
      title: 'Motorsport Telemetry: Tire Strategy Decides Tight Street-Circuit Qualifier',
      summary: 'Two-tenths of a second separate the top four drivers entering Sunday afternoon’s grid.',
      content:
        'Late track evolution rewarded teams brave enough to run soft-compound laps in the final two minutes of qualifying.',
      sourceName: 'Apex Motor',
      publishedAt: 'This Week',
      imageUrl: makeSvgBannerDataUrl('Motorsport', '#1E293B', '#E11D48'),
      url: 'https://www.espn.com/racing/',
      category: 'sports',
    },
  ],
  tech: [
    {
      id: 'tech-fb-1',
      title: 'Snapdragon Handheld Efficiency Benchmarks Show Major Thermal Gains',
      summary: 'Driver updates cut power draw during 1080p Vulkan emulation and native Android ports.',
      content:
        'Updated Turnip Mesa drivers and governor tuning allow compact handhelds like the Retroid Pocket 5 to hold steady 60 FPS with cooler battery temperatures.',
      sourceName: 'Ars Technica',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Handheld Tech', '#0284C7', '#4F46E5'),
      url: 'https://arstechnica.com/',
      category: 'tech',
    },
    {
      id: 'tech-fb-2',
      title: 'AMOLED Display Calibration: Why 16:9 1080p Panels Pop in Retro & Modern UI',
      summary: 'Pixel-accurate subpixel rendering and high contrast ratios elevate handheld frontends.',
      content:
        'Modern 5.5-inch AMOLED screens pair deep blacks with crisp rounded UI typography for console-grade readability.',
      sourceName: 'The Verge',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Display Lab', '#6D28D9', '#EC4899'),
      url: 'https://www.theverge.com/',
      category: 'tech',
    },
    {
      id: 'tech-fb-3',
      title: 'Open-Source Vulkan & Shader Cache Improvements Hit Mobile GPUs',
      summary: 'Faster pipeline pre-compilation drastically cuts first-run stutter in open-world titles.',
      content:
        'Community GPU developers continue shrinking shader compile hitches across Adreno-powered Android handheld devices.',
      sourceName: 'Tech Wire',
      publishedAt: 'Latest',
      imageUrl: makeSvgBannerDataUrl('Vulkan Dev', '#0F766E', '#0EA5E9'),
      url: 'https://arstechnica.com/gadgets/',
      category: 'tech',
    },
    {
      id: 'tech-fb-4',
      title: 'USB-C Docked Mode Standards Simplify 1080p60 Handheld TV Output',
      summary: 'Low-latency DisplayPort Alt Mode adapters bring plug-and-play living room play.',
      content:
        'Single-cable charging and 60Hz HDMI output let handheld consoles double as compact living-room systems.',
      sourceName: 'Hardware Insider',
      publishedAt: 'This Week',
      imageUrl: makeSvgBannerDataUrl('USB-C Dock', '#334155', '#0284C7'),
      url: 'https://www.theverge.com/tech',
      category: 'tech',
    },
  ],
  android_ports: [
    {
      id: 'ports-fb-1',
      title: 'r/EmulationOnAndroid: Retroid Pocket 5 Native Android Port Settings Guide',
      summary: 'Community-tested configs for Hollow Knight, Balatro, Silksong, and Cuphead APKs at 60 FPS.',
      content:
        'Users on r/EmulationOnAndroid shared updated controller mappings, 16:9 HUD scaling tweaks, and thermal profiles for seamless handheld APK port play.',
      sourceName: 'r/EmulationOnAndroid',
      publishedAt: 'Hot',
      imageUrl: makeSvgBannerDataUrl('Android Ports', '#16A34A', '#15803D'),
      url: 'https://www.reddit.com/r/EmulationOnAndroid/',
      category: 'android_ports',
    },
    {
      id: 'ports-fb-2',
      title: 'APKPorts Release Roundup: New Controller-Ready Fan Games & Indie Ports',
      summary: 'Full gamepad navigation, cloud save export, and widescreen patches highlight this month’s drops.',
      content:
        'Several beloved PC indies now feature native Android builds with Xbox/Switch button glyph switching and unlocked framerates.',
      sourceName: 'r/AndroidGaming',
      publishedAt: 'Trending',
      imageUrl: makeSvgBannerDataUrl('APKPorts News', '#0D9488', '#0284C7'),
      url: 'https://www.apkports.com/games',
      category: 'android_ports',
    },
    {
      id: 'ports-fb-3',
      title: 'Pegasus & SkylineOS Frontend Tips: Custom Cover Art & Artwork Palettes',
      summary: 'How handheld builders keep square 1:1 covers crisp and match OS HUD colors dynamically.',
      content:
        'Pairing square cover art with reactive typography makes handheld libraries feel indistinguishable from first-party console dashboards.',
      sourceName: 'r/SBCGaming',
      publishedAt: 'Popular',
      imageUrl: makeSvgBannerDataUrl('SBCGaming', '#7C3AED', '#2563EB'),
      url: 'https://www.reddit.com/r/SBCGaming/',
      category: 'android_ports',
    },
    {
      id: 'ports-fb-4',
      title: 'Winlator & Native Port Comparison: Battery Life vs Frame Pacing on RP5',
      summary: 'Native Android ports deliver up to 2x longer battery life compared to Windows translation layers.',
      content:
        'Testing side by side confirms native ARM64 Android game ports run quieter and preserve battery on long flights.',
      sourceName: 'r/Retroid',
      publishedAt: 'This Week',
      imageUrl: makeSvgBannerDataUrl('r/Retroid', '#059669', '#0F766E'),
      url: 'https://www.reddit.com/r/retroid/',
      category: 'android_ports',
    },
  ],
  finance: [
    {
      id: 'fin-fb-1',
      title: 'Markets Update: Semiconductor & Gaming Stocks Lead Tech Sector Gains',
      summary: 'Strong handheld hardware demand and digital software sales lift quarterly guidance.',
      content:
        'Analysts pointed to resilient consumer appetite for portable gaming ecosystems and cloud infrastructure spending.',
      sourceName: 'Market Watch',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Market Desk', '#065F46', '#047857'),
      url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
      category: 'finance',
    },
    {
      id: 'fin-fb-2',
      title: 'Small Business Digital Payments & Instant Settlement Trends',
      summary: 'Zero-fee local transfer rails help independent merchants streamline checkout.',
      content:
        'Retailers across North America and the Caribbean are adopting instant settlement tools to improve weekly cash flow.',
      sourceName: 'Finance Brief',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('FinTech News', '#0F766E', '#0369A1'),
      url: 'https://www.marketwatch.com/',
      category: 'finance',
    },
    {
      id: 'fin-fb-3',
      title: 'Consumer Savings Rates Hold Steady Amid Lower Electronics Costs',
      summary: 'Competitive component pricing keeps flash storage and OLED panels affordable.',
      content:
        'Supply chain normalization in NAND flash and mobile displays continues to benefit mid-range consumer hardware.',
      sourceName: 'Economy Daily',
      publishedAt: 'Latest',
      imageUrl: makeSvgBannerDataUrl('Economy', '#1E3A8A', '#0F766E'),
      url: 'https://www.marketwatch.com/',
      category: 'finance',
    },
    {
      id: 'fin-fb-4',
      title: 'Treasury Yields & Housing Affordability Outlook for Q3',
      summary: 'Regional builders pivot toward urban infill apartments and walkable mixed-use neighborhoods.',
      content:
        'Municipal zoning updates aim to increase multi-family housing inventory near public transit corridors.',
      sourceName: 'Capital Report',
      publishedAt: 'This Week',
      imageUrl: makeSvgBannerDataUrl('Housing & Rates', '#374151', '#047857'),
      url: 'https://www.marketwatch.com/',
      category: 'finance',
    },
  ],
  politics: [
    {
      id: 'pol-fb-1',
      title: 'Civic Tech & Digital Accessibility Rules Advance in Committee',
      summary: 'Bipartisan lawmakers back open standards for public transit and municipal portals.',
      content:
        'The updated guidelines require mobile-first public service dashboards and transparent open-data APIs.',
      sourceName: 'Civic Wire',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Policy Desk', '#1E293B', '#3B82F6'),
      url: 'https://www.npr.org/sections/politics/',
      category: 'politics',
    },
    {
      id: 'pol-fb-2',
      title: 'Clean Grid Permitting Reform Debated in Energy Subcommittee',
      summary: 'Governors call for faster interconnection queues for solar microgrids and battery storage.',
      content:
        'Coastal municipalities emphasized resilient distributed microgrids capable of keeping hospitals and schools online during storms.',
      sourceName: 'Capitol Brief',
      publishedAt: 'Today',
      imageUrl: makeSvgBannerDataUrl('Energy Policy', '#312E81', '#1D4ED8'),
      url: 'https://www.npr.org/',
      category: 'politics',
    },
    {
      id: 'pol-fb-3',
      title: 'Broadband Equity Grants Expand Fiber Connectivity to Rural Schools',
      summary: 'New deployments bring symmetrical gigabit lines to libraries and community centers.',
      content:
        'Local districts plan to pair fiber upgrades with digital literacy and STEM lab workshops.',
      sourceName: 'Public Affairs',
      publishedAt: 'Latest',
      imageUrl: makeSvgBannerDataUrl('Broadband', '#0F172A', '#0EA5E9'),
      url: 'https://www.npr.org/',
      category: 'politics',
    },
    {
      id: 'pol-fb-4',
      title: 'Right-to-Repair Protections for Handheld Consoles Gain Momentum',
      summary: 'Proposed rules encourage modular thumbsticks, accessible batteries, and public repair guides.',
      content:
        'Consumer advocates welcomed longer parts availability for portable electronics and game controllers.',
      sourceName: 'Policy Watch',
      publishedAt: 'This Week',
      imageUrl: makeSvgBannerDataUrl('Right to Repair', '#334155', '#6366F1'),
      url: 'https://www.npr.org/',
      category: 'politics',
    },
  ],
  puerto_rico: [
    {
      id: 'pr-fb-1',
      title: 'Santurce & San Juan Cultural Nights: Arte, Música y Gastronomía Local',
      summary: 'Calle Cerra y La Placita reúnen artistas independientes, talleres y festivales comunitarios este fin de semana.',
      content:
        'Galerías y espacios creativos en Santurce celebran exposiciones abiertas al público junto a propuestas culinarias locales y música en vivo.',
      sourceName: 'Puerto Rico Hoy',
      publishedAt: 'Hoy',
      imageUrl: makeSvgBannerDataUrl('Santurce PR', '#0284C7', '#E11D48'),
      url: 'https://www.elnuevodia.com/',
      category: 'puerto_rico',
    },
    {
      id: 'pr-fb-2',
      title: 'Proyectos de Energía Solar Comunitaria Avanzan en Municipios de la Isla',
      summary: 'Microrredes solares fortalecen centros comunitarios y comercios en la zona metropolitana y la montaña.',
      content:
        'Iniciativas locales instalan sistemas con baterías de respaldo para asegurar energía estable durante la temporada pico.',
      sourceName: 'NotiCel / PR',
      publishedAt: 'Hoy',
      imageUrl: makeSvgBannerDataUrl('Puerto Rico Energía', '#0369A1', '#16A34A'),
      url: 'https://www.noticel.com/',
      category: 'puerto_rico',
    },
    {
      id: 'pr-fb-3',
      title: 'Desarrolladores Boricuas Impulsan Escena Indie y Torneos Handheld en PR',
      summary: 'Comunidades de gaming en San Juan, Bayamón y Ponce organizan meetups de consolas portátiles.',
      content:
        'Entusiastas de retro gaming y desarrollo indie comparten demos jugables y configuraciones optimizadas cada mes.',
      sourceName: 'PR Tech & Gaming',
      publishedAt: 'Reciente',
      imageUrl: makeSvgBannerDataUrl('Gaming PR', '#1D4ED8', '#E60012'),
      url: 'https://www.metro.pr/',
      category: 'puerto_rico',
    },
    {
      id: 'pr-fb-4',
      title: 'Temporada del BSN y Pelota Invernal: Afición Llena las Canchas de la Isla',
      summary: 'Cangrejeros, Vaqueros y Piratas protagonizan duelos cerrados rumbo a la postemporada.',
      content:
        'La fanaticada boricua respalda cada partido con ambientes eléctricos en el Coliseo Roberto Clemente y coliseos regionales.',
      sourceName: 'Deportes PR',
      publishedAt: 'Esta Semana',
      imageUrl: makeSvgBannerDataUrl('Deportes PR', '#DC2626', '#1E3A8A'),
      url: 'https://www.primerahora.com/',
      category: 'puerto_rico',
    },
  ],
};
