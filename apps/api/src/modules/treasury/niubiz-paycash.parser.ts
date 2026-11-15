import { TreasuryCurrency } from '@prisma/client';

export const PAYCASH_MERCHANT = '650177853';

export type PayCashRow = {
  merchantCode: string;
  cip: string;
  customerEmail: string | null;
  currency: TreasuryCurrency;
  amount: string;
  brand: string;
  purchasedAt: Date;
  paidAt: Date | null;
  status: string;
};

const fields = ['Código CIP', 'Cliente', 'Moneda', 'Importe Pedido', 'Marca', 'Fecha de Compra', 'Fecha de Pago', 'Estado'] as const;
const statuses = new Set(['Por pagar', 'Pagado', 'Expirado']);

function limaDate(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) throw new Error('API_DATA_MISMATCH');
  const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour}:${minute}:${second}-05:00`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) ||
      new Date(date.getTime() - 5 * 3600000).toISOString().slice(0, 10) !==
        `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`) throw new Error('API_DATA_MISMATCH');
  return date;
}

export function parsePayCashExport(raw: unknown, expectedCount: number): PayCashRow[] {
  if (!Array.isArray(raw) || !Number.isSafeInteger(expectedCount) || expectedCount < 0 ||
      expectedCount > 50000 || raw.length !== expectedCount) throw new Error('EXPORT_INCOMPLETE');
  const seen = new Set<string>();
  return raw.map((item): PayCashRow => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        fields.some(field => !(field in item))) throw new Error('API_SCHEMA_ERROR');
    const row = item as Record<string, unknown>;
    const value = (field: typeof fields[number]) => {
      const rawValue = row[field];
      return rawValue == null ? '' : String(rawValue).trim();
    };
    const cip = value('Código CIP');
    const currency = value('Moneda');
    const amount = value('Importe Pedido');
    const status = value('Estado');
    const brand = value('Marca');
    const email = value('Cliente');
    const purchasedAt = limaDate(value('Fecha de Compra'));
    const paidAt = limaDate(value('Fecha de Pago'));
    if (!/^\d{1,80}$/.test(cip) || seen.has(cip) || !['PEN', 'USD'].includes(currency) ||
        !/^\d{1,16}(?:\.\d{1,2})?$/.test(amount) || !statuses.has(status) ||
        !brand || brand.length > 80 || email.length > 250 || !purchasedAt ||
        (status === 'Pagado' && !paidAt)) throw new Error('API_DATA_MISMATCH');
    seen.add(cip);
    return { merchantCode: PAYCASH_MERCHANT, cip, customerEmail: email || null,
      currency: currency as TreasuryCurrency, amount, brand, purchasedAt, paidAt, status };
  });
}
