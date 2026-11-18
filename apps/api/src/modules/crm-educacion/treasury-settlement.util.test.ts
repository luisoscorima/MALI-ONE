import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyTreasurySettlementStatus,
  settlementClosesCycle,
  settlementNeedsConfirmationNote,
} from './treasury-settlement.util';

describe('classifyTreasurySettlementStatus', () => {
  it('marca Liquidada/Pagado como positive y cierra sin obs', () => {
    assert.equal(classifyTreasurySettlementStatus('Liquidada'), 'positive');
    assert.equal(classifyTreasurySettlementStatus('Pagado'), 'positive');
    assert.equal(settlementClosesCycle('positive'), true);
    assert.equal(settlementNeedsConfirmationNote('positive'), false);
  });

  it('marca Autorizada/processing como authorized: cierra con obs', () => {
    for (const status of ['Autorizada', 'authorized', 'Processing', 'In Process']) {
      const kind = classifyTreasurySettlementStatus(status);
      assert.equal(kind, 'authorized', status);
      assert.equal(settlementClosesCycle(kind), true, status);
      assert.equal(settlementNeedsConfirmationNote(kind), true, status);
    }
  });

  it('deja Por pagar/pending/mediation en in_progress: asocia sin cerrar', () => {
    for (const status of ['Por pagar', 'pending', 'action_required', 'in_mediation']) {
      const kind = classifyTreasurySettlementStatus(status);
      assert.equal(kind, 'in_progress', status);
      assert.equal(settlementClosesCycle(kind), false, status);
      assert.equal(settlementNeedsConfirmationNote(kind), true, status);
    }
  });

  it('rechaza negativos', () => {
    assert.equal(classifyTreasurySettlementStatus('Denegada'), 'negative');
    assert.equal(settlementClosesCycle('negative'), false);
  });
});
