/* Screen-cast offline cache for kiosk players (v4 — no-cors for S3) */
const CONFIG_CACHE = 'screen-cast-config-v4';
const MEDIA_CACHE = 'screen-cast-media-v4';
const SHELL_CACHE = 'screen-cast-shell-v4';

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
  // no fetch attempts that would spam CORS errors. Those assets need
  // network and are not available offline.
  if (url.origin !== self.location.origin) {
    if (!isOfflineCacheableMediaUrl(request.url)) return;
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
 * Media strategy for S3/CDN without requiring bucket CORS:
 * 1) Cache hit
 * 2) Network with request's natural mode (usually no-cors for <img>/<video>)
 * 3) Soft 504 — never throw
 *
 * Never force mode:'cors' — signed S3 URLs often lack Access-Control-Allow-Origin
 * and a forced CORS fetch breaks display with 504 Media unavailable.
 */
async function mediaCacheFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    // Preserve the browser's request mode (no-cors for images without crossOrigin).
    // For cache key matching, also try URL-only match after network.
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
    // Fallback: URL match in case Request mode/headers differ
    const byUrl = await cache.match(request.url);
    if (byUrl) return byUrl;

    return new Response('', {
      status: 504,
      statusText: 'Media unavailable',
    });
  }
}
