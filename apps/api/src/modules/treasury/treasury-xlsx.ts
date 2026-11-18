import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export const TREASURY_EXPORT_MAX_ROWS = 20_000;

export type XlsxColumn = { key: string; header: string; width?: number };

export function assertExportSize(total: number) {
  if (total > TREASURY_EXPORT_MAX_ROWS) {
    throw new BadRequestException(
      `El export supera ${TREASURY_EXPORT_MAX_ROWS} filas. Acota el rango o los filtros.`,
    );
  }
}

export function limaStamp(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function limaDateOnly(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function exportFilename(prefix: string, from?: string, to?: string) {
  const range =
    from && to ? `${from}_${to}` : from ? `desde-${from}` : to ? `hasta-${to}` : 'todas';
  return `${prefix}_${range}.xlsx`;
}

export async function buildTreasuryXlsx(
  sheetName: string,
  columns: XlsxColumn[],
  rows: Record<string, string | number | null | undefined>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MALI ONE';
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.max(12, column.header.length + 2),
  }));
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.getRow(1).font = { bold: true };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
