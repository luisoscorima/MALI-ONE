import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const ORIGIN = 'https://mali.test';
const SOURCE = readFileSync(
  new URL('../public/screen-cast-sw.js', import.meta.url),
  'utf8',
);

function cacheKey(requestOrUrl) {
  const value =
    typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url;
  return new URL(value, ORIGIN).href;
}

class MemoryCache {
  entries = new Map();

  async match(requestOrUrl, options = {}) {
    const key = cacheKey(requestOrUrl);
    const exact = this.entries.get(key);
    if (exact) return exact.clone();
    if (options.ignoreSearch) {
      const expected = new URL(key);
      for (const [candidate, response] of this.entries) {
        const url = new URL(candidate);
        if (url.origin === expected.origin && url.pathname === expected.pathname) {
          return response.clone();
        }
      }
    }
    return undefined;
  }

  async put(requestOrUrl, response) {
    this.entries.set(cacheKey(requestOrUrl), response.clone());
  }

  async delete(requestOrUrl) {
    return this.entries.delete(cacheKey(requestOrUrl));
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

function createHarness(fetchImpl, options = {}) {
  const listeners = new Map();
  const namedCaches = new Map();
  const context = {
    AbortController,
    Headers,
    Request,
    Response,
    URL,
    clearTimeout,
    console,
    fetch: (...args) => fetchImpl(...args),
    setTimeout: options.setTimeout ?? setTimeout,
    caches: {
      async open(name) {
        if (!namedCaches.has(name)) namedCaches.set(name, new MemoryCache());
        const cache = namedCaches.get(name);
        return options.openCache ? options.openCache(cache) : cache;
      },
      async keys() {
        return [...namedCaches.keys()];
      },
      async delete(name) {
        return namedCaches.delete(name);
      },
    },
    self: {
      location: { origin: ORIGIN },
      clients: { claim: async () => undefined },
      skipWaiting: options.skipWaiting ?? (async () => undefined),
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    },
  };
  vm.runInNewContext(SOURCE, context, { filename: 'screen-cast-sw.js' });

  return {
    cache(name = 'screen-cast-shell-v8') {
      if (!namedCaches.has(name)) namedCaches.set(name, new MemoryCache());
      return namedCaches.get(name);
    },
    dispatchFetch(path) {
      let response;
      const event = {
        request: new Request(new URL(path, ORIGIN)),
        respondWith(value) {
          response = Promise.resolve(value);
        },
        waitUntil() {},
      };
      listeners.get('fetch')(event);
      return response;
    },
    async activate() {
      let pending = Promise.resolve();
      listeners.get('activate')({
        waitUntil(value) {
          pending = Promise.resolve(value);
        },
      });
      await pending;
    },
    async install() {
      let pending = Promise.resolve();
      listeners.get('install')({
        waitUntil(value) {
          pending = Promise.resolve(value);
        },
      });
      await pending;
    },
    cacheNames() {
      return [...namedCaches.keys()];
    },
  };
}

function javascriptResponse(body = 'export default true;') {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/javascript' },
  });
}

test('an uncached online chunk uses native fetch without an offline timeout', async () => {
  const calls = [];
  const harness = createHarness((...args) => {
    calls.push(args);
    return Promise.resolve(javascriptResponse());
  });

  const response = await harness.dispatchFetch('/assets/player-AbCd1234.js');

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  assert.ok(calls[0][0] instanceof Request);
});

test('an online chunk loads even when CacheStorage denies access', async () => {
  const harness = createHarness(
    () => Promise.resolve(javascriptResponse('live script')),
    {
      openCache() {
        throw new Error('CacheStorage unavailable');
      },
    },
  );

  const response = await harness.dispatchFetch('/assets/player-AbCd1234.js');
  assert.equal(await response.text(), 'live script');
});

test(
  'an online chunk does not wait for a pending CacheStorage write',
  { timeout: 1000 },
  async () => {
    const harness = createHarness(
      () => Promise.resolve(javascriptResponse('live script')),
      {
        openCache(cache) {
          cache.put = () => new Promise(() => {});
          return cache;
        },
      },
    );

    const response = await harness.dispatchFetch('/assets/player-AbCd1234.js');
    assert.equal(await response.text(), 'live script');
  },
);

