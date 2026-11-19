import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EducacionOpportunityService } from './educacion-opportunity.service';

function setup(existing: unknown[], candidates: unknown[]) {
  const updates: unknown[] = [];
  const queries: any[] = [];
  const tx = {
    $executeRaw: async () => 1,
    educacionOpportunity: {
      findMany: async (query: any) => { queries.push(query); return queries.length === 1 ? existing : candidates; },
      update: async (query: any) => { updates.push(query); return { ...candidates[0] as object, ...query.data }; },
    },
  };
  const service = new EducacionOpportunityService({ $transaction: async (fn: any) => fn(tx) } as never);
  // Keep these tests focused on persistence/binding; presentation is unrelated.
  (service as any).toListItem = (row: unknown) => row;
  return { service, updates, queries };
}

test('a repeated binding preserves the original record and timestamps', async () => {
  const f = setup([{ id: 'old', category: 'ca', waCycleId: 9, waContactId: 1 }], [{ id: 'new' }]);
  assert.equal((await f.service.linkCycle({ waCycleId: 9, waContactId: 1, category: 'ca' })).linked, true);
  assert.equal(f.queries.length, 1);
  assert.equal(f.updates.length, 0);
});

test('ambiguous interests and conflicting existing categories remain untouched', async () => {
  const f = setup([], [{ id: 'a' }, { id: 'b' }]);
  assert.equal((await f.service.linkCycle({ waCycleId: 9, phone: '51999000111' })).reason, 'ambiguous_match');
  assert.equal(f.updates.length, 0);
  const g = setup([{ id: 'a', category: 'ep' }], []);
  assert.equal((await g.service.linkCycle({ waCycleId: 9, category: 'ca' })).reason, 'existing_link_conflict');
  assert.equal(g.updates.length, 0);
});

test('new binding is scoped and does not overwrite stage, advisor, or another cycle', async () => {
  const f = setup([], [{ id: 'a', waContactId: null }]);
  assert.equal((await f.service.linkCycle({ waCycleId: 9, waContactId: 1, category: 'ca', phone: '51999000111' })).linked, true);
  assert.equal(f.queries[1].where.waCycleId, null);
  assert.equal(f.queries[1].where.category, 'ca');
  assert.deepEqual(f.updates, [{ where: { id: 'a' }, data: { waCycleId: 9, waContactId: 1 }, include: { person: true } }]);
});
