const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { shared, renderer, LandingsService, content, render, clone } = require('./landings-fixture.cjs');

test('contenido aprobado: 13 módulos, proyecto final, ocho docentes e inversión después de modalidades', () => {
  const doc = content();
  const html = render(doc);
  assert.equal(doc.blocks.find((b) => b.type === 'curriculum').data.items.length, 13);
  assert.equal(doc.blocks.find((b) => b.type === 'faculty').data.items.length, 8);
  assert.equal(doc.logoUrl, 'https://educacion.mali.pe/wp-content/uploads/2025/02/logo.png');
  assert.equal(doc.blocks.find((b) => b.type === 'hero').data.videoUrl, 'https://educacion.mali.pe/wp-content/uploads/2026/10/Adobe-Express-Testimonios_PEGC_25mb.mp4');
  assert.ok(doc.blocks.find((b) => b.type === 'faculty').data.items.every((item) => item.linkedinUrl === 'https://www.linkedin.com/'));
  assert.match(html, /Proyecto Integrador Final/);
  assert.ok(html.indexOf('id="inversion"') > html.indexOf('id="modalidades"'));
  assert.match(html, /S\/ 490/);
  assert.equal((html.match(/id="landingLeadFormFrame"/g) || []).length, 1);
  assert.ok(html.indexOf('class="lead-sidebar"') > html.indexOf('class="hero"'));
  assert.ok(html.indexOf('<footer ') > html.indexOf('class="lead-sidebar"'));
});

test('normalización y guardado conservan precios, biografías, navbar y opciones', async () => {
  const doc = content();
  doc.logoWidth = 310;
  Object.assign(doc.blocks.find((b) => b.type === 'text').data, { imageUrl: 'https://example.test/museo.jpg', imageAlt: 'Museo', imageCaption: 'Comunidad MALI', imageLayout: 'left' });
  doc.blocks.find((b) => b.type === 'investment').data.enrollment = '550';
  doc.blocks.find((b) => b.type === 'faculty').data.items[0].description = 'Dos palabras\n\nOtra línea | completa';
  let saved;
  const service = new LandingsService({ landingPage: { create: async ({ data }) => { saved = data.content; return data; } } }, { get: () => undefined });
  await service.create('user', { slug: 'gestion-cultural', name: 'Programa', content: doc });
  const reopened = renderer.normalizeLandingDocument(clone(saved));
  assert.deepEqual(reopened, renderer.normalizeLandingDocument(doc));
  assert.match(render(reopened), /S\/ 550/);
});

test('límites devuelven error en vez de descartar bloques o elementos', async () => {
  const service = new LandingsService({ landingPage: { create: () => assert.fail('No debe guardar') } }, { get: () => undefined });
  for (const doc of [
    { blocks: Array.from({ length: 51 }, (_, i) => ({ id: 't' + i, type: 'text', data: {} })) },
    { blocks: [{ id: 'malla', type: 'curriculum', data: { items: Array.from({ length: 51 }, () => ({})) } }] },
  ]) {
    await assert.rejects(() => service.create('user', { slug: 'test', name: 'Test', content: doc }), /50/);
  }
});

test('vista previa no carga GTM y transmite modo de prueba al widget', () => {
  const service = new LandingsService({}, { get: (key) => key === 'LANDINGS_GTM_ID' ? 'GTM-TEST' : undefined });
  const { html } = service.preview({ name: 'Preview', content: content() });
  assert.doesNotMatch(html, /googletagmanager\.com/);
  assert.match(html, /preview=1/);
  assert.match(html, /if\(true\)return/);
  assert.match(render(content(), { gtmId: 'GTM-TEST' }), /googletagmanager\.com/);
});

test('formulario oculto elimina todos los CTA de contacto y navbar oculta secciones desactivadas', () => {
  const doc = content();
  doc.blocks.find((b) => b.type === 'lead_form').enabled = false;
  doc.blocks.find((b) => b.id === 'docentes').enabled = false;
  const html = render(doc);
  assert.doesNotMatch(html, /<a\s[^>]*href="#contacto"/);
  assert.doesNotMatch(html, /<a\s[^>]*href="#docentes"/);
  assert.doesNotMatch(html, /landingLeadFormFrame" src=/);
});

test('contenido y URLs maliciosos no se convierten en HTML ejecutable', () => {
  const doc = content();
  const faculty = doc.blocks.find((b) => b.type === 'faculty').data.items[0];
  faculty.description = '<script>alert(1)</script>';
  faculty.linkedinUrl = 'javascript:alert(1)';
  doc.blocks.find((b) => b.type === 'hero').data.videoUrl = 'javascript:alert(1)';
  doc.blocks.find((b) => b.type === 'text').data.imageUrl = 'javascript:alert(1)';
  doc.blocks.find((b) => b.type === 'footer').data.instagramUrl = 'javascript:alert(1)';
  const html = render(doc);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /(?:href|src)="javascript:|data-video-src="javascript:/);
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});