test('online proxied images load even when CacheStorage denies access', async () => {
  const harness = createHarness(
    () => Promise.resolve(
      new Response('image', { headers: { 'Content-Type': 'image/jpeg' } }),
    ),
    {
      openCache() {
        throw new Error('CacheStorage unavailable');
      },
    },
  );

  const response = await harness.dispatchFetch(
    '/api/screen-cast/media?src=image.jpg',
  );
  assert.equal(await response.text(), 'image');
});

test('a valid immutable chunk is served cache-first without touching the network', async () => {
  const harness = createHarness(() => {
    throw new Error('network must not be called for a valid cache hit');
  });
  await harness
    .cache()
    .put('/assets/player-AbCd1234.js', javascriptResponse('cached'));

  const response = await harness.dispatchFetch('/assets/player-AbCd1234.js');

  assert.equal(await response.text(), 'cached');
});

test('an HTML fallback cached under a chunk URL is purged and repaired online', async () => {
  let fetchCount = 0;
  const harness = createHarness(() => {
    fetchCount += 1;
    return Promise.resolve(javascriptResponse('repaired'));
  });
  await harness.cache().put(
    '/assets/player-AbCd1234.js',
    new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );

  const response = await harness.dispatchFetch('/assets/player-AbCd1234.js');
  const repaired = await harness.cache().match('/assets/player-AbCd1234.js');

  assert.equal(await response.text(), 'repaired');
  assert.equal(await repaired.text(), 'repaired');
  assert.equal(fetchCount, 1);
});

