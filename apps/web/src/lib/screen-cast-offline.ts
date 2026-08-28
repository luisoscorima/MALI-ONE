import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
const CONFIG_CACHE = 'screen-cast-config-v6';
const MEDIA_CACHE = 'screen-cast-media-v6';

/**
 * True only for same-origin URLs. Safe to set crossOrigin="anonymous".
 * S3 signed URLs usually lack bucket CORS — do NOT set crossOrigin on them
 * or the browser (and service worker) will fail the load.
 */
export function isCorsCacheableMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function isOfflineCacheableMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return true;
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith('.amazonaws.com')) return true;
    if (host.endsWith('.cloudfront.net')) return true;
    return false;
  } catch {
    return false;
  }
}

export async function registerScreenCastServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, {
      scope: '/screen-cast',
    });
    void reg.update();
  } catch {
    // SW optional — player still works online
  }
}

export type CachePlaylistResult = {
  total: number;
  hits: number;
  downloaded: number;
  failed: number;
  skipped: number;
};

/**
 * Background cache for images/gifs. Videos stay on S3 (range requests).
 * Never blocks playback.
 */
export async function cacheScreenCastPlaylist(
  screenKey: string,
  config: ScreenCastPublicConfigDto,
): Promise<CachePlaylistResult> {
  const result: CachePlaylistResult = {
    total: config.items.length,
    hits: 0,
    downloaded: 0,
    failed: 0,
    skipped: 0,
  };
  if (!('caches' in window)) return result;

  try {
    const configCache = await caches.open(CONFIG_CACHE);
    const configUrl = `/api/screen-cast/screens/${encodeURIComponent(screenKey)}/config`;
    await configCache.put(
      configUrl,
      new Response(JSON.stringify(config), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const mediaCache = await caches.open(MEDIA_CACHE);
    const keep = new Set<string>();

    for (const item of config.items) {
      if (item.mediaType === 'video' || !isOfflineCacheableMediaUrl(item.mediaUrl)) {
        result.skipped += 1;
        continue;
      }
      keep.add(item.mediaUrl);
      try {
        const existing = await mediaCache.match(item.mediaUrl);
        if (existing) {
          result.hits += 1;
          continue;
        }
        const sameOrigin = isCorsCacheableMediaUrl(item.mediaUrl);
        const res = await fetch(item.mediaUrl, {
          mode: sameOrigin ? 'cors' : 'no-cors',
          credentials: 'omit',
        });
        if (res.ok || res.type === 'opaque') {
          await mediaCache.put(item.mediaUrl, res.clone());
          result.downloaded += 1;
        } else {
          result.failed += 1;
        }
      } catch {
        result.failed += 1;
      }
    }

    const keys = await mediaCache.keys();
    await Promise.all(
      keys.map(async (request) => {
        if (!keep.has(request.url)) await mediaCache.delete(request);
      }),
    );
  } catch {
    // ignore — native <img>/<video> still load from S3
  }

  return result;
}
