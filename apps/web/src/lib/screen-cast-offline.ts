import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const SW_URL = '/screen-cast-sw.js';
const CONFIG_CACHE = 'screen-cast-config-v1';
const MEDIA_CACHE = 'screen-cast-media-v1';

export async function registerScreenCastServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: '/screen-cast' });
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
          const res = await fetch(item.mediaUrl, { mode: 'cors' });
          if (res.ok) {
            await mediaCache.put(item.mediaUrl, res.clone());
          }
        } catch {
          // CORS or network — skip this asset
        }
      }),
    );
  } catch {
    // ignore cache failures
  }
}
