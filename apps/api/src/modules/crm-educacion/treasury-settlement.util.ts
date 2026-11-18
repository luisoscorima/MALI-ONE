/**
 * Clasifica el estado de un cobro Treasury para la política de asociación:
 * - positive: liquidado/pagado → asociar + cerrar ciclo
 * - authorized: Autorizada/processing → asociar + cerrar ciclo + obs (Caja valida liquidación)
 * - in_progress: Por pagar / pending / mediation → asociar + obs, sin cerrar
 * - negative: rechazo/anulación → no asociar como pago
 */

export type TreasurySettlementKind =
  | 'positive'
  | 'authorized'
  | 'in_progress'
  | 'negative'
  | 'unknown';

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

/** Autorización capturada / en liquidación: cierra ciclo comercial; Caja confirma. */
const AUTHORIZED = new Set([
  'autorizada',
  'authorized',
  'processing',
  'in_process',
  'inprocess',
]);

/** Orden emitida o en disputa: se puede asociar, pero el ciclo no cierra. */
const IN_PROGRESS = new Set([
  'por_pagar',
  'pending',
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
  if (AUTHORIZED.has(key)) return 'authorized';
  if (IN_PROGRESS.has(key)) return 'in_progress';
  if (NEGATIVE.has(key)) return 'negative';
  return 'unknown';
}

/** Ciclo WA puede cerrar: liquidado o Autorizada/processing. */
export function settlementClosesCycle(kind: TreasurySettlementKind): boolean {
  return kind === 'positive' || kind === 'authorized';
}

/** Obs para Caja: todo lo que no esté liquidado/pagado. */
export function settlementNeedsConfirmationNote(kind: TreasurySettlementKind): boolean {
  return kind !== 'positive' && kind !== 'negative';
}

export function settlementKindLabel(kind: TreasurySettlementKind): string {
  if (kind === 'positive') return 'Cobro confirmado';
  if (kind === 'authorized') return 'Autorizado (pendiente liquidación)';
  if (kind === 'in_progress') return 'En proceso';
  if (kind === 'negative') return 'No asociable';
  return 'Estado desconocido';
}
