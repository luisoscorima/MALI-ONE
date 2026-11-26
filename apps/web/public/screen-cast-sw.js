/* Screen-cast offline cache for kiosk players (v7 — background video download) */
const CONFIG_CACHE = 'screen-cast-config-v7';
const MEDIA_CACHE = 'screen-cast-media-v7';
const SHELL_CACHE = 'screen-cast-shell-v7';
// Complete, validated videos are stored here by screen-cast-video-cache.ts.
// Never delete this cache during a shell/service-worker update.
const VIDEO_CACHE = 'screen-cast-video-v1';
const NETWORK_TIMEOUT_MS = 4000;

const SHELL_URLS = ['/screen-cast', '/index.html', '/favicon.svg'];

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
  const proxiedSource = url.searchParams.get('src') || '';
  let proxiedPath = proxiedSource;
  try {
    proxiedPath = new URL(proxiedSource).pathname;
  } catch {
    // Non-proxy request: inspect the original value as-is.
  }
  const path = `${url.pathname} ${proxiedPath}`.toLowerCase();
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
      await refreshShellCache(cache);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([
        CONFIG_CACHE,
        MEDIA_CACHE,
        SHELL_CACHE,
        VIDEO_CACHE,
      ]);
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
    event.respondWith(
      networkFirstSafe(request, CONFIG_CACHE, {
        timeoutMs: NETWORK_TIMEOUT_MS,
      }),
    );
    return;
  }

  if (url.pathname === '/api/screen-cast/media') {
    // Full videos are validated and persisted by screen-cast-video-cache.ts.
    // Images/GIFs use the same-origin proxy so expired S3 signatures cannot
    // break a kiosk that is filling or reading its cache.
    if (!isVideoMediaRequest(url, request)) {
      event.respondWith(mediaCacheFirstSafe(request, MEDIA_CACHE));
    }
    return;
  }

  if (url.pathname === '/screen-cast') {
    event.respondWith(
      networkFirstSafe(request, SHELL_CACHE, {
        // The kiosk URL includes ?id=..., while the install cache contains the
        // shared /screen-cast shell. Query params must not defeat offline boot.
        ignoreSearchOnFallback: true,
        timeoutMs: NETWORK_TIMEOUT_MS,
      }),
    );
    return;
  }

  if (
    url.pathname === '/favicon.svg' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    // Vite assets are content-hashed. Waiting on the WAN before reading an
    // already cached bundle can leave a kiosk black behind a captive/LAN-only
    // connection, where navigator.onLine remains true.
    event.respondWith(cacheFirstSafe(request, SHELL_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) {
    if (!isOfflineCacheableMediaUrl(request.url)) return;
    if (isVideoMediaRequest(url, request)) return;
    event.respondWith(mediaCacheFirstSafe(request, MEDIA_CACHE));
  }
});

async function refreshShellCache(cache) {
  let freshShell = null;
  try {
    const response = await fetch('/screen-cast', { cache: 'no-store' });
    if (response.ok) {
      freshShell = response;
      await cache.put('/screen-cast', response.clone());
    }
  } catch {
    // An update must never destroy the last bootable shell.
  }

  if (freshShell) {
    // A new build's canonical shell is safer than exact query entries left by
    // an older build. Exact entries will be recreated on the next navigation.
    const keys = await cache.keys();
    await Promise.all(
      keys.map((request) => {
        const url = new URL(request.url);
        return url.pathname === '/screen-cast' && url.search
          ? cache.delete(request)
          : undefined;
      }),
    );

    try {
      const html = await freshShell.text();
      const assetUrls = new Set();
      const reference = /(?:src|href)=["']([^"']+)["']/g;
      let match;
      while ((match = reference.exec(html))) {
        const url = new URL(match[1], self.location.origin);
        if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
          assetUrls.add(`${url.pathname}${url.search}`);
        }
      }
      await Promise.all(
        [...assetUrls].map((url) => cache.add(url).catch(() => undefined)),
      );
    } catch {
      // The canonical shell itself is still useful as an offline fallback.
    }
  }

  await Promise.all(
    SHELL_URLS.filter((url) => url !== '/screen-cast').map((url) =>
      cache.add(url).catch(() => undefined),
    ),
  );
}

async function networkFirstSafe(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetchWithTimeout(request, options.timeoutMs);
    if (fresh && fresh.ok) {
      try {
        await cache.put(request, fresh.clone());
      } catch {
        // ignore quota / opaque put errors
      }
    }
    return fresh;
  } catch {
    // Prefer the exact URL. `ignoreSearch` is only a compatibility fallback
    // for old installs that have the canonical /screen-cast entry alone.
    let cached = await cache.match(request);
    if (!cached && options.ignoreSearchOnFallback === true) {
      cached = await cache.match(request, { ignoreSearch: true });
    }
    if (cached) return cached;
    return new Response(JSON.stringify({ message: 'Sin contenido local' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
}

async function fetchWithTimeout(request, timeoutMs) {
  if (!timeoutMs || typeof AbortController === 'undefined') {
    return fetch(request);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const fresh = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (fresh?.ok) {
      try {
        await cache.put(request, fresh.clone());
      } catch {
        // ignore quota/write errors; the live response is still usable
      }
    }
    return fresh;
  } catch {
    return new Response('', {
      status: 504,
      statusText: 'Asset unavailable',
    });
  }
}

async function mediaCacheFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Older versions copied opaque direct-S3 responses under the same-origin
    // proxy key. Such a response cannot satisfy a CORS <img> request and, if
    // returned cache-first forever, prevents the proxy from repairing it.
    if (cached.type !== 'opaque' && cached.status !== 0) return cached;
    await cache.delete(request);
  }

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
