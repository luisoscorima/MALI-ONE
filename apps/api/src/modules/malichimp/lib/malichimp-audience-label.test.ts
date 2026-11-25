import assert from 'node:assert/strict';
import test from 'node:test';
import { MALICHIMP_AUDIENCE_MODE } from './malichimp-audience-mode';
import { formatMalichimpAudienceLabel } from './malichimp-audience-label';

test('formatMalichimpAudienceLabel nombra los grupos elegidos', () => {
  assert.equal(
    formatMalichimpAudienceLabel({
      audienceMode: MALICHIMP_AUDIENCE_MODE.groups,
      included: ['Dirección: Consejo', 'Dirección: Gerencia'],
      recipientCount: 158,
    }),
    'Dirección: Consejo, Dirección: Gerencia',
  );
});

test('formatMalichimpAudienceLabel nombra la etiqueta elegida', () => {
  assert.equal(
    formatMalichimpAudienceLabel({
      audienceMode: MALICHIMP_AUDIENCE_MODE.tags,
      included: ['Aliados'],
      recipientCount: 12,
    }),
    'Aliados',
  );
});

test('formatMalichimpAudienceLabel usa el conteo cuando no hay grupo ni etiqueta', () => {
  assert.equal(
    formatMalichimpAudienceLabel({
      audienceMode: MALICHIMP_AUDIENCE_MODE.emails,
      included: ['a@mali.pe', 'b@mali.pe'],
      recipientCount: 2,
    }),
    '2 destinatarios',
  );
  assert.equal(
    formatMalichimpAudienceLabel({
      audienceMode: MALICHIMP_AUDIENCE_MODE.groups,
      included: [],
      recipientCount: 1,
    }),
    '1 destinatario',
  );
});
