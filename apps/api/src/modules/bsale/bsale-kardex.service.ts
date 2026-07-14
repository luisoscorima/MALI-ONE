import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  BsaleKardexMovementDto,
  BsaleKardexResultDto,
  BsaleOfficeDto,
} from '@mali-one/shared';
import {
  BsaleClientService,
  dateToUnixEnd,
  dateToUnixStart,
  monthRanges,
  unixToIsoDate,
} from './bsale-client.service';

const MAX_RANGE_MONTHS = 12;

type RawOffice = {
  id: number;
  name?: string;
  address?: string;
  isVirtual?: number | boolean;
  state?: number;
};

type RawDocumentType = {
  id: number;
  name?: string;
  codeSii?: string | number;
  useStock?: number | boolean;
  isCreditNote?: number | boolean;
};

type RawVariant = {
  id?: number | string;
  description?: string;
  code?: string;
  product?: {
    id?: number | string;
    name?: string;
    description?: string;
  };
};

type VariantInfo = {
  sku: string;
  productName: string;
};

type RawDetail = {
  id?: number;
  quantity?: number;
  cost?: number;
  netUnitValue?: number;
  variant?: RawVariant;
};

type RawDocument = {
  id: number;
  emissionDate?: number;
  number?: number | string;
  state?: number;
  office?: { id?: number | string };
  document_type?: { id?: number | string; name?: string };
  details?: { items?: RawDetail[] } | RawDetail[];
};

type RawReception = {
  id: number;
  admissionDate?: number;
  document?: string;
  documentNumber?: string | number;
  note?: string;
  office?: { id?: number | string };
  details?: { items?: RawDetail[] } | RawDetail[];
};

type RawConsumption = {
  id: number;
  consumptionDate?: number;
  note?: string;
  office?: { id?: number | string };
  details?: { items?: RawDetail[] } | RawDetail[];
};

type RawStock = {
  quantity?: number;
  quantityAvailable?: number;
  variant?: RawVariant;
  office?: { id?: number | string };
};

type PendingMovement = Omit<BsaleKardexMovementDto, 'balanceQty'>;

type CostState = {
  qty: number;
  avg: number;
};

function balanceKey(variantId: number, officeId: number): string {
  return `${variantId}:${officeId}`;
}

const MOVEMENT_SORT_ORDER: Record<PendingMovement['movementType'], number> = {
  opening: 0,
  document: 1,
  transfer: 2,
  consumption: 3,
  reception: 4,
};

function sortKardexRows(a: PendingMovement, b: PendingMovement): number {
  // Vista: SKU → fecha → almacén → tipo
  const skuA = (a.sku || `\uffff${a.variantId}`).localeCompare(
    b.sku || `\uffff${b.variantId}`,
    'es',
    { sensitivity: 'base', numeric: true },
  );
  if (skuA !== 0) return skuA;
  if (a.variantId !== b.variantId) return a.variantId - b.variantId;
  if (a.date !== b.date) return a.date - b.date;
  if (a.officeId !== b.officeId) return a.officeId - b.officeId;
  const orderA = MOVEMENT_SORT_ORDER[a.movementType] ?? 99;
  const orderB = MOVEMENT_SORT_ORDER[b.movementType] ?? 99;
  if (orderA !== orderB) return orderA - orderB;
  // Salidas antes que entradas el mismo día
  if (a.exitQty !== b.exitQty) return b.exitQty - a.exitQty;
  return (a.documentId ?? 0) - (b.documentId ?? 0);
}

function isInternalDispatchLabel(label: string): boolean {
  const normalized = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return (
    normalized.includes('despacho interno') ||
    normalized.includes('traslado interno') ||
    normalized.includes('guia de traslado') ||
    normalized.includes('guia traslado')
  );
}

@Injectable()
export class BsaleKardexService {
  private readonly logger = new Logger(BsaleKardexService.name);
  private readonly resultCache = new Map<
    string,
    { at: number; data: BsaleKardexResultDto }
  >();
  private readonly inflight = new Map<string, Promise<BsaleKardexResultDto>>();
  private readonly cacheTtlMs = 10 * 60 * 1000;

  constructor(private readonly client: BsaleClientService) {}

