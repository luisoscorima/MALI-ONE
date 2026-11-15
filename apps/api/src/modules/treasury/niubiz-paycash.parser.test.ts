import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePayCashExport } from './niubiz-paycash.parser';

const row = {
  'Código CIP': '000436361425',
  Cliente: 'cliente@example.com',
  Moneda: 'PEN',
  'Importe Pedido': '340.00',
  Marca: 'PagoEfectivo',
  'Fecha de Compra': '11/11/2026 12:43:19',
  'Fecha de Pago': '11/11/2026 12:47:06',
  Estado: 'Pagado',
};

test('conserva CIP y fechas de Lima', () => {
  const [payment] = parsePayCashExport([row], 1);
  assert.equal(payment.cip, '000436361425');
  assert.equal(payment.purchasedAt.toISOString(), '2026-11-11T17:43:19.000Z');
  assert.equal(payment.paidAt?.toISOString(), '2026-11-11T17:47:06.000Z');
});

test('rechaza lotes incompletos, duplicados y cambios de esquema', () => {
  assert.throws(() => parsePayCashExport([row], 2), /EXPORT_INCOMPLETE/);
  assert.throws(() => parsePayCashExport([row, row], 2), /API_DATA_MISMATCH/);
  assert.throws(() => parsePayCashExport([{ ...row, Estado: undefined }], 1), /API_DATA_MISMATCH/);
  assert.throws(() => parsePayCashExport([{ ...row, 'Fecha de Compra': '31/11/2026 12:43:19' }], 1), /API_DATA_MISMATCH/);
  const { Estado: _status, ...missingStatus } = row;
  assert.throws(() => parsePayCashExport([missingStatus], 1), /API_SCHEMA_ERROR/);
});
