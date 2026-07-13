import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
const CONFIG_CACHE = 'screen-cast-config-v4';
const MEDIA_CACHE = 'screen-cast-media-v4';

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

/**
 * Origins we can cache for offline via Cache API.
 * Cross-origin (S3/CloudFront) are fetched with mode: 'no-cors' (opaque
 * responses) so display works without bucket CORS configuration.
 * External hosts (e.g. mali.pe WordPress) are skipped — no offline cache.
 */
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
    // Force activate updated SW after deploy
    void reg.update();
  } catch {
    // SW optional — player still works online
  }
}

export async function cacheScreenCastPlaylist(
  screenKey: string,
  config: ScreenCastPublicConfigDto,
) {
  if (!('caches' in window)) return;

  try {
    const configCache = await caches.open(CONFIG_CACHE);
    const configUrl = `/api/screen-cast/screens/${encodeURIComponent(screenKey)}/config`;
    const response = new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json' },
    });
    await configCache.put(configUrl, response);

    const mediaCache = await caches.open(MEDIA_CACHE);
    await Promise.all(
      config.items.map(async (item) => {
        if (!isOfflineCacheableMediaUrl(item.mediaUrl)) return;

        try {
          const existing = await mediaCache.match(item.mediaUrl);
          if (existing) return;

          const sameOrigin = isCorsCacheableMediaUrl(item.mediaUrl);
          const res = await fetch(item.mediaUrl, {
            mode: sameOrigin ? 'cors' : 'no-cors',
            credentials: 'omit',
          });
          // CORS: check ok. no-cors: opaque (status 0) — still cacheable for <img>/<video>.
          if (res.ok || res.type === 'opaque') {
            await mediaCache.put(item.mediaUrl, res.clone());
          }
        } catch {
          // Skip — <img>/<video> will load natively
        }
      }),
    );
  } catch {
    // ignore cache failures
  }
}
