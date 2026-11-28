import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/screen-cast-update.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function createUpdater({ remote, storedAttempt, storageDenied = false }) {
  const listeners = new Map();
  let reloads = 0;
  let requests = 0;
  const serviceWorker = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    __SCREEN_CAST_BUILD_ID__: 'current',
    navigator: { onLine: true, serviceWorker },
    document: { addEventListener() {}, removeEventListener() {} },
    window: {
      setTimeout() {},
      setInterval() {},
      clearInterval() {},
      clearTimeout() {},
      location: { reload: () => { reloads += 1; } },
    },
    fetch: async () => {
      requests += 1;
      return { ok: true, json: async () => ({ buildId: remote }) };
    },
    sessionStorage: {
      getItem: () => storedAttempt,
      setItem: () => {
        if (storageDenied) throw new Error('Storage denied');
      },
    },
  });
  return {
    start: exports.startScreenCastAutoUpdate,
    controllerChanged: () => listeners.get('controllerchange')?.(),
    result: () => ({ requests, reloads }),
  };
}

test('activation of a worker on the current build does not reload the player', async () => {
  const updater = createUpdater({ remote: 'current' });
  const stop = updater.start();
  await updater.controllerChanged();
  stop();
  await updater.controllerChanged();
  assert.deepEqual(updater.result(), { requests: 1, reloads: 0 });
});

test('repeated notifications for a newer build trigger only one reload', async () => {
  const updater = createUpdater({ remote: 'newer' });
  updater.start();
  await Promise.all([updater.controllerChanged(), updater.controllerChanged()]);
  await updater.controllerChanged();
  assert.deepEqual(updater.result(), { requests: 1, reloads: 1 });
});

test('activation cannot loop when the reload budget is spent or storage is denied', async () => {
  for (const options of [
    { storedAttempt: JSON.stringify({ target: 'newer', count: 2 }) },
    { storageDenied: true },
  ]) {
    const updater = createUpdater({ remote: 'newer', ...options });
    updater.start();
    await updater.controllerChanged();
    assert.deepEqual(updater.result(), { requests: 1, reloads: 0 });
  }
});
