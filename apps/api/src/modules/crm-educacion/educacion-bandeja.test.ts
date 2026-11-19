import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EducacionBandejaService } from './educacion-bandeja.service';

test('WA stage comes from the nested status, including non-default stages', async () => {
  const service = new EducacionBandejaService({} as never,
    { list: async () => ({ items: [] }) } as never,
    { cycles: async () => ({ items: [
      { id: 42, categoria: 'ca', lead_status: { slug: 'seguimiento' } },
      { id: 43, categoria: 'ep', lead_status: { slug: 'venta_exitosa' } },
    ] }) } as never);
  const result = await service.list({});
  assert.equal(result.items.find(row => row.wa_cycle_id === 42)?.stage_slug, 'seguimiento');
  assert.equal(result.items.find(row => row.wa_cycle_id === 43)?.stage_slug, 'venta_exitosa');
});
