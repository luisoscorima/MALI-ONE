import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { parseMalichimpContactsXlsx } from './malichimp-xlsx-import';

async function workbookBuffer(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Contactos');
  rows.forEach((values) => sheet.addRow(values));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('lee la plantilla aunque los encabezados no estén en la primera fila', async () => {
  const result = await parseMalichimpContactsXlsx(await workbookBuffer([
    ['Importación de contactos MALICHIMP'],
    ['Completa una fila por contacto.'],
    [],
    ['Correo', 'Nombres', 'Apellidos', 'Teléfono', 'Institución', 'Cargo', 'Ciudad', 'País', 'Clasificación'],
    [' ANA@EJEMPLO.COM ', 'Ana', 'Pérez', '999 111 222', 'MALI', 'Gestora', 'Lima', 'Perú', 'Prensa'],
    ['ana@ejemplo.com', 'Duplicada'],
    ['correo-invalido', 'Sin correo válido'],
  ]));

  assert.equal(result.sheetName, 'Contactos');
  assert.equal(result.headerRow, 4);
  assert.equal(result.totalRows, 3);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.duplicateRows, 1);
  assert.deepEqual(result.rows[0], {
    rowNumber: 5,
    email: 'ana@ejemplo.com',
    firstName: 'Ana',
    lastName: 'Pérez',
    phone: '999 111 222',
    institutionName: 'MALI',
    jobTitle: 'Gestora',
    city: 'Lima',
    country: 'Perú',
    classification: 'Prensa',
  });
});

test('acepta encabezados equivalentes y exige una columna de correo', async () => {
  const valid = await parseMalichimpContactsXlsx(await workbookBuffer([
    ['Email', 'First name', 'Last name', 'Organization'],
    ['persona@example.org', 'Luis', 'Paz', 'Museo'],
  ]));
  assert.equal(valid.rows[0].institutionName, 'Museo');

  await assert.rejects(
    parseMalichimpContactsXlsx(await workbookBuffer([
      ['Nombres', 'Apellidos'],
      ['Ana', 'Pérez'],
    ])),
    /columna Correo/i,
  );
});
