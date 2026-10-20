// Local browser smoke test against a simulated API. Never contacts financial portals.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { TREASURY_PROVIDERS } = require('../packages/shared/dist/treasury');
const playwrightPath = process.env.TREASURY_PLAYWRIGHT_PATH || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(playwrightPath);
const dist = path.join(root, 'apps/web/dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const sources = [];
let authorized = true;
let failOverview = false;
let conflict = false;
let base;
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, base);
    if (url.pathname.startsWith('/api/')) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      if (url.pathname === '/api/auth/me') return json(res, { id: 'qa', name: 'QA local', email: 'qa@example.test', role: 'operator', isSuperAdmin: false, modules: authorized ? ['treasury'] : [], picture: null });
      if (url.pathname === '/api/treasury') return failOverview ? json(res, { message: 'Fallo de prueba' }, 500)
        : json(res, { sources, providers: TREASURY_PROVIDERS, collectionEnabled: false, syncIntervalMinutes: 60, timezone: 'America/Lima' });
      if (url.pathname === '/api/treasury/sources' && req.method === 'POST') {
        const source = { ...body, id: 'source-' + sources.length, targets: [], connectorStatus: 'pending', syncIntervalMinutes: 60, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        sources.push(source);
        return json(res, { id: source.id });
      }
      const match = url.pathname.match(/^\/api\/treasury\/sources\/([^/]+)(?:\/targets(?:\/([^/]+))?)?$/);
      if (match) {
        const source = sources.find((item) => item.id === match[1]);
        if (url.pathname.includes('/targets')) {
          if (conflict) return json(res, { message: 'Ya existe esa referencia y moneda' }, 409);
          const target = { ...body, id: match[2] || 'target-' + source.targets.length, sourceId: source.id, kind: TREASURY_PROVIDERS.find((item) => item.id === source.provider).targetKind };
          const index = source.targets.findIndex((item) => item.id === target.id);
          if (index >= 0) source.targets[index] = target; else source.targets.push(target);
          return json(res, { id: target.id });
        }
        Object.assign(source, body);
        return json(res, { id: source.id });
      }
      return json(res, { message: 'Ruta no prevista' }, 404);
    }
    let file = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(dist + path.sep)) file = path.join(dist, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (error) { json(res, { message: error.message }, 500); }
});

(async () => {
  let browser;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route('**/*', (route) => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(base + '/treasury');
    await page.getByRole('button', { name: 'Añadir fuente' }).click();
    await page.getByLabel('Nombre del acceso').fill('Niubiz piloto QA');
    await page.getByLabel('Titular / razón social').fill('Entidad de prueba');
    await page.getByRole('button', { name: 'Guardar fuente' }).click();
    await page.getByRole('button', { name: 'Añadir comercio' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Comercio QA');
    await page.getByLabel('Código o identificador del comercio').fill('001234');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await page.getByRole('cell', { name: 'Comercio QA 001234' }).waitFor();
    assert.equal(sources[0].targets[0].reference, '001234');
    assert.equal(await page.getByText('Conexiones pendientes', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Editar Comercio QA' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Comercio actualizado');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await page.getByRole('cell', { name: 'Comercio actualizado 001234' }).waitFor();

    conflict = true;
    await page.getByRole('button', { name: 'Añadir comercio' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Duplicado');
    await page.getByLabel('Código o identificador del comercio').fill('001234');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await page.getByRole('alert').filter({ hasText: 'Ya existe esa referencia' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.locator('[data-sonner-toast]').last().waitFor({ state: 'hidden', timeout: 10000 });
    conflict = false;

    const output = path.join(os.tmpdir(), 'mali-treasury-qa');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'La página no debe desbordarse en móvil');

    failOverview = true;
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'No se pudieron cargar' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Añadir fuente' }).count(), 0);
    failOverview = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByRole('button', { name: 'Añadir fuente' }).waitFor();
    authorized = false;
    await page.reload();
    await page.waitForURL(base + '/');
    assert.equal(await page.getByRole('button', { name: 'Añadir fuente' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('OK: alta, edición, duplicado, error y recuperación, permiso y vista móvil. Capturas: ' + output);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
