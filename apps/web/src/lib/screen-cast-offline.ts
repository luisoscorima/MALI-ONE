import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
const CONFIG_CACHE = 'screen-cast-config-v3';
const MEDIA_CACHE = 'screen-cast-media-v3';

/**
 * Same-origin and S3/CloudFront URLs support CORS and can be cached offline.
 * External hosts (e.g. mali.pe WordPress) lack CORS headers — load without
 * crossOrigin; they only display while the monitor has internet.
 */
export function isCorsCacheableMediaUrl(url: string): boolean {
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
        // External non-S3 media: skip Cache API (no CORS). Browser loads natively.
        if (!isCorsCacheableMediaUrl(item.mediaUrl)) return;

        try {
          const existing = await mediaCache.match(item.mediaUrl);
          if (existing) return;

          const res = await fetch(item.mediaUrl, {
            mode: 'cors',
            credentials: 'omit',
          });
          if (res.ok) {
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
