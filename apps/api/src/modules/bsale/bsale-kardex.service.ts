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

type PendingMovement = Omit<BsaleKardexMovementDto, 'balanceQty'>;

@Injectable()
export class BsaleKardexService {
  private readonly logger = new Logger(BsaleKardexService.name);

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
    const fromTs = dateToUnixStart(params.from);
    const toTs = dateToUnixEnd(params.to);

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
    const pending: PendingMovement[] = [];

    for (const officeId of selectedIds) {
      const officeName = officeMap.get(officeId)?.name ?? `Oficina ${officeId}`;
      this.logger.log(`Kardex oficina ${officeId} (${officeName})`);

      pending.push(
        ...(await this.collectDocuments(
          officeId,
          officeName,
          params.from,
          params.to,
          documentTypes,
          variantCache,
        )),
      );
      pending.push(
        ...(await this.collectReceptions(
          officeId,
          officeName,
          fromTs,
          toTs,
          variantCache,
        )),
      );
      pending.push(
        ...(await this.collectConsumptions(
          officeId,
          officeName,
          fromTs,
          toTs,
          variantCache,
        )),
      );
    }

    await this.enrichVariantFields(pending, variantCache);

    pending.sort((a, b) => {
      if (a.date !== b.date) return a.date - b.date;
      if (a.officeId !== b.officeId) return a.officeId - b.officeId;
      return a.variantId - b.variantId;
    });

    const balances = new Map<string, number>();
    const movements: BsaleKardexMovementDto[] = pending.map((row) => {
      const key = `${row.variantId}:${row.officeId}`;
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
            unitCost:
              detail.cost != null
                ? Number(detail.cost)
                : detail.netUnitValue != null
                  ? Number(detail.netUnitValue)
                  : null,
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
    const receptions = await this.client.getAllPages<RawReception>(
      '/v1/stocks/receptions.json',
      {
        officeid: officeId,
        expand: 'details,office',
      },
    );

    const rows: PendingMovement[] = [];
    for (const rec of receptions) {
      const date = Number(rec.admissionDate ?? 0);
      if (date < fromTs || date > toTs) continue;
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
    const consumptions = await this.client.getAllPages<RawConsumption>(
      '/v1/stocks/consumptions.json',
      {
        officeid: officeId,
        expand: 'details,office',
      },
    );

    const rows: PendingMovement[] = [];
    for (const cons of consumptions) {
      const date = Number(cons.consumptionDate ?? 0);
      if (date < fromTs || date > toTs) continue;
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
          unitCost: detail.cost != null ? Number(detail.cost) : null,
        });
      }
    }
    return rows;
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
    const concurrency = 8;
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
