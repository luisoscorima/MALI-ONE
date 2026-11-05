import { Prisma } from '@prisma/client';

const DROP = new Set([
  'identification',
  'cardholder',
  'cardholdername',
  'firstsixdigits',
  'securitycode',
  'cvv',
  'cvc',
  'cvv2',
  'bin',
  'accesstoken',
  'refreshtoken',
  'password',
  'expirationmonth',
  'expirationyear',
]);

const CARD_STRING = new Set(['pan', 'tarjeta', 'nrotarjeta', 'numerodetarjeta', 'cardnumber', 'cardnum']);

const compact = (key: string) =>
  key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function redactCard(value: string, force: boolean) {
  const digits = value.replace(/\D/g, '');
  const masked = /[*•]/.test(value) && digits.length >= 4;
  const naked = force && digits.length >= 13 && digits.length <= 19 && value.replace(/[\s-]/g, '') === digits;
  return masked || naked ? `•••• ${digits.slice(-4)}` : value;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function walk(value: unknown): Json | undefined {
  if (typeof value === 'string') return redactCard(value, false);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => walk(item) ?? null);
  if (!value || typeof value !== 'object') return undefined;
  const out: { [key: string]: Json } = {};
  for (const [key, inner] of Object.entries(value)) {
    const name = compact(key);
    if (DROP.has(name)) continue;
    if (CARD_STRING.has(name) || (name === 'card' && (typeof inner === 'string' || typeof inner === 'number'))) {
      out[key] = redactCard(String(inner ?? ''), true);
      continue;
    }
    const next = walk(inner);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

/** Portal sale kept beside the columns. Card numbers and payer identity documents are removed. */
export function sanitizePaymentPayload(value: unknown): Prisma.InputJsonObject {
  const clean = walk(value);
  return clean && typeof clean === 'object' && !Array.isArray(clean) ? clean : {};
}

export function samePaymentPayload(left: unknown, right: unknown) {
  return JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = sortKeys((value as Record<string, unknown>)[key]);
    return acc;
  }, {});
}
