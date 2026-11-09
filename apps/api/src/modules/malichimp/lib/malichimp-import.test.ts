import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTags,
  cleanImportedText,
  decodeCsvBuffer,
  mapMailchimpRecord,
  normalizeEmail,
  parseCsvText,
  parseMailchimpDate,
  repairMojibake,
} from './malichimp-import';

test('parsea CSV con comas, comillas y saltos de línea', () => {
  const rows = parseCsvText('Email Address,TAGS,Note\r\n"ANA@MALI.PE","Socios, VIP","línea 1\nlínea 2"\r\n');
  assert.deepEqual(rows, [
    ['Email Address', 'TAGS', 'Note'],
    ['ANA@MALI.PE', 'Socios, VIP', 'línea 1\nlínea 2'],
  ]);
});

test('normaliza email y conserva la hora local de Lima', () => {
  assert.equal(normalizeEmail('  Persona@Ejemplo.COM '), 'persona@ejemplo.com');
  assert.equal(
    parseMailchimpDate('2026-11-06 09:30:00')?.toISOString(),
    '2026-11-06T14:30:00.000Z',
  );
});

test('mapea campos, etiquetas y una baja como supresión', () => {
  const row = mapMailchimpRecord(
    {
      'Email Address': ' Persona@Ejemplo.COM ',
      'First Name': 'Ana',
      'Last Name': 'Pérez',
      'Nombre de la Institución u Organización': 'MALI',
      TAGS: 'VIP, Socios, vip',
      UNSUB_REASON: 'User unsubscribed',
      UNSUB_TIME: '2026-11-05 10:00:00',
      Departamento: 'Lima',
    },
    'unsubscribed',
  );

  assert.equal(row.email, 'persona@ejemplo.com');
  assert.equal(row.institutionName, 'MALI');
  assert.deepEqual(row.tags.map((tag) => tag.normalizedName), ['vip', 'socios']);
  assert.deepEqual(row.attributes, { departamento: 'Lima' });
  assert.equal(row.suppression?.reason, 'mailchimp_unsubscribed');
});

test('un suscrito no genera una supresión', () => {
  const row = mapMailchimpRecord({ 'Email Address': 'ok@example.com' }, 'subscribed');
  assert.equal(row.suppression, null);
});

test('repara mojibake y descarta errores de Excel o texto irrecuperable', () => {
  assert.equal(repairMojibake('ExtensiÃ³n Profesional'), 'Extensión Profesional');
  assert.equal(repairMojibake('FORMACIÃ“N CULTURAL'), 'FORMACIÓN CULTURAL');
  assert.equal(cleanImportedText('#¡VALOR!'), null);
  assert.equal(cleanImportedText('#Â¡VALOR!'), null);
  assert.equal(cleanImportedText('???????? ????????'), null);
});

test('limpia comillas, repara y deduplica etiquetas del export de Mailchimp', () => {
  const tags = buildTags(
    '"FORMACIÓN CULTURAL","ExtensiónProfesional","ExtensiÃ³nProfesional","FORMACIÃ“N CULTURAL"',
  );
  assert.deepEqual(
    tags.map((tag) => tag.name),
    ['FORMACIÓN CULTURAL', 'ExtensiónProfesional'],
  );
});

test('acepta exports CSV antiguos codificados en Windows-1252', () => {
  const csv = decodeCsvBuffer(
    Buffer.from([
      ...Buffer.from('Email Address,First Name\r\nana@mali.pe,', 'ascii'),
      0xc1,
      ...Buffer.from('ngela\r\n', 'ascii'),
    ]),
  );
  assert.equal(csv, 'Email Address,First Name\r\nana@mali.pe,Ángela\r\n');
});
