import assert from 'node:assert/strict';
import { test } from 'node:test';
import { niubizEmailFromRecord, parseNiubizRows } from './niubiz-import';

const base = {
  'Código de comercio': '651047392',
  'Nombre de comercio': 'ASOCIACION MUSEO DE ARTE DE LIMA',
  'Código de transaccion': '995263180627635',
  'Nro Pedido': '51150',
  Cliente: 'ALEJANDRA SOFIA OCANA',
  Moneda: 'PEN',
  'Importe Pedido': '15.00',
  Estado: 'Liquidada',
  'Fecha de Transacción': '14/11/2026 23:02:26',
  'Fecha de Liquidación': '15/11/2026',
};

test('lee Email tarjetahabiente del portal Niubiz', () => {
  const [payment] = parseNiubizRows([
    {
      ...base,
      'Email tarjetahabiente': 'ALEJANDRAOCANAMAGOALE07@GMAIL.COM',
    },
  ]);
  assert.equal(payment.customerEmail, 'ALEJANDRAOCANAMAGOALE07@GMAIL.COM');
});

test('recupera el email desde el payload guardado', () => {
  assert.equal(
    niubizEmailFromRecord({
      Cliente: 'ALEJANDRA SOFIA OCANA',
      'Email tarjetahabiente': 'ALEJANDRAOCANAMAGOALE07@GMAIL.COM',
    }),
    'ALEJANDRAOCANAMAGOALE07@GMAIL.COM',
  );
  assert.equal(niubizEmailFromRecord({ Correo: 'otro@mali.pe' }), 'otro@mali.pe');
  assert.equal(niubizEmailFromRecord({ Cliente: 'Sin correo' }), null);
});
