/* Screen-cast offline cache for kiosk players (v3 — skip external CORS) */
const CONFIG_CACHE = 'screen-cast-config-v3';
const MEDIA_CACHE = 'screen-cast-media-v3';
const SHELL_CACHE = 'screen-cast-shell-v3';

const SHELL_URLS = ['/screen-cast', '/index.html'];

function isCorsCacheableMediaUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.origin === self.location.origin) return true;
    const host = url.hostname.toLowerCase();
    if (host.endsWith('.amazonaws.com')) return true;
    if (host.endsWith('.cloudfront.net')) return true;
    return false;
  } catch {
    return false;
  }
}

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

  // Cross-origin: only intercept cacheable origins (S3 / same-site CDN).
  // External hosts (WordPress mali.pe, etc.) pass through to the browser —
  // no CORS fetch attempts, so the console stays clean. Those assets need
  // network and are not available offline.
  if (url.origin !== self.location.origin) {
    if (!isCorsCacheableMediaUrl(request.url)) return;
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
    return new Response(JSON.stringify({ empty: true, offline: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Media strategy for CORS-capable origins only:
 * 1) Cache hit
 * 2) CORS network fetch + cache
 * 3) Soft 504 — never throw
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
    return new Response('', {
      status: 504,
      statusText: 'Media unavailable',
    });
  }
}
