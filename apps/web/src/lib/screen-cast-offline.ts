import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
/** Keep these names aligned with public/screen-cast-sw.js. */
const CONFIG_CACHE = 'screen-cast-config-v7';
const MEDIA_CACHE = 'screen-cast-media-v7';

function serviceWorkerUrl(): string {
  const buildId =
    typeof __SCREEN_CAST_BUILD_ID__ === 'string'
      ? __SCREEN_CAST_BUILD_ID__
      : 'dev';
  return buildId === 'dev'
    ? SW_URL
    : `${SW_URL}?build=${encodeURIComponent(buildId)}`;
}

function configUrl(screenKey: string): string {
  return `/api/screen-cast/screens/${encodeURIComponent(screenKey)}/config`;
}

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

function isManagedScreenCastMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const supportedHost =
      host.endsWith('.amazonaws.com') || host.endsWith('.cloudfront.net');
    return (
      supportedHost &&
      decodeURIComponent(parsed.pathname).includes('screen-cast/')
    );
  } catch {
    return false;
  }
}

/**
 * Stable same-origin playback URL. Stored S3 links may contain a seven-day
 * signature, but the API resolves the object key with its own credentials.
 */
export function screenCastOfflineMediaUrl(url: string): string {
  return isManagedScreenCastMediaUrl(url)
    ? `/api/screen-cast/media?src=${encodeURIComponent(url)}`
    : url;
}

export async function registerScreenCastServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    // The build query changes on every deploy, forcing install to refresh the
    // canonical HTML and its hashed JS/CSS even when this source file did not.
    const reg = await navigator.serviceWorker.register(serviceWorkerUrl(), {
      scope: '/screen-cast',
    });
    if (navigator.onLine !== false) {
      void reg.update().catch(() => undefined);
    }
    // CacheStorage can otherwise be evicted under storage pressure. Browsers
    // that do not expose persistent storage simply keep their normal policy.
    void navigator.storage?.persist?.().catch(() => false);
  } catch {
    // SW optional — player still works online
  }
}

export async function readCachedScreenCastConfig(
  screenKey: string,
): Promise<ScreenCastPublicConfigDto | null> {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(CONFIG_CACHE);
    const hit = await cache.match(configUrl(screenKey));
    if (!hit?.ok) return null;
    const data = (await hit.json()) as ScreenCastPublicConfigDto;
    return data && typeof data === 'object' && Array.isArray(data.items)
      ? data
      : null;
  } catch {
    return null;
  }
}

export async function cacheScreenCastConfig(
  screenKey: string,
  config: ScreenCastPublicConfigDto,
): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(CONFIG_CACHE);
    await cache.put(
      configUrl(screenKey),
      new Response(JSON.stringify(config), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch {
    // CacheStorage is best-effort; the live response remains usable.
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
 * Background cache for config and images/GIFs. Videos are handled separately
 * by screen-cast-video-cache so a complete file can be validated first.
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
    await cacheScreenCastConfig(screenKey, config);

    const mediaCache = await caches.open(MEDIA_CACHE);
    const keep = new Set<string>();

    for (const item of config.items) {
      if (item.mediaType === 'video' || !isOfflineCacheableMediaUrl(item.mediaUrl)) {
        result.skipped += 1;
        continue;
      }
      const localUrl = screenCastOfflineMediaUrl(item.mediaUrl);
      keep.add(new URL(localUrl, window.location.origin).href);
      try {
        const existing = await mediaCache.match(localUrl);
        if (existing) {
          if (existing.type !== 'opaque' && existing.status !== 0) {
            result.hits += 1;
            continue;
          }
          // A previous build may have copied an opaque direct-S3 response to
          // this proxy key. It cannot satisfy the CORS image request.
          await mediaCache.delete(localUrl);
        }

        // Only migrate readable legacy responses. Direct S3 requests are
        // normally opaque and cannot be replayed as a same-origin proxy result.
        if (localUrl !== item.mediaUrl) {
          const legacy = await mediaCache.match(item.mediaUrl);
          if (legacy) {
            if (legacy.type !== 'opaque' && legacy.status !== 0) {
              await mediaCache.put(localUrl, legacy.clone());
              result.hits += 1;
              continue;
            }
            await mediaCache.delete(item.mediaUrl);
          }
        }

        const sameOrigin = isCorsCacheableMediaUrl(localUrl);
        const res = await fetch(localUrl, {
          mode: sameOrigin ? 'cors' : 'no-cors',
          credentials: 'omit',
        });
        if (res.ok || res.type === 'opaque') {
          await mediaCache.put(localUrl, res.clone());
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
