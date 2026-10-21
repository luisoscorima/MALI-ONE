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
  if (route === '/qa/inline') { const doc = content(); doc.leadFormLayout = 'inline'; res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html(doc)); }
  if (route === '/qa/enhanced') {
    const doc = content();
    const teacher = doc.blocks.find((block) => block.type === 'faculty').data.items[0];
    teacher.linkedinUrl = 'https://www.linkedin.com/in/docente/';
    teacher.role = 'Gestión cultural y políticas públicas';
    teacher.description = 'Experiencia en proyectos culturales, formación de públicos, investigación y colaboración con instituciones del sector. '.repeat(7);
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html(doc));
  }
  if (route === '/qa/video') {
    const doc = content();
    doc.blocks.find((block) => block.type === 'hero').data.videoUrl = base + '/qa/hero.webm';
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html(doc));
  }
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
          const teacher = request.url().match(/docente_(\d+)\.jpg/);
          const height = teacher ? (Number(teacher[1]) % 2 ? 1100 : 760) : 450;
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
    assert.equal(await page.locator('.overview__figure img').count(), 1, 'La primera sección de texto incorpora una fotografía de la galería');
    assert.equal(await page.locator('.program-facts').count(), 1, 'Ficha de datos clave');
    assert.equal(await page.locator('.reading-progress').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.locator('.hero').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(0, 34, 204)');
    let hero = await page.locator('.hero').boundingBox();
    let panel = await page.locator('.lead-panel').boundingBox();
    assert.ok(panel.y >= hero.y + hero.height, 'El formulario debe empezar después del hero');
    await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
    await page.locator('#programa').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120));
    await page.waitForFunction(() => document.querySelector('.site-nav a[href="#programa"]').getAttribute('aria-current') === 'location');
    assert.ok(Number(await page.locator('.reading-progress').getAttribute('aria-valuenow')) > 0);
    await page.screenshot({ path: path.join(output, 'desktop-tipografia.png') });
    const typeGroups = await page.evaluate(() => {
      const groups = {
        labels: ['#programa .eyebrow', '#beneficios .eyebrow', '#malla .eyebrow', '#docentes .eyebrow'],
        headings: ['#programa h2', '#beneficios h2', '#malla h2', '#docentes h2', '#inversion h2', '#whatsapp h2', '#brochure h2'],
        paragraphs: ['#programa p:not(.eyebrow)', '#beneficios .feature p', '#docentes .faculty-card__copy p', '#inversion p:not(.eyebrow)', '#whatsapp .cta-panel__copy p:not(.eyebrow)'],
        notes: ['.section-note', '.faculty-position'],
      };
      return Object.fromEntries(Object.entries(groups).map(([key, selectors]) => [key, selectors.map((selector) => getComputedStyle(document.querySelector(selector)).fontSize)]));
    });
    for (const [group, sizes] of Object.entries(typeGroups)) assert.equal(new Set(sizes).size, 1, 'Tipografía consistente entre bloques: ' + group);
    console.log('Escala tipográfica: ' + JSON.stringify(typeGroups));
    await page.locator('#inversion').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120));
    await page.screenshot({ path: path.join(output, 'desktop-acciones.png') });
    await page.locator('#malla').scrollIntoViewIfNeeded();
    panel = await page.locator('.lead-panel').boundingBox();
    assert.ok(panel.y >= 100 && panel.y < 150, 'Formulario sticky bajo la cabecera');
    await page.waitForFunction(() => document.getElementById('landingLeadFormFrame').getBoundingClientRect().height > 400);
    assert.equal(await page.frameLocator('#landingLeadFormFrame').locator('.lead-form').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(248, 246, 251)', 'Formulario compacto de fondo suave');
    panel = await page.locator('.lead-panel').boundingBox();
    assert.ok(panel.height < 700, 'Sin espacio vacío innecesario bajo el formulario');
    assert.ok(panel.y + panel.height <= 1000, 'Formulario accesible dentro del viewport');
    await page.screenshot({ path: path.join(output, 'desktop-malla.png') });
    await page.locator('.curriculum-module').nth(1).locator('summary').click();
    assert.equal(await page.locator('.curriculum-module').nth(1).getAttribute('open'), '');
    assert.equal(await page.locator('.curriculum-module[open]').count(), 1, 'Un solo módulo abierto');
    assert.equal(await page.locator('.curriculum-module[open] .accordion-chevron').count(), 1);
    await page.locator('.site-nav').getByRole('link', { name: 'Docentes', exact: true }).click();
    const carousel = page.locator('.faculty-carousel');
    const teacherDots = page.locator('.faculty-dot');
    assert.equal(await teacherDots.count(), 8, 'Un punto por docente');
    assert.equal(await page.locator('.faculty-dot[aria-current="true"]').count(), 1, 'Un solo punto activo');
    assert.equal(await teacherDots.first().getAttribute('aria-current'), 'true');
    const previousTeacher = page.getByRole('button', { name: 'Ver docentes anteriores' });
    const nextTeacher = page.getByRole('button', { name: 'Ver docentes siguientes' });
    const photo = await page.locator('.faculty-card__photo').first().boundingBox();
    assert.ok(photo.height > photo.width, 'Las fotografías deben tener formato vertical');
    assert.equal(await page.locator('.faculty-card img').first().evaluate((el) => getComputedStyle(el).objectFit), 'cover', 'Encuadre uniforme sin deformar las fotografías');
    const photoBottoms = await page.locator('.faculty-card img').evaluateAll((images) => images.map((image) => image.getBoundingClientRect().bottom));
    assert.ok(photoBottoms.every((bottom) => Math.abs(bottom - photoBottoms[0]) < 1), 'Todas las fotografías deben terminar a la misma altura aunque sus proporciones originales sean distintas');
    assert.equal(await carousel.evaluate((el) => getComputedStyle(el).scrollbarWidth), 'none');
    assert.equal(await page.locator('.lead-panel').evaluate((el) => getComputedStyle(el).scrollbarWidth), 'none');
    assert.equal(await previousTeacher.isDisabled(), true);
    await nextTeacher.click();
    await page.waitForFunction(() => document.querySelector('.faculty-carousel').scrollLeft > 100);
    assert.equal(await teacherDots.nth(1).getAttribute('aria-current'), 'true', 'Las flechas actualizan el punto activo');
    await carousel.focus();
    await carousel.press('End');
    await page.waitForFunction(() => document.querySelector('[data-faculty-next]').disabled);
    assert.match(await page.locator('.faculty-position').textContent(), /8 de 8$/);
    await carousel.press('Home');
    await page.waitForFunction(() => document.querySelector('[data-faculty-prev]').disabled);
    await teacherDots.last().click();
    assert.equal(await teacherDots.last().getAttribute('aria-current'), 'true', 'El último punto permite seleccionar al octavo docente');
    assert.equal(await page.locator('.faculty-card.is-current h3').textContent(), 'Melissa Giorgio');
    await teacherDots.first().click();
    assert.equal(await teacherDots.first().getAttribute('aria-current'), 'true');
    await page.screenshot({ path: path.join(output, 'desktop-docentes.png') });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelector('.reading-progress').getAttribute('aria-valuenow') === '100');
    panel = await page.locator('.lead-panel').boundingBox();
    const footer = await page.locator('footer').boundingBox();
    assert.ok(panel.y + panel.height <= footer.y + 1, 'El formulario se detiene antes del footer');
    for (const width of [1100, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + '/qa/landing');
      if (width === 390) await logAlignment(width);
      if (width === 390) {
        await page.locator('#programa').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 104));
        await page.screenshot({ path: path.join(output, 'mobile-tipografia.png') });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
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
    await page.getByLabel('URL de fotografía de la sección', { exact: true }).fill('https://example.test/programa.jpg');
    await page.getByLabel('Texto alternativo de la fotografía', { exact: true }).fill('Comunidad del MALI');
    await page.getByLabel('Composición de la sección', { exact: true }).selectOption('left');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await page.getByTitle('Editar', { exact: true }).waitFor();
    assert.equal(record.content.blocks.find((b) => b.type === 'investment').data.enrollment, '725');
    await page.getByTitle('Editar', { exact: true }).click();
    await page.getByLabel('Matrícula', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Matrícula', { exact: true }).inputValue(), '725');
    assert.equal(await page.getByLabel('URL de fotografía de la sección', { exact: true }).inputValue(), 'https://example.test/programa.jpg');
    assert.equal(await page.getByLabel('Composición de la sección', { exact: true }).inputValue(), 'left');
    assert.equal(await page.getByLabel('Descripción del docente', { exact: true }).first().inputValue(), text + 'más palabras');
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await page.locator('iframe[title="Vista previa de la landing"]').waitFor();
    const preview = page.frameLocator('iframe[title="Vista previa de la landing"]');
    assert.equal(await preview.locator('.curriculum-module').count(), 13);
    assert.equal(await preview.locator('.overview--left img').getAttribute('src'), 'https://example.test/programa.jpg');
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
    const enhancedPage = await context.newPage();
    await enhancedPage.addInitScript(() => {
      window.revealCounts = new WeakMap();
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        window.revealCounts.set(this, (window.revealCounts.get(this) || 0) + 1);
        return animate.apply(this, args);
      };
    });
    await enhancedPage.goto(base + '/qa/enhanced');
    assert.equal(await enhancedPage.locator('.faculty-link').count(), 1, 'Solo el docente con URL muestra LinkedIn');
    assert.equal(await enhancedPage.locator('.faculty-link [data-icon="linkedin"]').count(), 1);
    assert.match(await enhancedPage.locator('.faculty-link').getAttribute('rel'), /noopener/);
    const biography = enhancedPage.locator('.faculty-description').first();
    const biographyButton = enhancedPage.locator('.faculty-bio-toggle').first();
    await biographyButton.waitFor({ state: 'visible' });
    const collapsedBiography = await biography.evaluate((el) => el.clientHeight);
    await biographyButton.click();
    assert.equal(await biographyButton.getAttribute('aria-expanded'), 'true');
    assert.ok(await biography.evaluate((el) => el.clientHeight) > collapsedBiography, 'Leer más muestra toda la biografía');
    await biographyButton.click();
    assert.equal(await biographyButton.getAttribute('aria-expanded'), 'false');
    assert.equal(await enhancedPage.locator('.facts [data-icon]').count(), 3);
    assert.equal(await enhancedPage.locator('.feature').count(), await enhancedPage.locator('.feature-icon>svg').count() - await enhancedPage.locator('.schedule-card .feature-icon').count());
    await enhancedPage.locator('#beneficios').scrollIntoViewIfNeeded();
    assert.equal(await enhancedPage.locator('#beneficios .feature').first().evaluate((el) => getComputedStyle(el).opacity), '1', 'Contenido visible con movimiento reducido');
    assert.equal(await enhancedPage.locator('[data-revealed]').count(), 0, 'Sin animaciones de entrada con movimiento reducido');
    await enhancedPage.emulateMedia({ reducedMotion: 'no-preference' });
    await enhancedPage.waitForFunction(() => document.querySelector('#beneficios .feature').dataset.revealed === 'true');
    await enhancedPage.waitForFunction(() => document.querySelector('#beneficios .feature').getAnimations().length === 0);
    assert.equal(await enhancedPage.locator('#beneficios .feature').first().evaluate((el) => window.revealCounts.get(el)), 1);
    await enhancedPage.locator('#preguntas').scrollIntoViewIfNeeded();
    await enhancedPage.locator('#beneficios').scrollIntoViewIfNeeded();
    assert.equal(await enhancedPage.locator('#beneficios .feature').first().evaluate((el) => window.revealCounts.get(el)), 1, 'La entrada se anima una sola vez');
    await enhancedPage.emulateMedia({ reducedMotion: 'reduce' });
    await enhancedPage.locator('#docentes').scrollIntoViewIfNeeded();
    await enhancedPage.screenshot({ path: path.join(output, 'desktop-linkedin.png') });
    await enhancedPage.setViewportSize({ width: 320, height: 844 });
    await enhancedPage.locator('#modalidades').scrollIntoViewIfNeeded();
    assert.ok(await enhancedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Los iconos no desbordan en móvil');
    await enhancedPage.screenshot({ path: path.join(output, 'mobile-iconos.png') });
    await enhancedPage.close();
    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    await noJsContext.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(base + '/qa/enhanced');
    assert.equal(await noJsPage.locator('#beneficios .feature').first().evaluate((el) => getComputedStyle(el).opacity), '1', 'El contenido sigue visible sin JavaScript');
    await noJsPage.locator('.curriculum-module').nth(1).locator('summary').click();
    assert.equal(await noJsPage.locator('.curriculum-module[open]').count(), 1, 'El acordeón funciona sin JavaScript');
    await noJsContext.close();
    const inlinePage = await context.newPage();
    await inlinePage.goto(base + '/qa/inline');
    await inlinePage.locator('#contacto').scrollIntoViewIfNeeded();
    assert.equal(await inlinePage.frameLocator('#landingLeadFormFrame').locator('.lead-form').evaluate((el) => getComputedStyle(el).color), 'rgb(16, 16, 24)', 'Contraste correcto también con formulario inline');
    await inlinePage.goto(base + '/widgets/educacion/lead-form.html');
    assert.equal(await inlinePage.locator('.lead-form').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(180, 179, 255)', 'El widget tradicional conserva su fondo');
    assert.equal(await inlinePage.locator('.lead-form__field input').first().evaluate((el) => getComputedStyle(el).borderRadius), '2px', 'Los campos tradicionales no cambian');
    await inlinePage.close();
    console.log('PASS mejoras visuales: fotografía editable, datos clave, formulario suave, biografías completas, navegación activa, progreso, iconos y animaciones accesibles');
    const videoPage = await context.newPage();
    // Simular reproducción sin descargar archivos ni emitir sonido durante QA.
    await videoPage.addInitScript(() => {
      const playing = new WeakSet();
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get() { return !playing.has(this); } });
      HTMLMediaElement.prototype.play = function () {
        if (window.rejectVideoPlay || (location.search.includes('block-audio') && !this.muted)) return Promise.reject(new DOMException('Reproducción bloqueada', 'NotAllowedError'));
        playing.add(this); this.dispatchEvent(new Event('play')); return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () { playing.delete(this); this.dispatchEvent(new Event('pause')); };
    });
    await videoPage.route('**/qa/hero.webm', (route) => route.abort());
    await videoPage.goto(base + '/qa/video');
    assert.equal(await videoPage.locator('video').evaluate((el) => el.paused && el.muted), true, 'Movimiento reducido impide el inicio automático');
    await videoPage.getByRole('button', { name: 'Activar sonido', exact: true }).click();
    assert.equal(await videoPage.locator('video').evaluate((el) => !el.paused && !el.muted && el.volume === 1), true);
    assert.equal(await videoPage.locator('.hero__sound').getAttribute('aria-pressed'), 'true');
    await videoPage.getByRole('button', { name: 'Silenciar video', exact: true }).click();
    assert.equal(await videoPage.locator('video').evaluate((el) => el.muted), true);
    await videoPage.getByRole('button', { name: 'Pausar video', exact: true }).click();
    await videoPage.evaluate(() => { window.rejectVideoPlay = true; });
    await videoPage.getByRole('button', { name: 'Activar sonido', exact: true }).click();
    await videoPage.waitForFunction(() => document.querySelector('.hero__sound').getAttribute('aria-pressed') === 'false');
    assert.equal(await videoPage.getByRole('button', { name: 'Reproducir video', exact: true }).count(), 1, 'Se puede reintentar si el navegador bloquea el inicio');
    await videoPage.evaluate(() => { window.rejectVideoPlay = false; });
    await videoPage.emulateMedia({ reducedMotion: 'no-preference' });
    await videoPage.waitForFunction(() => !document.querySelector('video').paused);
    assert.equal(await videoPage.locator('video').evaluate((el) => el.muted), true, 'Se conserva la elección manual de silencio');
    await videoPage.goto(base + '/qa/video');
    assert.equal(await videoPage.locator('video').evaluate((el) => !el.paused && !el.muted), true, 'Inicio con sonido cuando el navegador lo permite');
    await videoPage.goto(base + '/qa/video?block-audio');
    await videoPage.waitForFunction(() => { const el = document.querySelector('video'); return !el.paused && el.muted; });
    assert.equal(await videoPage.getByRole('button', { name: 'Activar sonido', exact: true }).count(), 1, 'Si se bloquea el audio, reproduce silenciado');
    assert.equal(await videoPage.locator('video').evaluate((el) => getComputedStyle(el).opacity), '1', 'El video no pierde opacidad');
    for (const width of [1440, 320]) {
      await videoPage.setViewportSize({ width, height: 1000 });
      const controls = await videoPage.locator('.hero__media-controls').boundingBox();
      const copy = await videoPage.locator('.hero__content').boundingBox();
      const facts = await videoPage.locator('.hero .facts').boundingBox();
      assert.ok(controls.x >= 0 && controls.x + controls.width <= width, 'Controles dentro del ancho disponible');
      assert.ok(controls.y >= facts.y + facts.height && controls.y + controls.height <= copy.y + copy.height, 'Controles separados del texto');
      await videoPage.screenshot({ path: path.join(output, width === 320 ? 'mobile-video.png' : 'desktop-video.png') });
    }
    await videoPage.close();
    console.log('PASS video: activar/silenciar, pausa, inicio bloqueado, movimiento reducido y controles adaptables (reproducción simulada)');
    const autoPage = await context.newPage();
    await autoPage.emulateMedia({ reducedMotion: 'no-preference' });
    await autoPage.goto(base + '/qa/landing');
    await autoPage.locator('#docentes').scrollIntoViewIfNeeded();
    await autoPage.locator('.faculty-card').first().hover();
    await autoPage.waitForFunction(() => document.querySelector('.faculty-carousel').scrollLeft > 100, null, { timeout: 10000 });
    assert.equal(await autoPage.locator('.faculty-dot').nth(1).getAttribute('aria-current'), 'true', 'El avance automático actualiza el punto activo');
    await autoPage.locator('.faculty-dot').first().click();
    await autoPage.waitForFunction(() => document.querySelector('.faculty-dot').getAttribute('aria-current') === 'false', null, { timeout: 10000 });
    assert.equal(await autoPage.locator('.faculty-dot').nth(1).getAttribute('aria-current'), 'true', 'Continúa automáticamente después de pulsar un punto');
    await autoPage.getByRole('button', { name: 'Pausar carrusel', exact: true }).click();
    await autoPage.locator('.brand').focus();
    await autoPage.mouse.move(0, 0);
    await autoPage.waitForTimeout(700);
    const stoppedAt = await autoPage.locator('.faculty-carousel').evaluate((el) => el.scrollLeft);
    await autoPage.waitForTimeout(5500);
    assert.equal(await autoPage.locator('.faculty-carousel').evaluate((el) => el.scrollLeft), stoppedAt, 'Pausa manual del avance automático');
    await autoPage.getByRole('button', { name: 'Reanudar carrusel', exact: true }).click();
    await autoPage.locator('.brand').focus();
    await autoPage.mouse.move(0, 0);
    await autoPage.waitForFunction((previous) => document.querySelector('.faculty-carousel').scrollLeft > previous + 50, stoppedAt, { timeout: 10000 });
    await autoPage.emulateMedia({ reducedMotion: 'reduce' });
    await autoPage.waitForFunction(() => document.querySelector('[data-faculty-autoplay]').hidden);
    await autoPage.close();
    console.log('PASS carrusel: fotos uniformes, barras ocultas, avance automático, pausa y reanudación');
    console.log('Capturas QA: ' + output + ' (imágenes externas sustituidas durante las pruebas)');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
