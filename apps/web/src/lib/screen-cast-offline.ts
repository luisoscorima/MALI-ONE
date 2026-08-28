import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
const CONFIG_CACHE = 'screen-cast-config-v6';
const MEDIA_CACHE = 'screen-cast-media-v6';

const blobUrls = new Map<string, string>();

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

export function screenCastMediaProxyUrl(mediaUrl: string): string {
  return `/api/screen-cast/media?src=${encodeURIComponent(mediaUrl)}`;
}

function shouldProxyMedia(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith('.amazonaws.com') || host.endsWith('.cloudfront.net');
  } catch {
    return false;
  }
}

export function playbackSrcFor(mediaUrl: string): string {
  return blobUrls.get(mediaUrl) || (
    shouldProxyMedia(mediaUrl) ? screenCastMediaProxyUrl(mediaUrl) : mediaUrl
  );
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

export type CacheItemStatus = 'hit' | 'downloaded' | 'failed' | 'skipped';

export type CacheProgress = {
  index: number;
  total: number;
  mediaUrl: string;
  status: CacheItemStatus;
};

export type CachePlaylistResult = {
  total: number;
  hits: number;
  downloaded: number;
  failed: number;
};

async function rememberBlob(mediaUrl: string, res: Response) {
  const blob = await res.blob();
  const prev = blobUrls.get(mediaUrl);
  if (prev) URL.revokeObjectURL(prev);
  blobUrls.set(mediaUrl, URL.createObjectURL(blob));
}

async function cacheOneItem(
  mediaCache: Cache,
  mediaUrl: string,
): Promise<CacheItemStatus> {
  if (!isOfflineCacheableMediaUrl(mediaUrl)) return 'skipped';

  const existing = await mediaCache.match(mediaUrl);
  if (existing) {
    if (!blobUrls.has(mediaUrl)) {
      await rememberBlob(mediaUrl, existing.clone());
    }
    return 'hit';
  }

  try {
    const fetchUrl = shouldProxyMedia(mediaUrl)
      ? screenCastMediaProxyUrl(mediaUrl)
      : mediaUrl;
    const sameOrigin = fetchUrl.startsWith('/') ||
      isCorsCacheableMediaUrl(fetchUrl);
    const res = await fetch(fetchUrl, {
      mode: sameOrigin ? 'cors' : 'no-cors',
      credentials: 'omit',
    });
    if (!(res.ok || res.type === 'opaque')) return 'failed';
    const stored = res.clone();
    await mediaCache.put(mediaUrl, stored);
    if (res.type !== 'opaque') {
      await rememberBlob(mediaUrl, res);
    }
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export async function cacheScreenCastPlaylist(
  screenKey: string,
  config: ScreenCastPublicConfigDto,
  onProgress?: (progress: CacheProgress) => void,
): Promise<CachePlaylistResult> {
  const result: CachePlaylistResult = {
    total: config.items.length,
    hits: 0,
    downloaded: 0,
    failed: 0,
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
    const keep = new Set(config.items.map((item) => item.mediaUrl));

    for (let i = 0; i < config.items.length; i++) {
      const item = config.items[i];
      const status = await cacheOneItem(mediaCache, item.mediaUrl);
      if (status === 'hit') result.hits += 1;
      else if (status === 'downloaded') result.downloaded += 1;
      else if (status === 'failed') result.failed += 1;
      onProgress?.({
        index: i + 1,
        total: config.items.length,
        mediaUrl: item.mediaUrl,
        status,
      });
    }

    const keys = await mediaCache.keys();
    await Promise.all(
      keys.map(async (request) => {
        if (!keep.has(request.url)) {
          await mediaCache.delete(request);
        }
      }),
    );

    for (const [url, blobUrl] of blobUrls) {
      if (!keep.has(url)) {
        URL.revokeObjectURL(blobUrl);
        blobUrls.delete(url);
      }
    }
  } catch {
    // ignore cache failures — playback can still use the proxy
  }

  return result;
}
