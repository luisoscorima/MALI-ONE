import * as XLSX from 'xlsx';
import { parseTagsInput } from '@/lib/parse-tags';

const MAX_ROWS = 100;

export interface ParsedUrlRow {
  url: string;
  customSlug?: string;
  tags?: string[];
}

export interface ParsedWhatsappRow {
  phone: string;
  text?: string;
  customSlug?: string;
  tags?: string[];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function cellValue(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function parseTagsCell(value: string): string[] | undefined {
  const tags = parseTagsInput(value.replace(/;/g, ','));
  return tags.length ? tags : undefined;
}

function sheetToRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  return raw.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      mapped[normalizeHeader(key)] = value;
    }
    return mapped;
  });
}

function isEmptyRow(row: Record<string, unknown>, requiredKeys: string[]): boolean {
  return requiredKeys.every((key) => !cellValue(row, key));
}

export function parseUrlExcel(buffer: ArrayBuffer):
  | { ok: true; items: ParsedUrlRow[] }
  | { ok: false; error: string } {
  const rows = sheetToRows(buffer).filter(
    (row) => !isEmptyRow(row, ['url', 'enlace', 'link']),
  );

  if (rows.length === 0) {
    return { ok: false, error: 'El Excel no contiene filas con URL.' };
  }
  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `Máximo ${MAX_ROWS} filas por importación.`,
    };
  }

  const items: ParsedUrlRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const url = cellValue(row, 'url', 'enlace', 'link');
    if (!url) {
      return {
        ok: false,
        error: `Fila ${i + 2}: falta la columna "url".`,
      };
    }

    const slug = cellValue(row, 'slug', 'enlace_corto') || undefined;
    const tagsRaw = cellValue(row, 'tags', 'etiquetas', 'tag');
    items.push({
      url,
      customSlug: slug,
      tags: tagsRaw ? parseTagsCell(tagsRaw) : undefined,
    });
  }

  return { ok: true, items };
}

export function parseWhatsappExcel(buffer: ArrayBuffer):
  | { ok: true; items: ParsedWhatsappRow[] }
  | { ok: false; error: string } {
  const rows = sheetToRows(buffer).filter(
    (row) =>
      !isEmptyRow(row, [
        'telefono',
        'phone',
        'numero',
        'celular',
        'whatsapp',
      ]),
  );

  if (rows.length === 0) {
    return {
      ok: false,
      error: 'El Excel no contiene filas con teléfono.',
    };
  }
  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `Máximo ${MAX_ROWS} filas por importación.`,
    };
  }

  const items: ParsedWhatsappRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const phone = cellValue(
      row,
      'telefono',
      'phone',
      'numero',
      'celular',
      'whatsapp',
    );
    if (!phone) {
      return {
        ok: false,
        error: `Fila ${i + 2}: falta la columna "telefono".`,
      };
    }

    const text =
      cellValue(row, 'mensaje', 'text', 'texto', 'message') || undefined;
    const slug = cellValue(row, 'slug') || undefined;
    const tagsRaw = cellValue(row, 'tags', 'etiquetas', 'tag');
    items.push({
      phone,
      text,
      customSlug: slug,
      tags: tagsRaw ? parseTagsCell(tagsRaw) : undefined,
    });
  }

  return { ok: true, items };
}
