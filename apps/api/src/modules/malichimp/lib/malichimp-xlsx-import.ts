import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  cleanImportedText,
  isBasicEmail,
  normalizeEmail,
} from './malichimp-import';

export const MAX_XLSX_CONTACTS = 10_000;
export const MAX_XLSX_BYTES = 10 * 1024 * 1024;

export type MalichimpXlsxContactRow = {
  rowNumber: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  institutionName: string | null;
  jobTitle: string | null;
  city: string | null;
  country: string | null;
  classification: string | null;
};

export type MalichimpXlsxParseResult = {
  sheetName: string;
  headerRow: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errors: string[];
  rows: MalichimpXlsxContactRow[];
};

type ContactField = Exclude<keyof MalichimpXlsxContactRow, 'rowNumber'>;

const HEADER_ALIASES: Record<string, ContactField> = {
  correo: 'email',
  'correo electronico': 'email',
  email: 'email',
  'e mail': 'email',
  'email address': 'email',
  nombre: 'firstName',
  nombres: 'firstName',
  'first name': 'firstName',
  apellido: 'lastName',
  apellidos: 'lastName',
  'last name': 'lastName',
  telefono: 'phone',
  celular: 'phone',
  phone: 'phone',
  institucion: 'institutionName',
  organizacion: 'institutionName',
  organization: 'institutionName',
  empresa: 'institutionName',
  'institution name': 'institutionName',
  cargo: 'jobTitle',
  puesto: 'jobTitle',
  'job title': 'jobTitle',
  ciudad: 'city',
  city: 'city',
  pais: 'country',
  country: 'country',
  clasificacion: 'classification',
  classification: 'classification',
};

const FIELD_LIMITS: Record<ContactField, number> = {
  email: 320,
  firstName: 160,
  lastName: 160,
  phone: 80,
  institutionName: 300,
  jobTitle: 200,
  city: 160,
  country: 120,
  classification: 160,
};

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function mappedHeaders(row: ExcelJS.Row): Map<ContactField, number> {
  const mapped = new Map<ContactField, number>();
  row.eachCell({ includeEmpty: false }, (cell, column) => {
    const field = HEADER_ALIASES[normalizeHeader(cell.text)];
    if (!field) return;
    if (mapped.has(field)) {
      throw new BadRequestException(
        `La fila ${row.number} contiene dos columnas para ${cell.text.trim()}.`,
      );
    }
    mapped.set(field, column);
  });
  return mapped;
}

function findContactsSheet(workbook: ExcelJS.Workbook): {
  sheet: ExcelJS.Worksheet;
  headerRow: number;
  columns: Map<ContactField, number>;
} | null {
  for (const sheet of workbook.worksheets) {
    const lastCandidate = Math.min(sheet.rowCount, 20);
    for (let rowNumber = 1; rowNumber <= lastCandidate; rowNumber += 1) {
      const columns = mappedHeaders(sheet.getRow(rowNumber));
      if (columns.has('email')) return { sheet, headerRow: rowNumber, columns };
    }
  }
  return null;
}

function cellText(
  row: ExcelJS.Row,
  columns: Map<ContactField, number>,
  field: ContactField,
): string | null {
  const column = columns.get(field);
  if (!column) return null;
  return cleanImportedText(row.getCell(column).text, FIELD_LIMITS[field]);
}

export async function parseMalichimpContactsXlsx(
  buffer: Buffer,
): Promise<MalichimpXlsxParseResult> {
  if (!buffer.length || buffer.length > MAX_XLSX_BYTES) {
    throw new BadRequestException('El XLSX debe pesar hasta 10 MB.');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    throw new BadRequestException('No se pudo leer el archivo XLSX.');
  }

  const located = findContactsSheet(workbook);
  if (!located) {
    throw new BadRequestException(
      'No se encontró una columna Correo. Usa la plantilla descargable de MALICHIMP.',
    );
  }
  const { sheet, headerRow, columns } = located;
  if (sheet.columnCount > 100 || sheet.rowCount > 100_000) {
    throw new BadRequestException('El XLSX es demasiado grande para una importación manual.');
  }

  const rows: MalichimpXlsxContactRow[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let totalRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = [...columns.keys()].map((field) => cellText(row, columns, field));
    if (!values.some(Boolean)) continue;
    totalRows += 1;
    if (totalRows > MAX_XLSX_CONTACTS) {
      throw new BadRequestException(
        `El XLSX supera el máximo de ${MAX_XLSX_CONTACTS.toLocaleString('es-PE')} contactos por lote.`,
      );
    }

    const email = normalizeEmail(cellText(row, columns, 'email') ?? undefined);
    if (!email || !isBasicEmail(email) || email.length > FIELD_LIMITS.email) {
      invalidRows += 1;
      if (errors.length < 25) errors.push(`Fila ${rowNumber}: correo vacío o no válido.`);
      continue;
    }
    if (seen.has(email)) {
      duplicateRows += 1;
      if (errors.length < 25) errors.push(`Fila ${rowNumber}: ${email} está repetido en el archivo.`);
      continue;
    }
    seen.add(email);

    rows.push({
      rowNumber,
      email,
      firstName: cellText(row, columns, 'firstName'),
      lastName: cellText(row, columns, 'lastName'),
      phone: cellText(row, columns, 'phone'),
      institutionName: cellText(row, columns, 'institutionName'),
      jobTitle: cellText(row, columns, 'jobTitle'),
      city: cellText(row, columns, 'city'),
      country: cellText(row, columns, 'country'),
      classification: cellText(row, columns, 'classification'),
    });
  }

  if (!totalRows) {
    throw new BadRequestException('El XLSX no contiene contactos para importar.');
  }
  if (!rows.length) {
    throw new BadRequestException({
      message: 'El XLSX no contiene correos válidos para importar.',
      errors,
    });
  }

  return {
    sheetName: sheet.name,
    headerRow,
    totalRows,
    validRows: rows.length,
    invalidRows,
    duplicateRows,
    errors,
    rows,
  };
}
