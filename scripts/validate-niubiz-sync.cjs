// Local integration tests: real PostgreSQL, simulated Niubiz transport, no credentials.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
req('reflect-metadata');
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
if (target.hostname !== '127.0.0.1' || target.port !== '55439' || target.pathname !== '/mali_niubiz_local') throw new Error('Local isolated database required.');
const { PrismaClient } = req('@prisma/client');
const { TreasuryPaymentsService } = require('../apps/api/dist/modules/treasury/treasury-payments.service');
const { NiubizSyncService } = require('../apps/api/dist/modules/treasury/niubiz-sync.service');
const merchants = require('../apps/api/dist/modules/treasury/niubiz-merchants.json');
assert.equal(merchants.length, 77);
assert.equal(new Set(merchants).size, 77);
assert.deepEqual(merchants, require('./niubiz-merchants.json'));
merchants.splice(3); // Mutates only this test process's module cache.
const prisma = new PrismaClient();
const service = new NiubizSyncService(prisma, new TreasuryPaymentsService(prisma));
const token = `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.test`;
const realFetch = global.fetch;
let mode = 'ok';
let requests = 0;
let logins = 0;
let importStart;
const fixture = merchant => ({ 'Código de comercio': merchant, 'Nombre de comercio': 'Test', 'Código de transaccion': 'TESTNIUBIZSYNC', 'Nro Pedido': 'TEST', Cliente: '', Moneda: 'PEN', 'Importe Pedido': '10.00', Estado: 'Liquidada', 'Fecha de Transacción': '10/10/2026 12:00:00', 'Fecha de Liquidación': '' });
global.fetch = async (url, options) => {
  assert.equal(url, 'https://api.niubiz.pe/api.backoffice.merchant/order');
  assert.equal(options.headers.Authorization, `Bearer ${token}`);
  const body = JSON.parse(options.body);
  assert.equal(body.export, true);
  requests++;
  if (mode === '401' && requests === 1) return new Response('', { status: 401 });
  if (mode === '429') return new Response('', { status: 429 });
  const row = fixture(body.merchantId);
  if (mode === 'mismatch' && body.merchantId === merchants[1]) row['Código de comercio'] = '999999999';
  return Response.json({ header: { errorCode: 0 }, data: { count: body.merchantId === merchants[2] ? 0 : 1, list: body.merchantId === merchants[2] ? [] : [row] } });
};
const range = { from: '2026-10-01', to: '2026-10-31' };
async function waitDone() {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const state = (await service.status()).lastRun;
    if (state?.status !== 'running') return state;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test timed out');
}
async function main() {
  for (const key of ['FINANCE_VAULT_CLIENT_ID', 'FINANCE_VAULT_CLIENT_SECRET', 'FINANCE_VAULT_MASTER_PASSWORD', 'FINANCE_VAULT_NIUBIZ_ITEM_ID', 'NIUBIZ_RUNTIME_NODE', 'NIUBIZ_LOGIN_SCRIPT']) process.env[key] = 'test-placeholder';
  process.env.FINANCE_VAULT_URL = 'https://vault.example.test';
  process.env.NIUBIZ_SYNC_ENABLED = 'false';
  await prisma.niubizSyncState.deleteMany();
  importStart = new Date();
  let release;
  service.login = () => new Promise(resolve => { release = () => { logins++; resolve(token); }; });
  await assert.rejects(() => service.start({ from: '2026-02-31', to: '2026-03-01' }), /Fecha inválida/);
  await service.start(range);
  await assert.rejects(() => service.start(range), /Ya existe/);
  release();
  let run = await waitDone();
  assert.equal(run.status, 'completed');
  assert.equal(run.results.length, 3);
  assert.equal(run.results[2].rows, 0);
  assert.equal(run.results.reduce((n, r) => n + r.createdCount, 0), 2);
  const stored = await prisma.treasuryPayment.findMany({ where: { transactionCode: 'TESTNIUBIZSYNC' }, include: { lastImport: true } });
  assert.equal(stored.length, 2);
  assert.ok(stored.every(p => p.lastImport.origin === 'niubiz_api'));
  service.login = async () => { logins++; return token; };
  mode = '401'; requests = 0; logins = 0;
  await service.start(range); run = await waitDone();
  assert.equal(run.status, 'completed');
  assert.equal(logins, 2);
  assert.equal(run.results.reduce((n, r) => n + r.createdCount + r.updatedCount, 0), 0);
  mode = 'mismatch';
  await service.start(range); run = await waitDone();
  assert.equal(run.status, 'partial');
  assert.equal(run.results[1].status, 'API_DATA_MISMATCH');
  mode = '429'; requests = 0;
  await service.start(range); run = await waitDone();
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'RATE_LIMITED');
  assert.equal(requests, 1);
  service.login = async () => { throw new Error('VAULT_UNLOCK'); };
  await service.start(range); run = await waitDone();
  assert.equal(run.errorCode, 'VAULT_UNLOCK');
  assert.equal(run.leaseUntil, null);
  await prisma.niubizSyncState.update({ where: { id: 'niubiz' }, data: { status: 'running', leaseUntil: new Date(0) } });
  assert.equal((await service.status()).lastRun.status, 'interrupted');
  assert.equal(service.expiresSoon('invalid'), true);
  assert.equal(service.expiresSoon(token), false);
  console.log('PASS: range validation, distributed lock, API persistence, idempotence, 401 renewal, empty merchant, partial failure, 429 stop, Vault failure, interrupted run.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  global.fetch = realFetch;
  await prisma.treasuryPayment.deleteMany({ where: { transactionCode: 'TESTNIUBIZSYNC' } });
  if (importStart) await prisma.treasuryPaymentImport.deleteMany({ where: { origin: 'niubiz_api', actorId: 'niubiz_scheduler', createdAt: { gte: importStart } } });
  await prisma.niubizSyncState.deleteMany();
  await prisma.$disconnect();
});
