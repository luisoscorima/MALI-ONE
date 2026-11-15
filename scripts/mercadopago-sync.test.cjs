const test = require('node:test');
const assert = require('node:assert/strict');
const { MercadoPagoSyncService } = require('../apps/api/dist/modules/treasury/mercadopago-sync.service');

test('Mercado Pago incorpora pagos nuevos y refresca pagos antiguos sin duplicar IDs', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const saved = [];
  const states = [];
  const payment = (id, created, updated, status) => ({
    id, currency_id: 'PEN', date_created: created, date_last_updated: updated,
    transaction_amount: 42, status, payer: { email: 'buyer@example.test' },
  });
  const newPayment = payment(101, '2026-11-14T12:00:00-05:00', '2026-11-14T12:00:00-05:00', 'approved');
  const changedOldPayment = payment(99, '2026-09-01T12:00:00-05:00', '2026-11-14T14:00:00-05:00', 'refunded');
  const prisma = {
    mercadoPagoPayment: { upsert: async (args) => { saved.push(args); } },
    mercadoPagoSyncState: { updateMany: async (args) => { states.push(args.data); } },
    adminAuditLog: { create: async () => {} },
  };
  const service = new MercadoPagoSyncService(prisma);
  service.credentials = async () => 'TEST_TOKEN';
  global.fetch = async (url) => {
    const range = new URL(url).searchParams.get('range');
    requests.push(range);
    return { ok: true, status: 200, json: async () => ({
      results: range === 'date_created' ? [newPayment] : [newPayment, changedOldPayment],
      paging: { total: range === 'date_created' ? 1 : 2 },
    }) };
  };
  try {
    await service.run('source-1', 'vault-item', 'run-1', '2026-11-01', '2026-11-15', { id: 'actor', email: 'actor@example.test' });
    assert.deepEqual(requests, ['date_created', 'date_last_updated']);
    assert.deepEqual(saved.map(item => item.where.sourceId_paymentId.paymentId), ['101', '99']);
    assert.equal(saved[1].update.status, 'refunded');
    assert.equal(states.at(-1).status, 'completed');
    assert.equal(states.at(-1).rowCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
