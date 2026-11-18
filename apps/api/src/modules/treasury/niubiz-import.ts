import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { TreasuryCurrency } from '@prisma/client';

export type NiubizPayment = {
  merchantCode: string;
  merchantName: string;
  transactionCode: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  cardBrand: string | null;
  cardType: string | null;
  cardLastDigits: string | null;
  wallet: string | null;
  currency: TreasuryCurrency;
  amount: string;
  status: string;
  transactedAt: Date;
  settledOn: Date | null;
};

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function niubizDate(value: string, dateOnly = false): Date {
  const match = (dateOnly
    ? /^(\d{2})\/(\d{2})\/(\d{4})$/
    : /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
  ).exec(value);
  if (!match) throw new BadRequestException('Fecha de Niubiz inválida.');
  const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
  const stamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const utc = new Date(stamp + 'Z');
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 19) !== stamp) {
    throw new BadRequestException('Fecha de Niubiz inexistente.');
  }
  return dateOnly ? utc : new Date(stamp + '-05:00');
}

const EMAIL_FIELDS = [
  'Email tarjetahabiente',
  'Correo',
  'Email',
  'E-mail',
  'Correo electrónico',
];

function cellText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const value = String(raw).trim();
    return value || null;
  }
  if (typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  // ExcelJS hyperlink / rich text / formula result.
  if (typeof record.text === 'string' && record.text.trim()) return record.text.trim();
  if (typeof record.result === 'string' || typeof record.result === 'number') {
    const value = String(record.result).trim();
    if (value) return value;
  }
  if (Array.isArray(record.richText)) {
    const value = record.richText
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text ?? '') : ''))
      .join('')
      .trim();
    if (value) return value;
  }
  if (typeof record.hyperlink === 'string') {
    const link = record.hyperlink.replace(/^mailto:/i, '').trim();
    if (link) return link;
  }
  return null;
}

function optionalText(data: Map<string, unknown>, names: string[], max: number): string | null {
  for (const name of names) {
    const value = cellText(data.get(normalized(name)));
    if (!value) continue;
    return value.slice(0, max);
  }
  return null;
}

/** Reads the cardholder email from a Niubiz row or stored portal payload. */
export function niubizEmailFromRecord(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) return null;
  const data = new Map(Object.entries(record).map(([key, value]) => [normalized(key), value]));
  return optionalText(data, EMAIL_FIELDS, 250);
}

function maskedLastDigits(pan: string | null): string | null {
  if (!pan) return null;
  const digits = pan.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function detectWallet(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (!value) continue;
    const key = normalized(value);
    if (key.includes('yape')) return 'Yape';
    if (key.includes('plin')) return 'Plin';
  }
  return null;
}

// Also accepts the object-per-row format of Niubiz's export:true API response.
export function parseNiubizRows(rows: Record<string, unknown>[]): NiubizPayment[] {
  if (!rows.length || rows.length > 5000) {
    throw new BadRequestException('El lote debe contener entre 1 y 5000 operaciones.');
  }
  const identities = new Set<string>();
  return rows.map((row, index) => {
    const data = new Map(Object.entries(row).map(([k, v]) => [normalized(k), v]));
    const field = (name: string, max: number, optional = false) => {
      const raw = data.get(normalized(name));
      const value = cellText(raw) ?? '';
      if (raw != null && !value && typeof raw !== 'string' && typeof raw !== 'number') {
        throw new BadRequestException(`Fila ${index + 3}: campo ${name} inválido.`);
      }
      if ((!optional && !value) || value.length > max) {
        throw new BadRequestException(`Fila ${index + 3}: revisa ${name}.`);
      }
      return value;
    };
    const merchantCode = field('Código de comercio', 64);
    const transactionCode = field('Código de transaccion', 100);
    if (!/^\d{9}$/.test(merchantCode) || !/^[A-Za-z0-9_-]+$/.test(transactionCode)) {
      throw new BadRequestException(`Fila ${index + 3}: identificador inválido.`);
    }
    const key = `${merchantCode}:${transactionCode}`;
    if (identities.has(key)) {
      throw new BadRequestException(`Fila ${index + 3}: operación duplicada dentro del lote.`);
    }
    identities.add(key);
    const currency = field('Moneda', 3);
    if (currency !== 'PEN' && currency !== 'USD') {
      throw new BadRequestException(`Fila ${index + 3}: moneda no soportada.`);
    }
    const amount = field('Importe Pedido', 20);
    if (!/^\d{1,16}(\.\d{1,2})?$/.test(amount)) {
      throw new BadRequestException(`Fila ${index + 3}: importe inválido.`);
    }
    const settled = field('Fecha de Liquidación', 10, true);
    const customerEmail = optionalText(data, EMAIL_FIELDS, 250);
    const cardBrand = optionalText(data, ['Marca', 'Marca tarjeta', 'Brand'], 80);
    const cardType = optionalText(
      data,
      ['Producto', 'Tipo de producto', 'Tipo de tarjeta', 'Tipo tarjeta', 'Card Type'],
      80,
    );
    const panMasked = optionalText(data, ['PAN', 'Tarjeta', 'Nro Tarjeta', 'Número de tarjeta', 'Card'], 40);
    const cardLastDigits = maskedLastDigits(panMasked);
    const paymentMethod = optionalText(
      data,
      ['Medio de Pago', 'Medio de pago', 'Método de pago', 'Metodo de pago', 'Billetera', 'Canal'],
      80,
    );
    const wallet =
      detectWallet(paymentMethod, cardBrand, cardType) ??
      (paymentMethod && !cardBrand && !cardLastDigits ? paymentMethod.slice(0, 40) : null);

    return {
      merchantCode,
      transactionCode,
      currency,
      merchantName: field('Nombre de comercio', 200),
      orderNumber: field('Nro Pedido', 100),
      customerName: field('Cliente', 250, true),
      customerEmail,
      cardBrand: wallet && !cardLastDigits ? null : cardBrand,
      cardType: wallet && !cardLastDigits ? null : cardType,
      cardLastDigits,
      wallet,
      amount,
      status: field('Estado', 80),
      transactedAt: niubizDate(field('Fecha de Transacción', 19)),
      settledOn: settled ? niubizDate(settled, true) : null,
    };
  });
}

export async function readNiubizXlsx(buffer: Buffer): Promise<NiubizPayment[]> {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new BadRequestException('El Excel debe pesar hasta 5 MB.');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    throw new BadRequestException('No se pudo leer el archivo XLSX.');
  }
  const sheet = workbook.getWorksheet('sells');
  if (!sheet || sheet.rowCount > 5002 || sheet.columnCount > 100) {
    throw new BadRequestException(
      'Usa el exportado original de Ventas Niubiz, hoja sells, con hasta 5000 operaciones.',
    );
  }
  const headers: string[] = [];
  sheet.getRow(2).eachCell((cell, index) => {
    headers[index - 1] = cell.text.trim();
  });
  if (new Set(headers.map(normalized)).size !== headers.length) {
    throw new BadRequestException('El archivo contiene encabezados repetidos o vacíos.');
  }
  const rows: Record<string, unknown>[] = [];
  for (let index = 3; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    if (!row.hasValues) continue;
    const record: Record<string, unknown> = {};
    headers.forEach((header, column) => {
      const cell = row.getCell(column + 1);
      record[header] = cellText(cell.value) ?? cell.text?.trim() ?? cell.value;
    });
    rows.push(record);
  }
  return parseNiubizRows(rows);
}
