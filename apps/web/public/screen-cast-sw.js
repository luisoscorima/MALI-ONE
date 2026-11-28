/* Screen-cast offline cache for kiosk players. */
const CONFIG_CACHE = 'screen-cast-config-v7';
const MEDIA_CACHE = 'screen-cast-media-v7';
// v8 drops shell entries that may contain an HTML fallback cached under a
// JavaScript/CSS URL by an older worker.
const SHELL_CACHE = 'screen-cast-shell-v8';
// Complete, validated videos are stored here by screen-cast-video-cache.ts.
// Never delete this cache during a shell/service-worker update.
const VIDEO_CACHE = 'screen-cast-video-v1';
const ASSET_MANIFEST_URL = '/screen-cast-assets.json';
const SHELL_FALLBACK_DELAY_MS = 5000;

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
      await migrateValidLegacyShellEntries(cache);
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

async function migrateValidLegacyShellEntries(targetCache) {
  try {
    const names = await caches.keys();
    const legacyNames = names.filter(
      (name) => name.startsWith('screen-cast-shell-') && name !== SHELL_CACHE,
    );
    for (const name of legacyNames) {
      const legacy = await caches.open(name);
      const requests = await legacy.keys();
      for (const request of requests) {
        const url = new URL(request.url);
        if (
          url.origin !== self.location.origin ||
          (url.pathname !== '/screen-cast' && !isImmutableViteAssetUrl(url))
        ) {
          continue;
        }
        const response = await legacy.match(request);
        const isCanonicalShell =
          url.pathname === '/screen-cast' && url.search === '';
        if (
          (isCanonicalShell || isImmutableViteAssetUrl(url)) &&
          response &&
          isValidShellResponse(request, response)
        ) {
          await targetCache.put(request, response.clone());
        }
      }
    }
  } catch {
    // A migration is best-effort; a reachable deploy repopulates v8 below.
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (
    url.origin === self.location.origin &&
    url.pathname === '/api/screen-cast/media'
  ) {
    // Full videos are validated and persisted by screen-cast-video-cache.ts.
    // Images/GIFs use the same-origin proxy so expired S3 signatures cannot
    // break a kiosk that is filling or reading its cache.
    if (!isVideoMediaRequest(url, request)) {
      event.respondWith(mediaCacheFirstSafe(request, MEDIA_CACHE));
    }
    return;
  }

  if (
    url.origin === self.location.origin &&
    url.pathname === '/screen-cast'
  ) {
    event.respondWith(
      shellNetworkFirstSafe(
        request,
        SHELL_CACHE,
        {
          // The kiosk URL includes ?id=..., while install caches the shared
          // /screen-cast shell. Query params must not defeat offline boot.
          ignoreSearchOnFallback: true,
        },
        event,
      ),
    );
    return;
  }

  if (url.origin === self.location.origin && isImmutableViteAssetUrl(url)) {
    // Only immutable, content-hashed Vite assets are allowed to take the cache
    // path. On a miss the normal network request is returned without an
    // offline timeout, so the online player keeps native browser semantics.
    event.respondWith(shellAssetCacheFirstSafe(request, SHELL_CACHE));
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
  const assetUrls = new Set();
  try {
    const response = await fetch('/screen-cast', { cache: 'no-store' });
    if (isValidShellResponse('/screen-cast', response)) {
      freshShell = response;
    }
  } catch {
    // An update must never destroy the last bootable shell.
  }

  if (freshShell) {
    try {
      const html = await freshShell.clone().text();
      const reference = /(?:src|href)=["']([^"']+)["']/g;
      let match;
      while ((match = reference.exec(html))) {
        const url = new URL(match[1], self.location.origin);
        if (isImmutableViteAssetUrl(url)) {
          assetUrls.add(`${url.pathname}${url.search}`);
        }
      }
    } catch {
      // The canonical shell itself is still useful as an offline fallback.
    }
  }

  const declaredAssets = await readDeclaredScreenCastAssets();
  // Never promote a new canonical shell unless its lazy player entry and all
  // declared dependencies are safely cached. The previous validated shell
  // remains available if a deploy is only partially reachable.
  if (!freshShell || !declaredAssets) return;
  for (const url of declaredAssets) assetUrls.add(url);

  const cached = await Promise.all(
    [...assetUrls].map((url) => cacheShellAsset(cache, url)),
  );
  if (cached.some((success) => !success)) return;

  await cache.put('/screen-cast', freshShell.clone());
  // A complete new build is safer than exact query entries left by an older
  // build. Exact entries will be recreated on the next online navigation.
  const keys = await cache.keys();
  await Promise.all(
    keys.map((request) => {
      const url = new URL(request.url);
      return url.pathname === '/screen-cast' && url.search
        ? cache.delete(request)
        : undefined;
    }),
  );
}

async function readDeclaredScreenCastAssets() {
  try {
    const response = await fetch(ASSET_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const manifest = await response.json();
    if (
      !Array.isArray(manifest?.assets) ||
      typeof manifest?.playerEntry !== 'string'
    ) {
      return null;
    }

    const urls = new Set();
    for (const value of [...manifest.assets, manifest.playerEntry]) {
      if (typeof value !== 'string') return null;
      const url = new URL(value, self.location.origin);
      if (!isImmutableViteAssetUrl(url)) return null;
      urls.add(`${url.pathname}${url.search}`);
    }
    const playerUrl = new URL(manifest.playerEntry, self.location.origin);
    if (!urls.has(`${playerUrl.pathname}${playerUrl.search}`)) return null;
    return urls;
  } catch {
    return null;
  }
}

function isImmutableViteAssetUrl(url) {
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith('/assets/')
  ) {
    return false;
  }
  const filename = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  return /-[A-Za-z0-9_-]{6,}\.[A-Za-z0-9]+$/.test(filename);
}

function isValidShellResponse(requestOrUrl, response) {
  if (!response?.ok || response.type === 'opaque') return false;

  const requestUrl =
    typeof requestOrUrl === 'string'
      ? new URL(requestOrUrl, self.location.origin)
      : new URL(requestOrUrl.url);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const path = requestUrl.pathname.toLowerCase();

  if (path === '/screen-cast' || path === '/index.html') {
    return contentType.includes('text/html');
  }
  if (path.endsWith('.js') || path.endsWith('.mjs')) {
    return contentType.includes('javascript') || contentType.includes('ecmascript');
  }
  if (path.endsWith('.css')) return contentType.includes('text/css');
  if (path.endsWith('.svg')) return contentType.includes('image/svg+xml');

  // Binary Vite assets vary by server/CDN. Reject only responses that are
  // clearly an SPA/API fallback; those must never poison an immutable URL.
  return (
    !contentType.includes('text/html') &&
    !contentType.includes('application/json')
  );
}

async function cacheShellAsset(cache, requestOrUrl) {
  try {
    const request =
      typeof requestOrUrl === 'string'
        ? new Request(new URL(requestOrUrl, self.location.origin))
        : requestOrUrl;
    const fresh = await fetch(request);
    if (isValidShellResponse(request, fresh)) {
      await cache.put(request, fresh.clone());
      return true;
    }
  } catch {
    // Report failure without throwing; the caller keeps the previous shell.
  }
  return false;
}

async function shellNetworkFirstSafe(request, cacheName, options = {}, event) {
  // Start the native request immediately. A timeout below never aborts it.
  const freshPromise = fetch(request);
  try {
    // Register this while the FetchEvent is active so a fallback response does
    // not itself cancel the native request still resolving in the background.
    event?.waitUntil?.(freshPromise.then(() => undefined, () => undefined));
  } catch {
    // Some older WebViews do not allow extending a FetchEvent lifetime here.
  }
  const cache = await caches.open(cacheName);

  // Prefer the exact URL. `ignoreSearch` is only a compatibility fallback for
  // installs that have the canonical /screen-cast entry alone.
  let fallback = await cache.match(request);
  if (fallback && !isValidShellResponse(request, fallback)) {
    await cache.delete(request);
    fallback = null;
  }
  if (!fallback && options.ignoreSearchOnFallback === true) {
    fallback = await cache.match(request, { ignoreSearch: true });
    if (fallback && !isValidShellResponse(request, fallback)) fallback = null;
  }

  const networkTask = (async () => {
    try {
      const fresh = await freshPromise;
      // The install transaction owns the offline shell. Online navigations are
      // returned untouched and never create a query-specific, partially
      // precached shell entry.
      return fresh;
    } catch {
      if (fallback) return fallback;
      return new Response(JSON.stringify({ message: 'Sin contenido local' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }
  })();

  // With no validated fallback, never cut off a slow but working first load.
  if (!fallback) return networkTask;

  // A dead/captive WAN may use the validated shell. This timer only chooses the
  // response; it never aborts the native request or any JavaScript asset.
  let timer;
  const delayedFallback = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), SHELL_FALLBACK_DELAY_MS);
  });
  try {
    return await Promise.race([networkTask, delayedFallback]);
  } finally {
    clearTimeout(timer);
  }
}

async function shellAssetCacheFirstSafe(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    if (isValidShellResponse(request, cached)) return cached;
    await cache.delete(request);
  }

  // Miss path is deliberately the native request: no AbortController, race,
  // or offline timeout may turn a working but slow online connection black.
  try {
    const fresh = await fetch(request);
    if (isValidShellResponse(request, fresh)) {
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
