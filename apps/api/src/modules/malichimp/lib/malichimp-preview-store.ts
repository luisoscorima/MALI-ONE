import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MalichimpImportReport, MalichimpLocatedFile } from './malichimp-import-runner';
import type { MalichimpXlsxContactRow } from './malichimp-xlsx-import';

export const ZIP_PREVIEW_PREFIX = 'mali-one-malichimp-';
export const XLSX_PREVIEW_PREFIX = 'mali-one-malichimp-xlsx-';
export const PREVIEW_TTL_MS = 30 * 60 * 1000;

export type StoredZipPreview = {
  id: string;
  userId: string;
  originalName: string;
  directory: string;
  files: MalichimpLocatedFile[];
  report: MalichimpImportReport;
  expiresAt: Date;
};

export type StoredXlsxPreview = {
  id: string;
  userId: string;
  originalName: string;
  directory: string;
  rows: MalichimpXlsxContactRow[];
  groupOptionIds: string[];
  groupOptions: Array<{ id: string; name: string; groupName: string }>;
  report: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    importableContacts: number;
    newContacts: number;
    existingContacts: number;
    blockedContacts: number;
    errors: string[];
    sample: Array<{
      rowNumber: number;
      email: string;
      name: string | null;
      action: 'create' | 'update' | 'blocked';
    }>;
  };
  fingerprint: string;
  consentConfirmedAt: string;
  consentConfirmedBy: string;
  expiresAt: Date;
};

type ZipMetaFile = {
  id: string;
  userId: string;
  originalName: string;
  files: Array<{ relativePath: string; status: MalichimpLocatedFile['status'] }>;
  report: MalichimpImportReport;
  expiresAt: string;
};

type XlsxMetaFile = Omit<StoredXlsxPreview, 'rows' | 'directory' | 'expiresAt'> & {
  expiresAt: string;
};

export function newPreviewId(): string {
  return randomUUID();
}

export function fingerprintBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function zipPreviewDirectory(previewId: string): string {
  return path.join(tmpdir(), `${ZIP_PREVIEW_PREFIX}${previewId}`);
}

export function xlsxPreviewDirectory(previewId: string): string {
  return path.join(tmpdir(), `${XLSX_PREVIEW_PREFIX}${previewId}`);
}

export async function writeZipPreview(preview: StoredZipPreview): Promise<void> {
  const meta: ZipMetaFile = {
    id: preview.id,
    userId: preview.userId,
    originalName: preview.originalName,
    files: preview.files.map((file) => ({
      relativePath: path.relative(preview.directory, file.filePath),
      status: file.status,
    })),
    report: preview.report,
    expiresAt: preview.expiresAt.toISOString(),
  };
  await writeFile(
    path.join(preview.directory, 'preview-meta.json'),
    JSON.stringify(meta),
    'utf8',
  );
}

export async function readZipPreview(previewId: string): Promise<StoredZipPreview | null> {
  const directory = zipPreviewDirectory(previewId);
  try {
    const raw = await readFile(path.join(directory, 'preview-meta.json'), 'utf8');
    const meta = JSON.parse(raw) as ZipMetaFile;
    const expiresAt = new Date(meta.expiresAt);
    if (!meta.id || meta.id !== previewId || Number.isNaN(expiresAt.getTime())) return null;
    if (expiresAt.getTime() <= Date.now()) {
      await rm(directory, { recursive: true, force: true });
      return null;
    }
    return {
      id: meta.id,
      userId: meta.userId,
      originalName: meta.originalName,
      directory,
      files: meta.files.map((file) => ({
        filePath: path.join(directory, file.relativePath),
        status: file.status,
      })),
      report: meta.report,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export async function writeXlsxPreview(preview: StoredXlsxPreview): Promise<void> {
  await mkdir(preview.directory, { recursive: true });
  const meta: XlsxMetaFile = {
    id: preview.id,
    userId: preview.userId,
    originalName: preview.originalName,
    groupOptionIds: preview.groupOptionIds,
    groupOptions: preview.groupOptions,
    report: preview.report,
    fingerprint: preview.fingerprint,
    consentConfirmedAt: preview.consentConfirmedAt,
    consentConfirmedBy: preview.consentConfirmedBy,
    expiresAt: preview.expiresAt.toISOString(),
  };
  await writeFile(path.join(preview.directory, 'preview-meta.json'), JSON.stringify(meta), 'utf8');
  await writeFile(path.join(preview.directory, 'rows.json'), JSON.stringify(preview.rows), 'utf8');
}

export async function readXlsxPreview(previewId: string): Promise<StoredXlsxPreview | null> {
  const directory = xlsxPreviewDirectory(previewId);
  try {
    const [metaRaw, rowsRaw] = await Promise.all([
      readFile(path.join(directory, 'preview-meta.json'), 'utf8'),
      readFile(path.join(directory, 'rows.json'), 'utf8'),
    ]);
    const meta = JSON.parse(metaRaw) as XlsxMetaFile;
    const rows = JSON.parse(rowsRaw) as MalichimpXlsxContactRow[];
    const expiresAt = new Date(meta.expiresAt);
    if (!meta.id || meta.id !== previewId || Number.isNaN(expiresAt.getTime())) return null;
    if (expiresAt.getTime() <= Date.now()) {
      await rm(directory, { recursive: true, force: true });
      return null;
    }
    if (!Array.isArray(rows)) return null;
    return {
      ...meta,
      directory,
      rows,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export async function removePreviewDirectory(directory: string | null | undefined): Promise<void> {
  if (!directory) return;
  await rm(directory, { recursive: true, force: true });
}
