// Isolated local validation and optional preview using the real Treasury services + PostgreSQL.
// This harness is never imported by the application or included in its production server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'apps/api/package.json'));
req('reflect-metadata');
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
if (target.hostname !== '127.0.0.1' || target.port !== '55439' || target.pathname !== '/mali_niubiz_local') throw new Error('This harness only accepts the isolated local Niubiz database.');
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient();
const { TreasuryPaymentsService } = require('../apps/api/dist/modules/treasury/treasury-payments.service');
const { niubizDate } = require('../apps/api/dist/modules/treasury/niubiz-import');
const service = new TreasuryPaymentsService(prisma);

async function run() {
  const actor = await prisma.user.upsert({ where: { email: 'niubiz-local@example.test' }, update: {}, create: { email: 'niubiz-local@example.test', googleId: 'niubiz-local-validation', name: 'Validación local Niubiz', role: 'operator' } });
  if (!process.argv.includes('--serve-only')) {
  const file = fs.readFileSync(process.argv[2]);
  const first = await service.importXlsx(actor, file);
  const repeated = await service.importXlsx(actor, file);
  assert.equal(first.rows, 252);
  assert.equal(repeated.createdCount, 0);
  assert.equal(repeated.updatedCount, 0);
  assert.equal(repeated.unchangedCount, 252);
  const query = { merchant: '650177853', from: '2026-10-01', to: '2026-10-31' };
  assert.equal((await service.list(query)).total, 252);
  assert.equal((await service.list({ ...query, status: 'Liquidada' })).total, 232);
  assert.equal((await service.list({ ...query, status: 'Denegada' })).total, 20);
  assert.equal((await service.list({ ...query, page: 6 })).payments.length, 2);
  assert.equal(niubizDate('31/10/2026 21:03:08').toISOString(), '2026-11-01T02:03:08.000Z');
  assert.throws(() => niubizDate('31/02/2026 12:00:00'));
  await assert.rejects(service.list({ from: '2026-11-01', to: '2026-10-01' }));
  const ExcelJS = req('exceljs');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(file);
  const sheet = book.getWorksheet('sells');
  const oldStatus = sheet.getRow(3).getCell(14).value;
  sheet.getRow(3).getCell(14).value = 'Anulada';
  try {
    const updated = await service.importXlsx(actor, Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(updated.updatedCount, 1);
    assert.equal(updated.createdCount, 0);
  } finally { await service.importXlsx(actor, file); }
  sheet.getRow(3).getCell(14).value = oldStatus;
  sheet.getRow(4).getCell(4).value = 'importe-invalido';
  const before = await prisma.treasuryPaymentImport.count();
  await assert.rejects(service.importXlsx(actor, Buffer.from(await book.xlsx.writeBuffer())));
  assert.equal(await prisma.treasuryPaymentImport.count(), before);
  assert.equal((await service.list(query)).total, 252);
  console.log('PASS: PostgreSQL real, 252 operaciones; reimportación sin duplicados; actualización de estado; rechazo de lote inválido; filtros, paginación y fechas Lima.');
  }
  if (!process.argv.includes('--serve') && !process.argv.includes('--serve-only')) return prisma.$disconnect();
  const { Module, Controller, Get, ValidationPipe } = req('@nestjs/common');
  const { NestFactory } = req('@nestjs/core');
  const { TreasuryModule } = require('../apps/api/dist/modules/treasury/treasury.module');
  const { PrismaModule } = require('../apps/api/dist/core/prisma/prisma.module');
  class LocalAuth { me() { return { ...actor, role: 'admin', name: 'Validación local Niubiz', modules: ['treasury'], isSuperAdmin: false }; } }
  Controller('auth')(LocalAuth);
  Get('me')(LocalAuth.prototype, 'me', Object.getOwnPropertyDescriptor(LocalAuth.prototype, 'me'));
  class LocalPreview {}
  Module({ imports: [PrismaModule, TreasuryModule], controllers: [LocalAuth] })(LocalPreview);
  const app = await NestFactory.create(LocalPreview, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.use((request, response, next) => {
    if (request.headers.host !== '127.0.0.1:5187' && request.headers.host !== 'localhost:5187') return response.status(403).end();
    if (request.headers.origin && !['http://127.0.0.1:5187', 'http://localhost:5187'].includes(request.headers.origin)) return response.status(403).end();
    request.user = actor;
    next();
  });
  const express = createRequire(req.resolve('@nestjs/platform-express'))('express');
  const dist = path.join(root, 'apps/web/dist');
  app.use(express.static(dist));
  app.use((request, response, next) => request.method === 'GET' && !request.path.startsWith('/api/') ? response.sendFile(path.join(dist, 'index.html')) : next());
  await app.listen(5187, '127.0.0.1');
  console.log('LOCAL_PREVIEW: http://127.0.0.1:5187/treasury (usuario de prueba local; datos persistidos reales)');
}
run().catch(async error => { console.error(error.message); await prisma.$disconnect(); process.exitCode = 1; });
