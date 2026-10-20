// Run after building shared and api. No database or external connections.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const apiRequire = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
apiRequire('reflect-metadata');
const { ValidationPipe } = apiRequire('@nestjs/common');
const { Reflector } = apiRequire('@nestjs/core');
const { Prisma } = apiRequire('@prisma/client');
const { TreasuryService } = apiRequire('./dist/modules/treasury/treasury.service');
const { TreasuryController } = apiRequire('./dist/modules/treasury/treasury.controller');
const { TreasurySourceInputDto, TreasuryTargetInputDto } = apiRequire('./dist/modules/treasury/dto/treasury.dto');
const { ModuleGuard } = apiRequire('./dist/core/guards/module.guard');

const actor = { id: 'test-user', email: 'qa@example.test' };
const source = { id: 'source-1', provider: 'bcp', name: 'Cuenta principal', legalEntity: 'Entidad de prueba', active: true };
const target = { name: 'Recaudación', reference: '001234', currency: 'PEN', active: true };
const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const validate = (metatype, value) => pipe.transform(value, { type: 'body', metatype });
const serviceFor = (tx) => new TreasuryService({ $transaction: (fn) => fn(tx) });

test('valida campos, conserva ceros iniciales y rechaza credenciales/activación enviada por el cliente', async () => {
  const result = await validate(TreasuryTargetInputDto, { ...target, name: ' Cuenta ', reference: ' 001abc ' });
  assert.equal(result.reference, '001ABC');
  assert.equal(result.name, 'Cuenta');
  for (const data of [
    { ...target, reference: 123 }, { ...target, currency: 'EUR' },
    { ...target, active: null }, { ...target, name: '   ' }, { ...target, reference: '12 34' },
    { ...target, sourceId: 'otra' }, { ...target, kind: 'merchant' },
  ]) await assert.rejects(() => validate(TreasuryTargetInputDto, data), (error) => error.getStatus() === 400);
  const input = { provider: 'bcp', name: 'BCP', legalEntity: 'Test', active: true };
  for (const data of [
    { ...input, provider: 'inventado' }, { ...input, password: 'not-a-real-secret' },
    { ...input, syncIntervalMinutes: 1 }, { ...input, connectorStatus: 'connected' },
  ]) await assert.rejects(() => validate(TreasurySourceInputDto, data), (error) => error.getStatus() === 400);
});

test('el permiso treasury es obligatorio para todos los endpoints del controlador', () => {
  const guard = new ModuleGuard(new Reflector());
  for (const method of ['overview', 'createSource', 'updateSource', 'createTarget', 'updateTarget']) {
    const context = (user) => ({
      getHandler: () => TreasuryController.prototype[method], getClass: () => TreasuryController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    });
    for (const user of [undefined, { role: 'operator', moduleAccess: [] }, { role: 'operator', moduleAccess: [{ module: 'files' }] }]) {
      assert.throws(() => guard.canActivate(context(user)), (error) => error.getStatus() === 403);
    }
    assert.equal(guard.canActivate(context({ role: 'operator', moduleAccess: [{ module: 'treasury' }] })), true);
  }
});

test('impide cambiar el portal de una fuente existente', async () => {
  const service = serviceFor({ treasurySource: {
    findUnique: async () => source, update: () => assert.fail('No debe reasignar la fuente'),
  } });
  await assert.rejects(() => service.saveSource(actor, { ...source, provider: 'niubiz_sales' }, source.id), /no se pueden cambiar/);
});

test('no permite editar una cuenta a través de otra fuente', async () => {
  let lookup;
  const service = serviceFor({
    treasurySource: { findUnique: async () => source },
    treasuryTarget: { findFirst: async (query) => { lookup = query; return null; }, update: () => assert.fail('No debe editar') },
  });
  await assert.rejects(() => service.saveTarget(actor, source.id, target, 'foreign-target'), (error) => error.getStatus() === 404);
  assert.deepEqual(lookup.where, { id: 'foreign-target', sourceId: source.id });
});

test('deriva el tipo del proveedor y audita dentro de la transacción sin copiar referencia', async () => {
  for (const [provider, kind] of [['bcp', 'bank_account'], ['niubiz_sales', 'merchant']]) {
    let saved;
    let audit;
    const service = serviceFor({
      treasurySource: { findUnique: async () => ({ ...source, provider }) },
      treasuryTarget: { create: async ({ data }) => { saved = data; return { ...data, id: 'target-1' }; } },
      adminAuditLog: { create: async ({ data }) => { audit = data; } },
    });
    await service.saveTarget(actor, source.id, target);
    assert.equal(saved.kind, kind);
    assert.equal(saved.reference, '001234');
    assert.equal(audit.actorId, actor.id);
    assert.equal(audit.payload.targetId, 'target-1');
    assert.ok(!JSON.stringify(audit).includes('001234'));
  }
});

test('devuelve conflicto recuperable si la base rechaza un duplicado', async () => {
  const service = serviceFor({
    treasurySource: { create: async () => { throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }); } },
  });
  await assert.rejects(() => service.saveSource(actor, source), (error) => error.getStatus() === 409);
});

test('un fallo de auditoría se propaga a la transacción y no anuncia éxito', async () => {
  const service = serviceFor({
    treasurySource: { create: async () => source },
    adminAuditLog: { create: async () => { throw new Error('audit failed'); } },
  });
  await assert.rejects(() => service.saveSource(actor, source), /audit failed/);
});

test('inventario vacío informa conectores pendientes, sin saldos ni sincronizaciones ficticias', async () => {
  const service = new TreasuryService({ treasurySource: { findMany: async () => [] } });
  const overview = await service.overview();
  assert.equal(overview.collectionEnabled, false);
  assert.equal(overview.syncIntervalMinutes, 60);
  assert.equal(overview.timezone, 'America/Lima');
  assert.deepEqual(overview.sources, []);
  assert.equal(overview.providers.length, 7);
});
