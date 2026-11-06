import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  MalichimpContactStatus,
  MalichimpSuppressionReason,
} from '@prisma/client';

export type CsvRecord = Record<string, string>;

export type MalichimpRow = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  institutionName: string | null;
  jobTitle: string | null;
  city: string | null;
  country: string | null;
  classification: string | null;
  source: string | null;
  status: MalichimpContactStatus;
  optInAt: Date | null;
  confirmedAt: Date | null;
  statusChangedAt: Date | null;
  attributes: Record<string, string> | null;
  tags: Array<{ name: string; normalizedName: string }>;
  suppression: {
    reason: MalichimpSuppressionReason;
    occurredAt: Date | null;
    metadata: Record<string, string> | null;
  } | null;
};

export const IMPORT_FILES: Array<{
  prefix: string;
  status: MalichimpContactStatus;
}> = [
  { prefix: 'subscribed_email_audience_export_', status: 'subscribed' },
  { prefix: 'unsubscribed_email_audience_export_', status: 'unsubscribed' },
  { prefix: 'cleaned_email_audience_export_', status: 'cleaned' },
  { prefix: 'nonsubscribed_email_audience_export_', status: 'nonsubscribed' },
];

const ATTRIBUTE_FIELDS: Record<string, string> = {
  'Dirección y Gerencia': 'direccion_gerencia',
  Curadurías: 'curadurias',
  'Curaduría Educativa': 'curaduria_educativa',
  Prensa: 'prensa',
  Auditorio: 'auditorio',
  Marketing: 'marketing',
  'Educación-Talleres': 'educacion_talleres',
  Instituciones: 'instituciones',
  'Comunidad MALI': 'comunidad_mali',
  APOYO: 'apoyo',
  'Comunidad MALI Internacional': 'comunidad_mali_internacional',
  'Biblioteca y Archivo': 'biblioteca_archivo',
  'Me gustaría recibir información sobre:': 'intereses',
  'Institución Museal': 'institucion_museal',
  'Tipo de museo según colecciones': 'tipo_museo_colecciones',
  'Institución rectora': 'institucion_rectoria',
  'Tipo de Institución': 'tipo_institucion',
  'Tipo de museo según administración': 'tipo_museo_administracion',
  Departamento: 'departamento',
  Provincia: 'provincia',
  Distrito: 'distrito',
  Administración: 'administracion',
  'Tipo de membresía': 'tipo_membresia',
};

function clean(value: string | undefined, max = 500): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

export function normalizeEmail(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isBasicEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function normalizeTagName(value: string): string {
  return value.trim().normalize('NFC').toLocaleLowerCase('es-PE').slice(0, 200);
}

export function parseMailchimpDate(value: string | undefined): Date | null {
  const raw = clean(value, 40);
  if (!raw) return null;
  // Mailchimp exports the account-local timestamp without an offset. MALI uses Peru time.
  const parsed = new Date(`${raw.replace(' ', 'T')}-05:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }

  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}

export async function readCsvRecords(filePath: string): Promise<CsvRecord[]> {
  const rows = parseCsvText(await readFile(filePath, 'utf8'));
  const headers = rows.shift() ?? [];
  if (!headers.includes('Email Address')) {
    throw new Error(`${path.basename(filePath)} no contiene la columna Email Address`);
  }
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  );
}

function buildAttributes(record: CsvRecord): Record<string, string> | null {
  const attributes: Record<string, string> = {};
  for (const [source, target] of Object.entries(ATTRIBUTE_FIELDS)) {
    const value = clean(record[source], 500);
    if (value) attributes[target] = value;
  }
  return Object.keys(attributes).length ? attributes : null;
}

function buildTags(raw: string | undefined) {
  const unique = new Map<string, string>();
  for (const value of String(raw ?? '').split(',')) {
    const name = clean(value, 200);
    if (!name) continue;
    const normalizedName = normalizeTagName(name);
    if (normalizedName && !unique.has(normalizedName)) unique.set(normalizedName, name);
  }
  return [...unique].map(([normalizedName, name]) => ({ name, normalizedName }));
}

function suppressionFor(
  status: MalichimpContactStatus,
  record: CsvRecord,
): MalichimpRow['suppression'] {
  if (status === 'unsubscribed') {
    const metadata = Object.fromEntries(
      [
        ['reason', clean(record.UNSUB_REASON, 300)],
        ['reason_other', clean(record.UNSUB_REASON_OTHER, 500)],
        ['campaign', clean(record.UNSUB_CAMPAIGN_TITLE, 300)],
      ].filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    return {
      reason: 'mailchimp_unsubscribed',
      occurredAt: parseMailchimpDate(record.UNSUB_TIME),
      metadata: Object.keys(metadata).length ? metadata : null,
    };
  }
  if (status === 'cleaned') {
    const campaign = clean(record.CLEAN_CAMPAIGN_TITLE, 300);
    return {
      reason: 'mailchimp_cleaned',
      occurredAt: parseMailchimpDate(record.CLEAN_TIME),
      metadata: campaign ? { campaign } : null,
    };
  }
  return null;
}

export function mapMailchimpRecord(
  record: CsvRecord,
  status: MalichimpContactStatus,
): MalichimpRow {
  const email = normalizeEmail(record['Email Address']);
  return {
    email,
    firstName: clean(record['First Name'], 160),
    lastName: clean(record['Last Name'], 160),
    phone: clean(record['Phone Number'], 80),
    institutionName: clean(record['Nombre de la Institución u Organización'], 300),
    jobTitle: clean(record.Cargo, 200),
    city: clean(record.Ciudad, 160),
    country: clean(record['País'], 120),
    classification: clean(record['Clasificación'], 160),
    source: clean(record.SOURCE, 240),
    status,
    optInAt: parseMailchimpDate(record.OPTIN_TIME),
    confirmedAt: parseMailchimpDate(record.CONFIRM_TIME),
    statusChangedAt:
      parseMailchimpDate(record.LAST_CHANGED) ??
      parseMailchimpDate(record.UNSUB_TIME) ??
      parseMailchimpDate(record.CLEAN_TIME),
    attributes: buildAttributes(record),
    tags: buildTags(record.TAGS),
    suppression: suppressionFor(status, record),
  };
}

export async function fingerprintFiles(filePaths: string[]): Promise<string> {
  const hash = createHash('sha256');
  for (const filePath of [...filePaths].sort()) {
    hash.update(path.basename(filePath));
    hash.update(await readFile(filePath));
  }
  return hash.digest('hex');
}
