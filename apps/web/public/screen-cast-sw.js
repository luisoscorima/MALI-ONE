/* Screen-cast offline cache for kiosk players */
const CONFIG_CACHE = 'screen-cast-config-v1';
const MEDIA_CACHE = 'screen-cast-media-v1';
const SHELL_CACHE = 'screen-cast-shell-v1';

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
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/screen-cast/screens/') && url.pathname.endsWith('/config')) {
    event.respondWith(networkFirst(request, CONFIG_CACHE));
    return;
  }

  if (
    url.pathname === '/screen-cast' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Cross-origin media (S3, etc.)
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Offline and no cache');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    throw err;
  }
}
