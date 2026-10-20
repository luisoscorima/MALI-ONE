// Ejecutar después de build:web. Usa datos locales y bloquea cualquier envío externo.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { root, content, renderer, clone } = require('./landings-fixture.cjs');
const playwrightPath = process.env.LANDINGS_PLAYWRIGHT_PATH || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(playwrightPath);
const output = process.env.LANDINGS_QA_DIR || path.join(os.tmpdir(), 'mali-landings-qa');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
let base;
let record;
let leadRequests = 0;
let lastLeadPayload;
const user = { id: 'qa', name: 'QA local', email: 'qa@example.test', role: 'admin', isSuperAdmin: false, picture: null, modules: ['landings'], accentTheme: null };
const html = (doc = content(), preview = true) => renderer.renderLandingHtml({ slug: 'gestion-cultural', name: 'Gestión Cultural', content: doc, apiBase: base, canonicalUrl: base + '/qa/landing', preview });
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  const route = url.pathname;
  if (route.startsWith('/api/')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    if (route === '/api/auth/me') return json(res, user);
    if (route === '/api/landings/preview') return json(res, { html: html(data.content) });
    if (route === '/api/landings' && req.method === 'GET') return json(res, record ? [record] : []);
    if ((route === '/api/landings' && req.method === 'POST') || (route === '/api/landings/qa' && req.method === 'PATCH')) {
      record = { id: 'qa', slug: 'gestion-cultural', name: 'Gestión Cultural', status: 'draft', publishedVersion: 0, publishedAt: null, publicUrl: null, ...record, ...data };
      return json(res, record);
    }
    if (route === '/api/landings/qa') return json(res, record);
    if (route.includes('/educacion/leads')) { leadRequests++; lastLeadPayload = data; return json(res, { id: 'local-qa', ok: true }); }
    return json(res, {});
  }
  if (route === '/qa/landing') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html()); }
  if (route === '/qa/published') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html(content(), false)); }
  const publicRoot = path.join(root, 'apps/web', route.startsWith('/widgets/') ? 'public' : 'dist');
  let file = path.resolve(publicRoot, '.' + route);
  if (!file.startsWith(publicRoot + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = route.startsWith('/widgets/') ? '' : path.join(publicRoot, 'index.html');
  if (!file) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  fs.mkdirSync(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', (route) => {
      const request = route.request();
      if (!request.url().startsWith(base)) {
        // Las imágenes externas no se descargan ni se guardan en el repositorio.
        if (request.resourceType() === 'image') {
          const height = /docente_\d+\.jpg/.test(request.url()) ? 900 : 450;
          return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${height}"><rect width="600" height="${height}" fill="#ddd"/></svg>` });
        }
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const logAlignment = async (width) => console.log('Alineación horizontal ' + width + 'px: ' + JSON.stringify(await page.evaluate(() => {
      const selectors = {
        hero: '.hero__content>.eyebrow', programa: '#programa .eyebrow', beneficios: '#beneficios .eyebrow',
        malla: '#malla .eyebrow', docentes: '#docentes .eyebrow', modalidades: '#modalidades .eyebrow',
        inversion: '#inversion .eyebrow', whatsapp: '#whatsapp .eyebrow', brochure: '#brochure .eyebrow', preguntas: '#preguntas .eyebrow',
      };
      return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, Math.round(document.querySelector(selector).getBoundingClientRect().left)]));
    })));
    await page.setViewportSize({ width: 1920, height: 1300 });
    await page.goto(base + '/qa/landing');
    await logAlignment(1920);
    await page.screenshot({ path: path.join(output, 'desktop-alineacion.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/qa/landing');
    assert.equal(await page.locator('.curriculum-module').count(), 13);
    assert.equal(await page.locator('.faculty-card').count(), 8);
    assert.equal(await page.locator('video').count(), 0);
    assert.equal(await page.locator('.hero').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(0, 34, 204)');
    let hero = await page.locator('.hero').boundingBox();
    let panel = await page.locator('.lead-panel').boundingBox();
    assert.ok(panel.y >= hero.y + hero.height, 'El formulario debe empezar después del hero');
    await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
    await page.locator('#inversion').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120));
    await page.screenshot({ path: path.join(output, 'desktop-acciones.png') });
    await page.locator('#malla').scrollIntoViewIfNeeded();
    panel = await page.locator('.lead-panel').boundingBox();
    assert.ok(panel.y >= 100 && panel.y < 150, 'Formulario sticky bajo la cabecera');
    await page.waitForFunction(() => document.getElementById('landingLeadFormFrame').getBoundingClientRect().height > 400);
    panel = await page.locator('.lead-panel').boundingBox();
    assert.ok(panel.height < 700, 'Sin espacio vacío innecesario bajo el formulario');
    assert.ok(panel.y + panel.height <= 1000, 'Formulario accesible dentro del viewport');
    await page.screenshot({ path: path.join(output, 'desktop-malla.png') });
    await page.locator('.curriculum-module').nth(1).locator('summary').click();
    assert.equal(await page.locator('.curriculum-module').nth(1).getAttribute('open'), '');
    await page.locator('.site-nav').getByRole('link', { name: 'Docentes', exact: true }).click();
    const carousel = page.locator('.faculty-carousel');
    const previousTeacher = page.getByRole('button', { name: 'Ver docentes anteriores' });
    const nextTeacher = page.getByRole('button', { name: 'Ver docentes siguientes' });
    const photo = await page.locator('.faculty-card__photo').first().boundingBox();
    assert.ok(photo.height > photo.width, 'Las fotografías deben tener formato vertical');
    assert.equal(await page.locator('.faculty-card img').first().evaluate((el) => getComputedStyle(el).objectFit), 'contain', 'Conservar la fotografía completa');
    assert.equal(await previousTeacher.isDisabled(), true);
    await nextTeacher.click();
    await page.waitForFunction(() => document.querySelector('.faculty-carousel').scrollLeft > 100);
    await carousel.focus();
    await carousel.press('End');
    await page.waitForFunction(() => document.querySelector('[data-faculty-next]').disabled);
    assert.match(await page.locator('.faculty-position').textContent(), /8 de 8$/);
    await carousel.press('Home');
    await page.waitForFunction(() => document.querySelector('[data-faculty-prev]').disabled);
    await page.screenshot({ path: path.join(output, 'desktop-docentes.png') });
    await page.locator('footer').scrollIntoViewIfNeeded();
    panel = await page.locator('.lead-panel').boundingBox();
    const footer = await page.locator('footer').boundingBox();
    assert.ok(panel.y + panel.height <= footer.y + 1, 'El formulario se detiene antes del footer');
    for (const width of [1100, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + '/qa/landing');
      if (width === 390) await logAlignment(width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sin desbordamiento en ' + width);
      assert.equal(await page.locator('.lead-toggle').isVisible(), false);
      await page.locator('.nav-toggle').click();
      assert.equal(await page.locator('.site-nav').isVisible(), true);
      await page.locator('.site-nav').getByRole('link', { name: 'Plan de estudios' }).click();
      await page.waitForFunction(() => document.querySelector('.lead-toggle').hidden === false);
      assert.equal(await page.locator('.site-nav').isVisible(), false);
      await page.locator('.lead-toggle').click();
      assert.equal(await page.locator('.lead-panel').getAttribute('aria-hidden'), 'false');
      const frame = page.frameLocator('#landingLeadFormFrame');
      await frame.getByLabel('Nombres', { exact: false }).fill('Prueba');
      await page.locator('.lead-close').click();
      await page.locator('.lead-toggle').click();
      assert.equal(await frame.getByLabel('Nombres', { exact: false }).inputValue(), 'Prueba');
      await frame.getByRole('button', { name: 'Enviar información' }).click();
      await frame.getByText('Vista previa: no se enviaron datos ni se creó un contacto.').waitFor();
      assert.equal(leadRequests, 0, 'La vista previa no debe enviar leads');
      if (width === 390) await page.screenshot({ path: path.join(output, 'mobile-form.png') });
      await frame.getByLabel('Nombres', { exact: false }).press('Escape');
      await page.waitForFunction(() => document.querySelector('.lead-panel').getAttribute('aria-hidden') === 'true');
      await page.locator('#docentes').scrollIntoViewIfNeeded();
      const mobilePhoto = await page.locator('.faculty-card__photo').first().boundingBox();
      assert.ok(mobilePhoto.height > mobilePhoto.width, 'Retratos verticales en ' + width);
      await nextTeacher.click();
      await page.waitForFunction(() => document.querySelector('.faculty-carousel').scrollLeft > 100);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'El carrusel no ensancha la página en ' + width);
      if (width === 390) await page.screenshot({ path: path.join(output, 'mobile-docentes.png') });
      if (width === 390) {
        await page.locator('#inversion').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 104));
        await page.screenshot({ path: path.join(output, 'mobile-acciones.png') });
      }
    }
    console.log('PASS landing: hero, malla, formulario sticky, footer, menú y cuatro anchos móviles; cero leads');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/admin/landings');
    await page.getByRole('button', { name: 'Nueva landing' }).click();
    const description = page.getByLabel('Descripción del docente', { exact: true }).first();
    const text = 'Descripción con espacios\n\nSegunda línea | completa ';
    await description.fill(text);
    await description.press('End');
    await description.pressSequentially('más palabras');
    assert.equal(await description.inputValue(), text + 'más palabras');
    await page.getByLabel('Matrícula', { exact: true }).fill('725');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await page.getByTitle('Editar', { exact: true }).waitFor();
    assert.equal(record.content.blocks.find((b) => b.type === 'investment').data.enrollment, '725');
    await page.getByTitle('Editar', { exact: true }).click();
    await page.getByLabel('Matrícula', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Matrícula', { exact: true }).inputValue(), '725');
    assert.equal(await page.getByLabel('Descripción del docente', { exact: true }).first().inputValue(), text + 'más palabras');
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await page.locator('iframe[title="Vista previa de la landing"]').waitFor();
    const preview = page.frameLocator('iframe[title="Vista previa de la landing"]');
    assert.equal(await preview.locator('.curriculum-module').count(), 13);
    assert.equal(errors.length, 0, 'Errores JS: ' + errors.join('; '));
    console.log('PASS editor: edición de biografías, matrícula, guardado, reapertura y vista previa');

    await page.goto(base + '/qa/published?utm_source=qa&utm_campaign=local');
    await page.locator('#malla').scrollIntoViewIfNeeded();
    const publicForm = page.frameLocator('#landingLeadFormFrame');
    await publicForm.getByLabel('Nombres', { exact: false }).fill('Prueba local');
    await publicForm.getByLabel('Apellidos', { exact: false }).fill('Simulada');
    await publicForm.getByLabel('Celular', { exact: false }).fill('987654321');
    await publicForm.getByRole('button', { name: 'Enviar información' }).click();
    await page.waitForFunction(() => (window.dataLayer || []).some((event) => event.event === 'generate_lead'));
    assert.equal(leadRequests, 1, 'Solo un envío a la API simulada local');
    assert.equal(lastLeadPayload.captureSource, 'landing');
    assert.equal(lastLeadPayload.utmSource, 'qa');
    assert.equal(lastLeadPayload.utmCampaign, 'local');
    assert.equal(lastLeadPayload.whatsappArea, 'educacion_ep');
    await page.waitForFunction(() => document.getElementById('landingLeadFormFrame').getBoundingClientRect().height < 400);
    console.log('PASS captura pública simulada: un envío local con UTMs, origen landing y evento generate_lead');
    console.log('Capturas QA: ' + output + ' (imágenes externas sustituidas durante las pruebas)');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