  async listOffices(): Promise<BsaleOfficeDto[]> {
    const items = await this.client.getAllPages<RawOffice>('/v1/offices.json', {
      state: 0,
    });
    return items.map((o) => ({
      id: Number(o.id),
      name: o.name ?? `Oficina ${o.id}`,
      address: o.address ?? '',
      isVirtual: Boolean(o.isVirtual),
      state: Number(o.state ?? 0),
    }));
  }

  async buildKardex(params: {
    from: string;
    to: string;
    officeIds?: number[];
  }): Promise<BsaleKardexResultDto> {
    this.validateRange(params.from, params.to);
    const cacheKey = this.cacheKey(params);
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      this.logger.log(`Kardex cache hit (${cacheKey})`);
      return cached.data;
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      this.logger.log(`Kardex reutiliza request en curso (${cacheKey})`);
      return existing;
    }

    const promise = this.buildKardexUncached(params)
      .then((data) => {
        this.resultCache.set(cacheKey, { at: Date.now(), data });
        return data;
      })
      .finally(() => {
        this.inflight.delete(cacheKey);
      });
    this.inflight.set(cacheKey, promise);
    return promise;
  }

  private cacheKey(params: {
    from: string;
    to: string;
    officeIds?: number[];
  }): string {
    const offices = [...(params.officeIds ?? [])].sort((a, b) => a - b);
    return `${params.from}|${params.to}|${offices.join(',') || 'all'}`;
  }

  private async buildKardexUncached(params: {
    from: string;
    to: string;
    officeIds?: number[];
  }): Promise<BsaleKardexResultDto> {
    const fromTs = dateToUnixStart(params.from);
    const toTs = dateToUnixEnd(params.to);
    const todayIso = new Date().toISOString().slice(0, 10);
    // Para saldo inicial: stock_hoy - movimientos[from..hoy]
    const reverseToIso = todayIso > params.to ? todayIso : params.to;
    const reverseToTs = dateToUnixEnd(reverseToIso);

    const allOffices = await this.listOffices();
    const officeMap = new Map(allOffices.map((o) => [o.id, o]));
    const selectedIds =
      params.officeIds && params.officeIds.length > 0
        ? params.officeIds.filter((id) => officeMap.has(id))
        : allOffices.map((o) => o.id);

    if (selectedIds.length === 0) {
      throw new BadRequestException(
        'No hay almacenes válidos para consultar.',
      );
    }

    const documentTypes = await this.loadDocumentTypes();
    const variantCache = new Map<number, VariantInfo>();
    await this.prefetchVariants(variantCache);

    const sinceFrom: PendingMovement[] = [];

    for (const officeId of selectedIds) {
      const officeName = officeMap.get(officeId)?.name ?? `Oficina ${officeId}`;
      this.logger.log(
        `Kardex oficina ${officeId} (${officeName}) ${params.from}→${reverseToIso}`,
      );

      sinceFrom.push(
        ...(await this.collectDocuments(
          officeId,
          officeName,
          params.from,
          reverseToIso,
          documentTypes,
          variantCache,
        )),
      );
      sinceFrom.push(
        ...(await this.collectReceptions(
          officeId,
          officeName,
          fromTs,
          reverseToTs,
          variantCache,
        )),
      );
      sinceFrom.push(
        ...(await this.collectConsumptions(
          officeId,
          officeName,
          fromTs,
          reverseToTs,
          variantCache,
        )),
      );
    }

    await this.enrichVariantFields(sinceFrom, variantCache);
    this.tagInternalTransfers(sinceFrom);

    // En salidas no usar precio de documento: el costo lo calcula el promedio ponderado
    // (el unitCost de la API en recepciones/traslados de entrada se conserva).
    for (const row of sinceFrom) {
      if (row.exitQty > 0) row.unitCost = null;
    }

    const periodRows = sinceFrom.filter((row) => row.date <= toTs);
    const stocksByKey = await this.loadStocksByOffice(
      selectedIds,
      variantCache,
    );

    const netSinceFrom = new Map<string, number>();
    for (const row of sinceFrom) {
      const key = balanceKey(row.variantId, row.officeId);
      netSinceFrom.set(
        key,
        (netSinceFrom.get(key) ?? 0) + row.entryQty - row.exitQty,
      );
    }

    const periodKeys = new Set(
      periodRows.map((row) => balanceKey(row.variantId, row.officeId)),
    );
    const periodVariantIds = [
      ...new Set(
        [...periodKeys].map((key) => Number(key.split(':')[0])),
      ),
    ];
    const currentAvgByVariant =
      await this.loadVariantAverageCosts(periodVariantIds);

    const openingQtyByKey = new Map<string, number>();
    const openingAvgByKey = new Map<string, number>();
    for (const key of periodKeys) {
      const [variantIdRaw, officeIdRaw] = key.split(':');
      const variantId = Number(variantIdRaw);
      const officeId = Number(officeIdRaw);
      const stockNow = stocksByKey.get(key) ?? 0;
      const openingQty = stockNow - (netSinceFrom.get(key) ?? 0);
      openingQtyByKey.set(key, openingQty);

      const officeMoves = sinceFrom
        .filter(
          (row) => row.variantId === variantId && row.officeId === officeId,
        )
        .sort((a, b) => -sortKardexRows(a, b));

      const openingAvg = this.reverseOpeningAverage(
        stockNow,
        currentAvgByVariant.get(variantId) ?? 0,
        officeMoves,
      );
      openingAvgByKey.set(key, openingAvg);
    }

    const openings: PendingMovement[] = [];
    for (const key of periodKeys) {
      const [variantIdRaw, officeIdRaw] = key.split(':');
      const variantId = Number(variantIdRaw);
      const officeId = Number(officeIdRaw);
      const sample = periodRows.find(
        (row) => row.variantId === variantId && row.officeId === officeId,
      );
      const info = variantCache.get(variantId);
      openings.push({
        date: fromTs,
        dateIso: params.from,
        officeId,
        officeName:
          officeMap.get(officeId)?.name ??
          sample?.officeName ??
          `Oficina ${officeId}`,
        movementType: 'opening',
        documentLabel: 'Saldo inicial',
        documentNumber: '',
        documentId: null,
        variantId,
        sku: info?.sku || sample?.sku || '',
        productName: info?.productName || sample?.productName || '',
        entryQty: 0,
        exitQty: 0,
        unitCost: openingAvgByKey.get(key) ?? null,
      });
    }

    const pending: PendingMovement[] = [...openings, ...periodRows];
    pending.sort(sortKardexRows);
    this.applyWeightedAverageCosts(pending, openingQtyByKey, openingAvgByKey);

    const balances = new Map<string, number>();
    const movements: BsaleKardexMovementDto[] = pending.map((row) => {
      const key = balanceKey(row.variantId, row.officeId);
      if (row.movementType === 'opening') {
        const openingQty = openingQtyByKey.get(key) ?? 0;
        balances.set(key, openingQty);
        return { ...row, balanceQty: openingQty };
      }
      const prev = balances.get(key) ?? 0;
      const next = prev + row.entryQty - row.exitQty;
      balances.set(key, next);
      return { ...row, balanceQty: next };
    });

    return {
      from: params.from,
      to: params.to,
      officeIds: selectedIds,
      totalMovements: movements.length,
      movements,
    };
  }

  private async loadStocksByOffice(
    officeIds: number[],
    variantCache: Map<number, VariantInfo>,
  ): Promise<Map<string, number>> {
    const stocks = new Map<string, number>();
    for (const officeId of officeIds) {
      const items = await this.client.getAllPages<RawStock>('/v1/stocks.json', {
        officeid: officeId,
        expand: 'variant',
      });
      for (const item of items) {
        const variantId = Number(item.variant?.id ?? 0);
        if (!variantId) continue;
        this.rememberVariant(variantCache, item.variant);
        stocks.set(
          balanceKey(variantId, officeId),
          Number(item.quantity ?? 0),
        );
      }
    }
    return stocks;
  }

  private async loadVariantAverageCosts(
    variantIds: number[],
  ): Promise<Map<number, number>> {
    const averages = new Map<number, number>();
    const concurrency = 20;
    for (let i = 0; i < variantIds.length; i += concurrency) {
      const chunk = variantIds.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (id) => {
          try {
            const data = await this.client.getJson<{
              averageCost?: string | number;
            }>(`/v1/variants/${id}/costs.json`);
            const avg = Number(data.averageCost ?? 0);
            averages.set(id, Number.isFinite(avg) ? avg : 0);
          } catch (err) {
            this.logger.warn(
              `No se pudo leer costo promedio variante ${id}: ${err instanceof Error ? err.message : err}`,
            );
            averages.set(id, 0);
          }
        }),
      );
    }
    return averages;
  }

  /**
   * Retrocede movimientos desde el stock/costo actual hasta el inicio del periodo
   * para obtener el costo promedio de apertura (promedio ponderado).
   */
  private reverseOpeningAverage(
    stockNow: number,
    avgNow: number,
    movesNewestFirst: PendingMovement[],
  ): number {
    const state: CostState = {
      qty: stockNow,
      avg: Number.isFinite(avgNow) ? avgNow : 0,
    };

    for (const row of movesNewestFirst) {
      if (row.entryQty > 0) {
        const entryCost =
          row.unitCost != null && Number.isFinite(row.unitCost)
            ? row.unitCost
            : state.avg;
        const qtyAfter = state.qty;
        const qtyBefore = qtyAfter - row.entryQty;
        if (qtyBefore <= 1e-9) {
          state.qty = Math.max(0, qtyBefore);
          // Sin stock previo: el promedio de apertura queda el vigente tras vaciar.
          continue;
        }
        const totalAfter = qtyAfter * state.avg;
        const totalBefore = totalAfter - row.entryQty * entryCost;
        state.qty = qtyBefore;
        state.avg =
          qtyBefore > 0 && Number.isFinite(totalBefore)
            ? Math.max(0, totalBefore / qtyBefore)
            : state.avg;
      } else if (row.exitQty > 0) {
        // Deshacer salida: vuelve la cantidad; el promedio no cambia.
        state.qty += row.exitQty;
      }
    }

    return Number.isFinite(state.avg) ? state.avg : 0;
  }

  /** Aplica costo promedio ponderado sobre el kardex del periodo (mutates unitCost). */
  private applyWeightedAverageCosts(
    rows: PendingMovement[],
    openingQtyByKey: Map<string, number>,
    openingAvgByKey: Map<string, number>,
  ): void {
    const states = new Map<string, CostState>();

    for (const row of rows) {
      const key = balanceKey(row.variantId, row.officeId);

      if (row.movementType === 'opening') {
        const avg = openingAvgByKey.get(key) ?? 0;
        const qty = openingQtyByKey.get(key) ?? 0;
        states.set(key, { qty, avg });
        row.unitCost = qty > 0 || avg > 0 ? avg : null;
        continue;
      }

      const state = states.get(key) ?? {
        qty: openingQtyByKey.get(key) ?? 0,
        avg: openingAvgByKey.get(key) ?? 0,
      };

      if (row.entryQty > 0) {
        const entryCost =
          row.unitCost != null && Number.isFinite(row.unitCost)
            ? row.unitCost
            : state.avg;
        row.unitCost = entryCost;
        const newQty = state.qty + row.entryQty;
        if (newQty > 1e-9) {
          state.avg =
            (state.qty * state.avg + row.entryQty * entryCost) / newQty;
        }
        state.qty = newQty;
      } else if (row.exitQty > 0) {
        row.unitCost = state.avg;
        state.qty = Math.max(0, state.qty - row.exitQty);
      }

      states.set(key, state);
    }
  }

  private validateRange(from: string, to: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException(
        'Las fechas deben estar en formato YYYY-MM-DD.',
      );
    }
    const fromTs = dateToUnixStart(from);
    const toTs = dateToUnixEnd(to);
    if (fromTs > toTs) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la final.',
      );
    }
    const months =
      (new Date(toTs * 1000).getUTCFullYear() -
        new Date(fromTs * 1000).getUTCFullYear()) *
        12 +
      (new Date(toTs * 1000).getUTCMonth() -
        new Date(fromTs * 1000).getUTCMonth()) +
      1;
    if (months > MAX_RANGE_MONTHS) {
      throw new BadRequestException(
        `El rango máximo permitido es de ${MAX_RANGE_MONTHS} meses.`,
      );
    }
  }

  private async loadDocumentTypes(): Promise<Map<number, RawDocumentType>> {
    try {
      const items = await this.client.getAllPages<RawDocumentType>(
        '/v1/document_types.json',
      );
      return new Map(items.map((t) => [Number(t.id), t]));
    } catch (err) {
      this.logger.warn(
        `No se pudieron cargar tipos de documento: ${err instanceof Error ? err.message : err}`,
      );
      return new Map();
    }
  }

  private async collectDocuments(
    officeId: number,
    officeName: string,
    fromIso: string,
    toIso: string,
    documentTypes: Map<number, RawDocumentType>,
    variantCache: Map<number, VariantInfo>,
  ): Promise<PendingMovement[]> {
    const rows: PendingMovement[] = [];

    for (const range of monthRanges(fromIso, toIso)) {
      const docs = await this.client.getAllPages<RawDocument>(
        '/v1/documents.json',
        {
          emissiondaterange: `[${range.fromTs},${range.toTs}]`,
          officeid: officeId,
          state: 0,
          expand: 'details,office,document_type',
        },
      );

      for (const doc of docs) {
        const typeId = Number(doc.document_type?.id ?? 0);
        const typeMeta = documentTypes.get(typeId);
        if (typeMeta && !this.usesStock(typeMeta)) continue;

        const isEntry = this.isStockEntryDocument(typeMeta, doc);
        const label =
          typeMeta?.name ??
          doc.document_type?.name ??
          `Documento tipo ${typeId || '?'}`;
        const details = await this.resolveDetails(
          doc.details,
          `/v1/documents/${doc.id}/details.json`,
        );
        const date = Number(doc.emissionDate ?? 0);

        for (const detail of details) {
          const qty = Math.abs(Number(detail.quantity ?? 0));
          if (!qty) continue;
          const variantId = Number(detail.variant?.id ?? 0);
          if (!variantId) continue;

          this.rememberVariant(variantCache, detail.variant);
          const info = this.variantLabel(variantCache, variantId, detail.variant);

          rows.push({
            date,
            dateIso: unixToIsoDate(date),
            officeId,
            officeName,
            movementType: 'document',
            documentLabel: label,
            documentNumber: String(doc.number ?? ''),
            documentId: doc.id,
            variantId,
            sku: info.sku,
            productName: info.productName,
            entryQty: isEntry ? qty : 0,
            exitQty: isEntry ? 0 : qty,
            // Solo costo de inventario en entradas; salidas usan promedio ponderado.
            unitCost:
              isEntry && detail.cost != null ? Number(detail.cost) : null,
          });
        }
      }
    }

    return rows;
  }

  private async collectReceptions(
    officeId: number,
    officeName: string,
    fromTs: number,
    toTs: number,
    variantCache: Map<number, VariantInfo>,
  ): Promise<PendingMovement[]> {
    const receptions = await this.client.getAllPagesInDateWindow<RawReception>(
      '/v1/stocks/receptions.json',
      { officeid: officeId, expand: 'details,office' },
      (rec) => Number(rec.admissionDate ?? 0),
      fromTs,
      toTs,
    );

    const rows: PendingMovement[] = [];
    for (const rec of receptions) {
      const date = Number(rec.admissionDate ?? 0);
      const details = await this.resolveDetails(
        rec.details,
        `/v1/stocks/receptions/${rec.id}/details.json`,
      );
      for (const detail of details) {
        const qty = Math.abs(Number(detail.quantity ?? 0));
        if (!qty) continue;
        const variantId = Number(detail.variant?.id ?? 0);
        if (!variantId) continue;

        this.rememberVariant(variantCache, detail.variant);
        const info = this.variantLabel(variantCache, variantId, detail.variant);

        rows.push({
          date,
          dateIso: unixToIsoDate(date),
          officeId,
          officeName,
          movementType: 'reception',
          documentLabel: rec.document || 'Recepción',
          documentNumber: String(rec.documentNumber ?? rec.id),
          documentId: rec.id,
          variantId,
          sku: info.sku,
          productName: info.productName,
          entryQty: qty,
          exitQty: 0,
          unitCost: detail.cost != null ? Number(detail.cost) : null,
        });
      }
    }
    return rows;
  }

  private async collectConsumptions(
    officeId: number,
    officeName: string,
    fromTs: number,
    toTs: number,
    variantCache: Map<number, VariantInfo>,
  ): Promise<PendingMovement[]> {
    const consumptions =
      await this.client.getAllPagesInDateWindow<RawConsumption>(
        '/v1/stocks/consumptions.json',
        { officeid: officeId, expand: 'details,office' },
        (cons) => Number(cons.consumptionDate ?? 0),
        fromTs,
        toTs,
      );

    const rows: PendingMovement[] = [];
    for (const cons of consumptions) {
      const date = Number(cons.consumptionDate ?? 0);
      const details = await this.resolveDetails(
        cons.details,
        `/v1/stocks/consumptions/${cons.id}/details.json`,
      );
      for (const detail of details) {
        const qty = Math.abs(Number(detail.quantity ?? 0));
        if (!qty) continue;
        const variantId = Number(detail.variant?.id ?? 0);
        if (!variantId) continue;

        this.rememberVariant(variantCache, detail.variant);
        const info = this.variantLabel(variantCache, variantId, detail.variant);

        rows.push({
          date,
          dateIso: unixToIsoDate(date),
          officeId,
          officeName,
          movementType: 'consumption',
          documentLabel: cons.note?.trim() || 'Consumo',
          documentNumber: String(cons.id),
          documentId: cons.id,
          variantId,
          sku: info.sku,
          productName: info.productName,
          entryQty: 0,
          exitQty: qty,
          unitCost: null,
        });
      }
    }
    return rows;
  }

  /**
   * Marca como "transfer" los pares salida/entrada de despacho interno
   * (mismo folio + variante + cantidad, distintos almacenes).
   */
  private tagInternalTransfers(rows: PendingMovement[]): void {
    const exits = rows.filter(
      (row) =>
        row.exitQty > 0 &&
        (row.movementType === 'document' || row.movementType === 'transfer') &&
        isInternalDispatchLabel(row.documentLabel),
    );
    const entries = rows.filter(
      (row) =>
        row.entryQty > 0 &&
        (row.movementType === 'reception' || row.movementType === 'transfer') &&
        isInternalDispatchLabel(row.documentLabel),
    );

    const usedEntries = new Set<PendingMovement>();
    let tagged = 0;

    for (const exit of exits) {
      const match = entries.find(
        (entry) =>
          !usedEntries.has(entry) &&
          entry.variantId === exit.variantId &&
          String(entry.documentNumber) === String(exit.documentNumber) &&
          Math.abs(entry.entryQty - exit.exitQty) < 1e-9 &&
          entry.officeId !== exit.officeId,
      );
      if (!match) continue;
      usedEntries.add(match);
      exit.movementType = 'transfer';
      match.movementType = 'transfer';
      if (!isInternalDispatchLabel(exit.documentLabel) || !exit.documentLabel) {
        exit.documentLabel = 'Traslado interno';
      }
      if (!isInternalDispatchLabel(match.documentLabel) || !match.documentLabel) {
        match.documentLabel = 'Traslado interno';
      }
      // Etiqueta clara sin perder el documento original
      if (!exit.documentLabel.toLowerCase().includes('traslado')) {
        exit.documentLabel = `Traslado — ${exit.documentLabel}`;
      }
      if (!match.documentLabel.toLowerCase().includes('traslado')) {
        match.documentLabel = `Traslado — ${match.documentLabel}`;
      }
      tagged += 2;
    }

    if (tagged > 0) {
      this.logger.log(`Marcados ${tagged} movimientos como traslado interno`);
    }
  }

  private async prefetchVariants(
    cache: Map<number, VariantInfo>,
  ): Promise<void> {
    this.logger.log('Precargando catálogo de variantes Bsale…');
    try {
      const variants = await this.client.getAllPages<RawVariant>(
        '/v1/variants.json',
        { expand: 'product' },
      );
      for (const variant of variants) {
        this.rememberVariant(cache, variant);
        const id = Number(variant.id ?? 0);
        if (!id) continue;
        if (!cache.has(id)) {
          cache.set(id, {
            sku: String(variant.code ?? '').trim(),
            productName: this.formatProductName(variant),
          });
        }
      }
      this.logger.log(`Variantes en cache: ${cache.size}`);
    } catch (err) {
      this.logger.warn(
        `No se pudo precargar variantes: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private rememberVariant(
    cache: Map<number, VariantInfo>,
    variant?: RawVariant,
  ): void {
    const id = Number(variant?.id ?? 0);
    if (!id) return;
    const sku = String(variant?.code ?? '').trim();
    const productName = this.formatProductName(variant);
    if (!sku && !productName) return;
    const prev = cache.get(id);
    cache.set(id, {
      sku: sku || prev?.sku || '',
      productName: productName || prev?.productName || '',
    });
  }

  private formatProductName(variant?: RawVariant): string {
    if (!variant) return '';
    const productName = String(
      variant.product?.name ?? variant.product?.description ?? '',
    ).trim();
    const description = String(variant.description ?? '').trim();
    if (productName && description && productName !== description) {
      return `${productName} — ${description}`;
    }
    return productName || description;
  }

  private variantLabel(
    cache: Map<number, VariantInfo>,
    variantId: number,
    partial?: RawVariant,
  ): VariantInfo {
    const cached = cache.get(variantId);
    const sku = String(partial?.code ?? cached?.sku ?? '').trim();
    const productName =
      this.formatProductName(partial) || cached?.productName || '';
    return { sku, productName };
  }

  private async enrichVariantFields(
    rows: PendingMovement[],
    cache: Map<number, VariantInfo>,
  ): Promise<void> {
    const missingIds = [
      ...new Set(
        rows
          .filter((row) => row.variantId && (!row.sku || !row.productName))
          .map((row) => row.variantId),
      ),
    ].filter((id) => {
      const cached = cache.get(id);
      return !cached?.sku || !cached?.productName;
    });

    if (missingIds.length === 0) {
      this.applyVariantCache(rows, cache);
      return;
    }

    this.logger.log(
      `Enriqueciendo ${missingIds.length} variantes sin SKU/nombre…`,
    );
    const concurrency = 16;
    for (let i = 0; i < missingIds.length; i += concurrency) {
      const chunk = missingIds.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (id) => {
          try {
            const variant = await this.client.getJson<RawVariant>(
              `/v1/variants/${id}.json`,
              { expand: 'product' },
            );
            this.rememberVariant(cache, { ...variant, id });
            // Ensure id is cached even if remember skipped empty fields
            if (!cache.has(id)) {
              cache.set(id, {
                sku: String(variant.code ?? '').trim(),
                productName: this.formatProductName(variant),
              });
            }
          } catch (err) {
            this.logger.warn(
              `No se pudo resolver variante ${id}: ${err instanceof Error ? err.message : err}`,
            );
            if (!cache.has(id)) {
              cache.set(id, { sku: '', productName: '' });
            }
          }
        }),
      );
    }

    this.applyVariantCache(rows, cache);
  }

  private applyVariantCache(
    rows: PendingMovement[],
    cache: Map<number, VariantInfo>,
  ): void {
    for (const row of rows) {
      const info = cache.get(row.variantId);
      if (!info) continue;
      if (!row.sku && info.sku) row.sku = info.sku;
      if (!row.productName && info.productName) {
        row.productName = info.productName;
      }
    }
  }

  private unwrapDetails(
    details: { items?: RawDetail[]; href?: string } | RawDetail[] | undefined,
  ): RawDetail[] {
    if (!details) return [];
    if (Array.isArray(details)) return details;
    return details.items ?? [];
  }

  private async resolveDetails(
    details: { items?: RawDetail[]; href?: string } | RawDetail[] | undefined,
    fallbackPath: string,
  ): Promise<RawDetail[]> {
    if (Array.isArray(details)) return details;
    if (details?.items) return details.items;
    if (!details?.href) return [];
    try {
      return await this.client.getAllPages<RawDetail>(fallbackPath);
    } catch (err) {
      this.logger.warn(
        `No se pudieron cargar detalles ${fallbackPath}: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  private usesStock(type: RawDocumentType): boolean {
    if (type.useStock === undefined || type.useStock === null) return true;
    return Number(type.useStock) !== 0;
  }

  private isStockEntryDocument(
    type: RawDocumentType | undefined,
    doc: RawDocument,
  ): boolean {
    if (type?.isCreditNote != null && Number(type.isCreditNote) === 1) {
      return true;
    }
    const name = (
      type?.name ??
      doc.document_type?.name ??
      ''
    ).toLowerCase();
    const code = String(type?.codeSii ?? '');
    if (code === '07' || code === '97') return true;
    if (
      name.includes('crédito') ||
      name.includes('credito') ||
      name.includes('credit note')
    ) {
      return true;
    }
    return false;
  }
}
