import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fingerprintBuffer,
  newPreviewId,
  readXlsxPreview,
  removePreviewDirectory,
  writeXlsxPreview,
  xlsxPreviewDirectory,
} from './malichimp-preview-store';

test('persiste y recupera una vista previa XLSX desde disco', async () => {
  const id = newPreviewId();
  const directory = xlsxPreviewDirectory(id);
  const preview = {
    id,
    userId: 'user-1',
    originalName: 'contactos.xlsx',
    directory,
    rows: [{
      rowNumber: 2,
      email: 'ana@ejemplo.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      phone: null,
      institutionName: null,
      jobTitle: null,
      city: null,
      country: null,
      classification: null,
    }],
    groupOptionIds: ['option-1'],
    groupOptions: [{ id: 'option-1', name: 'Prensa', groupName: 'Área' }],
    report: {
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      importableContacts: 1,
      newContacts: 1,
      existingContacts: 0,
      blockedContacts: 0,
      errors: [],
      sample: [],
    },
    fingerprint: fingerprintBuffer(Buffer.from('demo')),
    consentConfirmedAt: new Date().toISOString(),
    consentConfirmedBy: 'user-1',
    expiresAt: new Date(Date.now() + 60_000),
  };

  try {
    await writeXlsxPreview(preview);
    const loaded = await readXlsxPreview(id);
    assert.ok(loaded);
    assert.equal(loaded?.userId, 'user-1');
    assert.equal(loaded?.rows[0]?.email, 'ana@ejemplo.com');
    assert.equal(loaded?.consentConfirmedBy, 'user-1');
    assert.equal(loaded?.fingerprint, preview.fingerprint);
  } finally {
    await removePreviewDirectory(directory);
  }
});