test('LinkedIn es opcional; las ocho fotografías usan WordPress en el orden aprobado', () => {
  const doc = content();
  doc.blocks.find((b) => b.type === 'faculty').data.items.forEach((item) => { item.linkedinUrl = ''; });
  assert.doesNotMatch(render(doc), /class="faculty-link"/);
  assert.doesNotMatch(render(doc).split('<footer ')[0], /data-icon="linkedin"/);
  doc.blocks.find((b) => b.type === 'faculty').data.items[0].linkedinUrl = 'https://www.linkedin.com/in/docente/';
  const html = render(doc, { apiBase: 'https://one.example' });
  assert.match(html, /href="https:\/\/www.linkedin.com\/in\/docente\/"/);
  assert.equal((html.split('<footer ')[0].match(/data-icon="linkedin"/g) || []).length, 1);
  const photos = doc.blocks.find((b) => b.type === 'faculty').data.items.map((item) => item.imageUrl);
  assert.deepEqual(photos, Array.from({ length: 8 }, (_, index) => `https://educacion.mali.pe/wp-content/uploads/2026/10/docente_${index + 1}.jpg`));
});

test('mejora de landing antigua conserva ediciones, añade bloques y es idempotente', () => {
  const legacy = content();
  legacy.logoUrl = 'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Educacion.png';
  legacy.blocks.find((b) => b.type === 'hero').data.videoUrl = '';
  delete legacy.navigation; delete legacy.logoWidth; delete legacy.leadFormLayout;
  legacy.blocks = legacy.blocks.filter((b) => !['curriculum', 'investment'].includes(b.type));
  legacy.blocks.find((b) => b.type === 'text').data.body = 'Mi texto personalizado';
  legacy.blocks.find((b) => b.type === 'faculty').data.items = [{ name: 'Docente editado', description: 'Bio propia' }];
  const original = clone(legacy);
  const upgraded = shared.upgradeGestionCulturalLanding(legacy);
  assert.deepEqual(legacy, original);
  assert.equal(upgraded.blocks.find((b) => b.type === 'text').data.body, 'Mi texto personalizado');
  assert.equal(upgraded.blocks.find((b) => b.type === 'faculty').data.items[0].name, 'Docente editado');
  assert.equal(upgraded.leadFormLayout, 'sticky');
  assert.equal(upgraded.logoUrl, shared.DEFAULT_GESTION_CULTURAL_LANDING_CONTENT.logoUrl);
  assert.ok(upgraded.blocks.find((b) => b.type === 'hero').data.videoUrl.endsWith('.mp4'));
  assert.equal(upgraded.blocks.find((b) => b.type === 'faculty').data.items[0].linkedinUrl, 'https://www.linkedin.com/');
  assert.deepEqual(shared.upgradeGestionCulturalLanding(upgraded), upgraded);
  const investment = upgraded.blocks.find((b) => b.type === 'investment');
  investment.data.enrollment = '999';
  assert.equal(shared.upgradeGestionCulturalLanding(upgraded).blocks.find((b) => b.type === 'investment').data.enrollment, '999');
});

test('identificadores duplicados no rompen anclas y el formulario conserva #contacto', () => {
  const normalized = renderer.normalizeLandingDocument({ blocks: [
    { id: 'contacto', type: 'text', data: {} }, { id: 'contacto', type: 'text', data: {} },
    { id: 'form-custom', type: 'lead_form', data: {} },
  ] });
  assert.equal(new Set(normalized.blocks.map((b) => b.id)).size, 3);
  assert.equal(normalized.blocks[2].id, 'contacto');
});

test('guardar borrador no modifica el snapshot publicado', async () => {
  let update;
  const service = new LandingsService({ landingPage: {
    findUnique: async () => ({ id: 'id', status: 'published', slug: 'test', publishedHtml: 'versión anterior' }),
    update: async (args) => { update = args; return args.data; },
  } }, { get: () => undefined });
  await service.update('id', 'user', { content: content() });
  assert.equal('publishedHtml' in update.data, false);
  assert.equal('status' in update.data, false);
});
