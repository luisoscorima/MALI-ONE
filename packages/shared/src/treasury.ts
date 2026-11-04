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

export interface TreasuryPaymentsDto {
  total: number; page: number; pageSize: number;
  lastImport: { createdAt: string; rowCount: number; origin: string } | null;
  merchants: { merchantCode: string; merchantName: string }[];
  states: string[];
  payments: {
    id: string; merchantCode: string; merchantName: string; transactionCode: string;
    orderNumber: string; customerName: string; currency: TreasuryCurrency;
    amount: string; status: string; transactedAt: string; settledOn: string | null; updatedAt: string;
  }[];
}

export interface TreasurySourceInput {
  provider: TreasuryProvider;
  name: string;
  legalEntity: string;
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

export interface TreasurySourceDto extends TreasurySourceInput {
  id: string;
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
