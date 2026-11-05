// Read-only checks against the isolated local payment database.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
req('reflect-metadata');
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '55439' || url.pathname !== '/mali_niubiz_local') throw new Error('Isolated local database required');
const { PrismaClient } = req('@prisma/client');
const { TreasuryPaymentsService } = require('../apps/api/dist/modules/treasury/treasury-payments.service');
const prisma = new PrismaClient();
const service = new TreasuryPaymentsService(prisma);
async function main() {
  const all = await prisma.treasuryPayment.findMany({ where: { provider: 'niubiz_sales' }, orderBy: [{ transactedAt: 'desc' }, { id: 'desc' }] });
  assert.ok(all.length > 50, 'Needs payments beyond the first page');
  const late = all[all.length - 1];
  for (const q of [late.transactionCode, late.orderNumber, late.customerName.toLowerCase().slice(0, 8), '%', '_', '\\', 'no-existing-niubiz-record']) {
    const expected = all.filter(row => [row.orderNumber, row.transactionCode, row.customerName, row.customerEmail ?? ''].some(v => v.toLowerCase().includes(q.toLowerCase())));
    const result = await service.list({ q: `  ${q}  ` });
    assert.equal(result.total, expected.length);
    assert.deepEqual(result.payments.map(p => p.id), expected.slice(0, 50).map(p => p.id));
  }
  const found = await service.list({ q: late.transactionCode, merchant: late.merchantCode, status: late.status });
  assert.ok(found.payments.some(p => p.id === late.id));
  assert.equal((await service.list({ q: late.transactionCode, merchant: '999999999' })).total, 0);
  assert.equal((await service.list({ q: '   ' })).total, all.length);
  console.log('PASS: server-side search beyond first page; order, transaction, customer; case-insensitive partial text; literal wildcards; combined filters; empty and missing results.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