test('an HTML network fallback is never persisted under a chunk URL', async () => {
  const harness = createHarness(() =>
    Promise.resolve(
      new Response('<!doctype html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    ),
  );

  const response = await harness.dispatchFetch('/assets/player-AbCd1234.js');
  const cached = await harness.cache().match('/assets/player-AbCd1234.js');

  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(cached, undefined);
});

test('non-hashed JavaScript is not intercepted by offline shell logic', () => {
  const harness = createHarness(() =>
    Promise.resolve(javascriptResponse()),
  );

  const response = harness.dispatchFetch('/runtime.js');

  assert.equal(response, undefined);
});

test('online shell navigation uses native fetch without an offline timeout', async () => {
  const calls = [];
  const harness = createHarness((...args) => {
    calls.push(args);
    return Promise.resolve(
      new Response('<!doctype html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );
  });

  const response = await harness.dispatchFetch('/screen-cast?id=tv-1');

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  assert.equal(
    await harness.cache().match('/screen-cast?id=tv-1'),
    undefined,
  );
});

test('failed shell navigation falls back to the validated canonical shell', async () => {
  const harness = createHarness(() =>
    Promise.reject(new TypeError('network unavailable')),
  );
  await harness.cache().put(
    '/screen-cast',
    new Response('<!doctype html><main>offline</main>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );

  const response = await harness.dispatchFetch('/screen-cast?id=tv-1');

  assert.match(await response.text(), /offline/);
});

test('the trailing-slash player also falls back to the canonical shell', async () => {
  const harness = createHarness(() => Promise.reject(new TypeError('offline')));
  await harness.cache().put(
    '/screen-cast',
    new Response('<!doctype html><main>offline</main>', {
      headers: { 'Content-Type': 'text/html' },
    }),
  );

  const response = await harness.dispatchFetch('/screen-cast/?id=tv-1');
  assert.match(await response.text(), /offline/);
});

test(
  'online navigation does not wait for a pending CacheStorage read',
  { timeout: 1000 },
  async () => {
    const harness = createHarness(
      () => Promise.resolve(
        new Response('<!doctype html><main>live</main>', {
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
      {
        openCache() {
          return new Promise(() => {});
        },
      },
    );

    const response = await harness.dispatchFetch('/screen-cast?id=tv-1');
    assert.match(await response.text(), /live/);
  },
);

test('a captive WAN falls back after the shell delay without aborting fetch', async () => {
  let fetchCalls = 0;
  const pendingNetwork = new Promise(() => {});
  const harness = createHarness(
    () => {
      fetchCalls += 1;
      return pendingNetwork;
    },
    {
      setTimeout(callback) {
        callback();
        return 1;
      },
    },
  );
  await harness.cache().put(
    '/screen-cast',
    new Response('<!doctype html><main>validated fallback</main>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );

  const response = await harness.dispatchFetch('/screen-cast?id=tv-1');

  assert.match(await response.text(), /validated fallback/);
  assert.equal(fetchCalls, 1);
});

test('a first online shell load with no cache is never cut off by the delay', async () => {
  let timers = 0;
  const harness = createHarness(
    () => new Promise(() => {}),
    {
      setTimeout() {
        timers += 1;
        return 1;
      },
    },
  );

  harness.dispatchFetch('/screen-cast?id=first-load');
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(timers, 0);
});

test('config requests are owned by the online player, not the service worker', () => {
  const harness = createHarness(() => {
    throw new Error('unmanaged config fetch must remain in the page');
  });

  const response = harness.dispatchFetch(
    '/api/screen-cast/screens/tv-1/config',
  );

  assert.equal(response, undefined);
});

test('activation purges the potentially contaminated v7 shell only', async () => {
  const harness = createHarness(() =>
    Promise.resolve(javascriptResponse()),
  );
  harness.cache('screen-cast-shell-v7');
  harness.cache('screen-cast-shell-v8');
  harness.cache('screen-cast-config-v7');
  harness.cache('screen-cast-media-v7');
  harness.cache('screen-cast-video-v1');

  await harness.activate();

  assert.deepEqual(harness.cacheNames().sort(), [
    'screen-cast-config-v7',
    'screen-cast-media-v7',
    'screen-cast-shell-v8',
    'screen-cast-video-v1',
  ]);
});

test('a denied shell cache does not leave the old worker in control', async () => {
  let skippedWaiting = false;
  const harness = createHarness(
    () => { throw new Error('unexpected fetch'); },
    {
      openCache() {
        throw new Error('CacheStorage unavailable');
      },
      async skipWaiting() {
        skippedWaiting = true;
      },
    },
  );

  await harness.install();
  assert.equal(skippedWaiting, true);
});

test('installation precaches the lazy player chunk declared by the build', async () => {
  const assets = [
    '/assets/index-AbCd1234.js',
    '/assets/index-AbCd1234.css',
    '/assets/screen-cast-player-page-AbCd1234.js',
  ];
  const harness = createHarness((requestOrUrl) => {
    const url = new URL(
      typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url,
      ORIGIN,
    );
    if (url.pathname === '/screen-cast') {
      return Promise.resolve(
        new Response(
          '<!doctype html><script src="/assets/index-AbCd1234.js"></script>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        ),
      );
    }
    if (url.pathname === '/screen-cast-assets.json') {
      return Promise.resolve(
        Response.json({
          buildId: 'test',
          playerEntry: '/assets/screen-cast-player-page-AbCd1234.js',
          assets,
        }),
      );
    }
    if (url.pathname.endsWith('.css')) {
      return Promise.resolve(
        new Response('body{}', {
          status: 200,
          headers: { 'Content-Type': 'text/css' },
        }),
      );
    }
    return Promise.resolve(javascriptResponse());
  });

  await harness.install();

  for (const asset of assets) {
    assert.ok(await harness.cache().match(asset), `${asset} was not cached`);
  }
});

test('installation preserves valid v7 entries but rejects poisoned ones', async () => {
  const harness = createHarness(() =>
    Promise.reject(new TypeError('network unavailable during update')),
  );
  const legacy = harness.cache('screen-cast-shell-v7');
  await legacy.put(
    '/screen-cast',
    new Response('<!doctype html><main>last good shell</main>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );
  await legacy.put(
    '/assets/index-AbCd1234.js',
    javascriptResponse('last good bundle'),
  );
  await legacy.put(
    '/assets/poisoned-AbCd1234.js',
    new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );

  await harness.install();

  assert.ok(await harness.cache().match('/screen-cast'));
  assert.ok(await harness.cache().match('/assets/index-AbCd1234.js'));
  assert.equal(
    await harness.cache().match('/assets/poisoned-AbCd1234.js'),
    undefined,
  );
});

test('an incomplete manifest cannot replace the last complete shell', async () => {
  const harness = createHarness((requestOrUrl) => {
    const url = new URL(
      typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url,
      ORIGIN,
    );
    if (url.pathname === '/screen-cast') {
      return Promise.resolve(
        new Response('<!doctype html><main>new but incomplete</main>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      );
    }
    if (url.pathname === '/screen-cast-assets.json') {
      return Promise.resolve(
        Response.json({
          buildId: 'broken',
          assets: ['/assets/index-AbCd1234.js'],
        }),
      );
    }
    return Promise.resolve(javascriptResponse());
  });
  await harness.cache('screen-cast-shell-v7').put(
    '/screen-cast',
    new Response('<!doctype html><main>last complete shell</main>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );

  await harness.install();
  const shell = await harness.cache().match('/screen-cast');

  assert.match(await shell.text(), /last complete shell/);
});
