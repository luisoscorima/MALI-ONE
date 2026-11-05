/** Portal inventory only: connector availability must not be inferred from this list. */
export const TREASURY_PROVIDERS = [
  { id: 'bcp', label: 'BCP', entity: 'BCP', targetKind: 'bank_account', scope: 'Movimientos bancarios' },
  { id: 'niubiz_sales', label: 'Niubiz · Comercio', entity: 'Niubiz', targetKind: 'merchant', scope: 'Ventas' },
  { id: 'niubiz_settlements', label: 'Niubiz · En línea', entity: 'Niubiz', targetKind: 'merchant', scope: 'Liquidaciones y depósitos' },
  { id: 'diners', label: 'Diners Club', entity: 'Diners Club', targetKind: 'merchant', scope: 'Ventas y órdenes de pago' },
  { id: 'expressnet', label: 'American Express · Expressnet', entity: 'American Express', targetKind: 'merchant', scope: 'Depósitos' },
  { id: 'pagoefectivo', label: 'PagoEfectivo', entity: 'PagoEfectivo', targetKind: 'merchant', scope: 'Pagos y transferencias' },
  { id: 'mercadopago', label: 'Mercado Pago', entity: 'Mercado Pago', targetKind: 'merchant', scope: 'Cobros y liberaciones' },
] as const;

export type TreasuryProvider = (typeof TREASURY_PROVIDERS)[number]['id'];
export type TreasuryTargetKind = 'bank_account' | 'merchant';
export type TreasuryCurrency = 'PEN' | 'USD';

const VAULT_ITEM_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accepts a raw Vaultwarden item UUID or a vault web URL that contains `itemId=…`
 * (including hash routes like `#/vault?itemId=…`). Returns the UUID or null if empty.
 * Returns the trimmed input unchanged when it cannot be parsed (caller validates).
 */
export function parseVaultItemRef(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (VAULT_ITEM_UUID.test(trimmed)) return trimmed;

  const fromQuery = (query: string) => {
    const id = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query).get('itemId');
    return id && VAULT_ITEM_UUID.test(id) ? id : null;
  };

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://vault.local/${trimmed}`);
    const fromSearch = fromQuery(url.search);
    if (fromSearch) return fromSearch;
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const q = hash.indexOf('?');
    if (q >= 0) {
      const fromHash = fromQuery(hash.slice(q + 1));
      if (fromHash) return fromHash;
    }
  } catch {
    /* fall through */
  }

  const match = /(?:^|[?&#])itemId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
    trimmed,
  );
  return match?.[1] ?? trimmed;
}

export interface TreasuryPaymentDto {
  id: string;
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
  transactedAt: string;
  settledOn: string | null;
  updatedAt: string;
}

export interface TreasuryPaymentsDto {
  total: number;
  page: number;
  pageSize: number;
  lastImport: { createdAt: string; rowCount: number; origin: string } | null;
  merchants: { merchantCode: string; merchantName: string }[];
  states: string[];
  payments: TreasuryPaymentDto[];
}

export interface TreasurySourceInput {
  provider: TreasuryProvider;
  name: string;
  /** Omitted in UI: API fills from provider entity. */
  legalEntity?: string;
  /** Vaultwarden item UUID (pointer). Empty clears it. */
  vaultItemId?: string | null;
  active: boolean;
}

export interface TreasuryTargetInput {
  name: string;
  reference: string;
  currency: TreasuryCurrency;
  active: boolean;
}

export interface TreasuryTargetDto extends TreasuryTargetInput {
  id: string;
  sourceId: string;
  kind: TreasuryTargetKind;
}

export interface TreasurySourceDto {
  id: string;
  provider: TreasuryProvider;
  name: string;
  legalEntity: string;
  vaultItemId: string | null;
  active: boolean;
  syncIntervalMinutes: number;
  connectorStatus: 'pending';
  targets: TreasuryTargetDto[];
  createdAt: string;
  updatedAt: string;
}

export interface NiubizSyncStatusDto {
  configured: boolean;
  scheduled: boolean;
  merchantCount: number;
  lastRun: null | {
    runId: string | null; status: string; startedAt: string | null; finishedAt: string | null;
    fromDate: string | null; toDate: string | null; errorCode: string | null;
    results: { merchant: string; status: string; rows?: number; createdCount?: number; updatedCount?: number }[];
  };
}

export interface TreasuryOverviewDto {
  providers: typeof TREASURY_PROVIDERS;
  sources: TreasurySourceDto[];
  syncIntervalMinutes: 60;
  timezone: 'America/Lima';
  collectionEnabled: false;
}
