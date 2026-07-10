/* Screen-cast offline cache for kiosk players (v2 — CORS-safe) */
const CONFIG_CACHE = 'screen-cast-config-v2';
const MEDIA_CACHE = 'screen-cast-media-v2';
const SHELL_CACHE = 'screen-cast-shell-v2';

const SHELL_URLS = ['/screen-cast', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS).catch(() => undefined);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([CONFIG_CACHE, MEDIA_CACHE, SHELL_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('screen-cast-') && !keep.has(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (
    url.pathname.startsWith('/api/screen-cast/screens/') &&
    url.pathname.endsWith('/config')
  ) {
    event.respondWith(networkFirstSafe(request, CONFIG_CACHE));
    return;
  }

  if (
    url.pathname === '/screen-cast' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(networkFirstSafe(request, SHELL_CACHE));
    return;
  }

  // Cross-origin media: never reject — cache hit, or soft network, or opaque fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(mediaCacheFirstSafe(request, MEDIA_CACHE));
  }
});

async function networkFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      try {
        await cache.put(request, fresh.clone());
      } catch {
        // ignore quota / opaque put errors
      }
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Do not throw — return a soft offline response
    return new Response(JSON.stringify({ empty: true, offline: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Media strategy:
 * 1) Serve from Cache API if present
 * 2) Try CORS fetch and cache on success
 * 3) On CORS/network failure: try no-cors (opaque) so <img>/<video> can still paint
 * 4) Never throw — avoids "Uncaught (in promise) TypeError: Failed to fetch"
 */
async function mediaCacheFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const fresh = await fetch(request, {
      mode: 'cors',
      credentials: 'omit',
    });
    if (fresh.ok) {
      try {
        await cache.put(request, fresh.clone());
      } catch {
        // ignore
      }
    }
    return fresh;
  } catch {
    // CORS or network blocked — try opaque response (browser can still display in <img>)
    try {
      const opaque = await fetch(request.url, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit',
      });
      // Opaque responses (status 0) can be cached for offline replay
      try {
        await cache.put(request, opaque.clone());
      } catch {
        // ignore
      }
      return opaque;
    } catch {
      // Last resort: empty body with 504 — player onError advances; no uncaught rejection
      return new Response('', {
        status: 504,
        statusText: 'Media unavailable',
      });
    }
  }
}
