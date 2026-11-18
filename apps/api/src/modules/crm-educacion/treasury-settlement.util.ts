/**
 * Clasifica el estado de un cobro Treasury para la política de asociación:
 * - positive: respaldo de cobro → asociar + cerrar ciclo
 * - in_progress: código válido pero no liquidado → asociar + obs, sin cerrar
 * - negative: rechazo/anulación → no asociar como pago
 */

export type TreasurySettlementKind = 'positive' | 'in_progress' | 'negative' | 'unknown';

function normalizeStatus(status?: string | null): string {
  return String(status ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const POSITIVE = new Set([
  'liquidada',
  'pagado',
  'paid',
  'approved',
  'accredited',
  'success',
  'successful',
  'completed',
  'complete',
]);

const IN_PROGRESS = new Set([
  'autorizada',
  'por_pagar',
  'pending',
  'in_process',
  'inprocess',
  'authorized',
  'processing',
  'action_required',
  'in_mediation',
]);

const NEGATIVE = new Set([
  'anulada',
  'denegada',
  'expirado',
  'expired',
  'rejected',
  'cancelled',
  'canceled',
  'refunded',
  'charged_back',
  'chargedback',
  'failed',
  'denied',
  'voided',
]);

export function classifyTreasurySettlementStatus(
  status?: string | null,
): TreasurySettlementKind {
  const key = normalizeStatus(status);
  if (!key) return 'unknown';
  if (POSITIVE.has(key)) return 'positive';
  if (IN_PROGRESS.has(key)) return 'in_progress';
  if (NEGATIVE.has(key)) return 'negative';
  return 'unknown';
}

export function settlementKindLabel(kind: TreasurySettlementKind): string {
  if (kind === 'positive') return 'Cobro confirmado';
  if (kind === 'in_progress') return 'En proceso';
  if (kind === 'negative') return 'No asociable';
  return 'Estado desconocido';
}
