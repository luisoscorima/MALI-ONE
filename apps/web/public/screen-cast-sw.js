/* Screen-cast offline cache for kiosk players (v6 — blob playback via API) */
const CONFIG_CACHE = 'screen-cast-config-v6';
const MEDIA_CACHE = 'screen-cast-media-v6';
const SHELL_CACHE = 'screen-cast-shell-v6';

const SHELL_URLS = ['/screen-cast', '/index.html'];

function isOfflineCacheableMediaUrl(urlString) {
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

function isVideoMediaRequest(url, request) {
  if (request.headers.get('range')) return true;
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')) {
    return true;
  }
  const dest = request.destination;
  return dest === 'video' || dest === 'audio';
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

  if (url.origin !== self.location.origin) {
    if (!isOfflineCacheableMediaUrl(request.url)) return;
    if (isVideoMediaRequest(url, request)) return;
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

async function mediaCacheFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const fresh = await fetch(request, { credentials: 'omit' });
    if (fresh.ok || fresh.type === 'opaque') {
      try {
        await cache.put(request, fresh.clone());
      } catch {
        // ignore
      }
    }
    return fresh;
  } catch {
    const byUrl = await cache.match(request.url);
    if (byUrl) return byUrl;

    return new Response('', {
      status: 504,
      statusText: 'Media unavailable',
    });
  }
}
