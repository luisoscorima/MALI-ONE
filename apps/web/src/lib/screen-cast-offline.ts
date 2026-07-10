import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
const CONFIG_CACHE = 'screen-cast-config-v2';
const MEDIA_CACHE = 'screen-cast-media-v2';

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
        try {
          const existing = await mediaCache.match(item.mediaUrl);
          if (existing) return;

          // Prefer CORS (cacheable + readable). Fall back to no-cors opaque.
          try {
            const res = await fetch(item.mediaUrl, {
              mode: 'cors',
              credentials: 'omit',
            });
            if (res.ok) {
              await mediaCache.put(item.mediaUrl, res.clone());
              return;
            }
          } catch {
            // CORS blocked — try opaque
          }

          try {
            const opaque = await fetch(item.mediaUrl, {
              mode: 'no-cors',
              credentials: 'omit',
            });
            await mediaCache.put(item.mediaUrl, opaque.clone());
          } catch {
            // Skip — <img>/<video> will load natively
          }
        } catch {
          // ignore per-item failures
        }
      }),
    );
  } catch {
    // ignore cache failures
  }
}
