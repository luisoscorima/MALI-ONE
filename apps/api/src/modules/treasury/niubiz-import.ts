import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { TreasuryCurrency } from '@prisma/client';

export type NiubizPayment = {
  merchantCode: string; merchantName: string; transactionCode: string;
  orderNumber: string; customerName: string; currency: TreasuryCurrency;
  amount: string; status: string; transactedAt: Date; settledOn: Date | null;
};
const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function niubizDate(value: string, dateOnly = false): Date {
  const match = (dateOnly ? /^(\d{2})\/(\d{2})\/(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/).exec(value);
  if (!match) throw new BadRequestException('Fecha de Niubiz inválida.');
  const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
  const stamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const utc = new Date(stamp + 'Z');
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 19) !== stamp) throw new BadRequestException('Fecha de Niubiz inexistente.');
  return dateOnly ? utc : new Date(stamp + '-05:00');
}

// Also accepts the object-per-row format of Niubiz's export:true API response.
export function parseNiubizRows(rows: Record<string, unknown>[]): NiubizPayment[] {
  if (!rows.length || rows.length > 5000) throw new BadRequestException('El lote debe contener entre 1 y 5000 operaciones.');
  const identities = new Set<string>();
  return rows.map((row, index) => {
    const data = new Map(Object.entries(row).map(([k, v]) => [normalized(k), v]));
    const field = (name: string, max: number, optional = false) => {
      const raw = data.get(normalized(name));
      if (raw != null && typeof raw !== 'string' && typeof raw !== 'number') throw new BadRequestException(`Fila ${index + 3}: campo ${name} inválido.`);
      const value = raw == null ? '' : String(raw).trim();
      if ((!optional && !value) || value.length > max) throw new BadRequestException(`Fila ${index + 3}: revisa ${name}.`);
      return value;
    };
    const merchantCode = field('Código de comercio', 64);
    const transactionCode = field('Código de transaccion', 100);
    if (!/^\d{9}$/.test(merchantCode) || !/^[A-Za-z0-9_-]+$/.test(transactionCode)) throw new BadRequestException(`Fila ${index + 3}: identificador inválido.`);
    const key = `${merchantCode}:${transactionCode}`;
    if (identities.has(key)) throw new BadRequestException(`Fila ${index + 3}: operación duplicada dentro del lote.`);
    identities.add(key);
    const currency = field('Moneda', 3);
    if (currency !== 'PEN' && currency !== 'USD') throw new BadRequestException(`Fila ${index + 3}: moneda no soportada.`);
    const amount = field('Importe Pedido', 20);
    if (!/^\d{1,16}(\.\d{1,2})?$/.test(amount)) throw new BadRequestException(`Fila ${index + 3}: importe inválido.`);
    const settled = field('Fecha de Liquidación', 10, true);
    return {
      merchantCode, transactionCode, currency,
      merchantName: field('Nombre de comercio', 200),
      orderNumber: field('Nro Pedido', 100), customerName: field('Cliente', 250, true),
      amount, status: field('Estado', 80),
      transactedAt: niubizDate(field('Fecha de Transacción', 19)),
      settledOn: settled ? niubizDate(settled, true) : null,
    };
  });
}

export async function readNiubizXlsx(buffer: Buffer): Promise<NiubizPayment[]> {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new BadRequestException('El Excel debe pesar hasta 5 MB.');
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as never); } catch { throw new BadRequestException('No se pudo leer el archivo XLSX.'); }
  const sheet = workbook.getWorksheet('sells');
  if (!sheet || sheet.rowCount > 5002 || sheet.columnCount > 100) throw new BadRequestException('Usa el exportado original de Ventas Niubiz, hoja sells, con hasta 5000 operaciones.');
  const headers: string[] = [];
  sheet.getRow(2).eachCell((cell, index) => { headers[index - 1] = cell.text.trim(); });
  if (new Set(headers.map(normalized)).size !== headers.length) throw new BadRequestException('El archivo contiene encabezados repetidos o vacíos.');
  const rows: Record<string, unknown>[] = [];
  for (let index = 3; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    if (!row.hasValues) continue;
    const record: Record<string, unknown> = {};
    headers.forEach((header, column) => { record[header] = row.getCell(column + 1).value; });
    rows.push(record);
  }
  return parseNiubizRows(rows);
}
