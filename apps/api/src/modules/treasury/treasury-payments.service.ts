import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { niubizEmailFromRecord, readNiubizXlsx, NiubizPayment } from './niubiz-import';
import { samePaymentPayload } from './payment-payload';
import { TreasuryPaymentQueryDto } from './dto/treasury.dto';
import { listNiubizMerchants } from './niubiz-merchants';
import {
  assertExportSize,
  buildTreasuryXlsx,
  exportFilename,
  limaDateOnly,
  limaStamp,
} from './treasury-xlsx';

@Injectable()
export class TreasuryPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async importXlsx(actor: { id: string; email: string }, buffer: Buffer) {
    const rows = await readNiubizXlsx(buffer);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    return this.saveRows(rows, 'niubiz_xlsx', checksum, actor);
  }

  async saveRows(
    rows: NiubizPayment[],
    origin: 'niubiz_api' | 'niubiz_xlsx',
    checksum: string,
    actor?: { id: string; email: string },
    payloads?: Prisma.InputJsonObject[],
  ) {
    return this.prisma.$transaction(async tx => {
      // Serializes imports across API instances, so counts and upserts cannot race.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(782301)`;
      const { merchants } = await listNiubizMerchants(tx);
      const byCode = new Map(merchants.map((m) => [m.reference, m]));
      const missing = [...new Set(rows.map((r) => r.merchantCode))].filter((code) => !byCode.has(code));
      if (missing.length) {
        throw new BadRequestException(
          `Comercio(s) fuera del catálogo Niubiz: ${missing.join(', ')}. Añádelos en Comercios antes de importar.`,
        );
      }
      const batch = await tx.treasuryPaymentImport.create({ data: {
        provider: 'niubiz_sales', origin, checksum, actorId: actor?.id ?? 'niubiz_scheduler',
        rowCount: rows.length, createdCount: 0, updatedCount: 0,
      } });
      if (payloads && payloads.length !== rows.length) {
        throw new BadRequestException('El lote y el registro del portal no coinciden.');
      }
      // Refresh portal names from Niubiz payload so operators never type them.
      const portalNameByCode = new Map<string, string>();
      for (const row of rows) {
        const name = row.merchantName?.trim();
        if (name && !portalNameByCode.has(row.merchantCode)) portalNameByCode.set(row.merchantCode, name);
      }
      for (const [code, portalName] of portalNameByCode) {
        const target = byCode.get(code);
        if (!target || target.externalName === portalName) continue;
        await tx.treasuryTarget.update({
          where: { id: target.id },
          data: { externalName: portalName },
        });
        target.externalName = portalName;
      }

      let createdCount = 0;
      let updatedCount = 0;
      for (const [index, row] of rows.entries()) {
        const target = byCode.get(row.merchantCode)!;
        const identity = { targetId: target.id, transactionCode: row.transactionCode };
        const old = await tx.treasuryPayment.findUnique({ where: { targetId_transactionCode: identity } });
        const amount = new Prisma.Decimal(row.amount);
        const payload = payloads?.[index];
        const payloadChanged = payload ? !samePaymentPayload(old?.payload ?? null, payload) : false;
        if (!old) createdCount++;
        else if (
          payloadChanged ||
          !old.amount.equals(amount) ||
          old.status !== row.status ||
          old.currency !== row.currency ||
          old.orderNumber !== row.orderNumber ||
          old.customerName !== row.customerName ||
          old.customerEmail !== row.customerEmail ||
          old.cardBrand !== row.cardBrand ||
          old.cardType !== row.cardType ||
          old.cardLastDigits !== row.cardLastDigits ||
          old.wallet !== row.wallet ||
          old.merchantName !== row.merchantName ||
          old.transactedAt.getTime() !== row.transactedAt.getTime() ||
          old.settledOn?.getTime() !== row.settledOn?.getTime()
        ) {
          updatedCount++;
        }
        const saved = {
          ...row,
          targetId: target.id,
          amount,
          lastImportId: batch.id,
          ...(payload ? { payload } : {}),
        };
        await tx.treasuryPayment.upsert({
          where: { targetId_transactionCode: identity },
          create: { ...saved, provider: 'niubiz_sales' },
          update: saved,
        });
      }
      await tx.treasuryPaymentImport.update({ where: { id: batch.id }, data: { createdCount, updatedCount } });
      if (actor) await tx.adminAuditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: 'TREASURY_PAYMENTS_IMPORTED', payload: { importId: batch.id, rows: rows.length, createdCount, updatedCount } } });
      return { id: batch.id, rows: rows.length, createdCount, updatedCount, unchangedCount: rows.length - createdCount - updatedCount };
    }, { maxWait: 10000, timeout: 90000 });
  }

  private listWhere(query: TreasuryPaymentQueryDto): Prisma.TreasuryPaymentWhereInput {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('La fecha inicial debe ser anterior o igual a la final.');
    }
    // Prisma contains uses SQL LIKE: escape wildcards to search literal text.
    const search = query.q?.trim().replace(/[\\%_]/g, '\\$&');
    return {
      provider: 'niubiz_sales',
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' as const } },
              { transactionCode: { contains: search, mode: 'insensitive' as const } },
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { customerEmail: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.merchant ? { merchantCode: query.merchant } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            transactedAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00-05:00`) } : {}),
              ...(query.to
                ? { lt: new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000) }
                : {}),
            },
          }
        : {}),
    };
  }

  private paymentEmail(payment: {
    customerEmail: string | null;
    payload: Prisma.JsonValue | null;
  }) {
    return (
      payment.customerEmail ??
      niubizEmailFromRecord(
        payment.payload && typeof payment.payload === 'object' && !Array.isArray(payment.payload)
          ? (payment.payload as Record<string, unknown>)
          : null,
      )
    );
  }

  async list(query: TreasuryPaymentQueryDto) {
    const page = query.page ?? 1;
    const where = this.listWhere(query);
    const [{ merchants: catalog }, total, payments, lastImport, states] = await Promise.all([
      listNiubizMerchants(this.prisma),
      this.prisma.treasuryPayment.count({ where }),
      this.prisma.treasuryPayment.findMany({
        where,
        orderBy: [{ transactedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 50,
        take: 50,
        include: { target: { select: { name: true } } },
      }),
      this.prisma.treasuryPaymentImport.findFirst({
        where: { provider: 'niubiz_sales' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, rowCount: true, origin: true },
      }),
      this.prisma.treasuryPayment.findMany({
        where: { provider: 'niubiz_sales' },
        distinct: ['status'],
        select: { status: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    const aliasByCode = new Map(catalog.map((m) => [m.reference, m.name]));
    return {
      total,
      page,
      pageSize: 50,
      lastImport,
      merchants: catalog.map((m) => ({
        targetId: m.id,
        merchantCode: m.reference,
        merchantName: m.externalName || m.name,
        alias: m.name,
        active: m.active,
        paycashEnabled: m.paycashEnabled,
      })),
      states: states.map((s) => s.status),
      payments: payments.map(({ target, ...p }) => ({
        ...p,
        merchantAlias: target.name || aliasByCode.get(p.merchantCode) || null,
        amount: p.amount.toFixed(2),
        customerEmail: this.paymentEmail(p),
      })),
    };
  }

  async exportXlsx(query: TreasuryPaymentQueryDto) {
    const where = this.listWhere(query);
    const total = await this.prisma.treasuryPayment.count({ where });
    assertExportSize(total);
    const [{ merchants: catalog }, payments] = await Promise.all([
      listNiubizMerchants(this.prisma),
      this.prisma.treasuryPayment.findMany({
        where,
        orderBy: [{ transactedAt: 'desc' }, { id: 'desc' }],
        include: { target: { select: { name: true } } },
      }),
    ]);
    const aliasByCode = new Map(catalog.map((m) => [m.reference, m.name]));
    const buffer = await buildTreasuryXlsx(
      'Ventas Niubiz',
      [
        { key: 'transactedAt', header: 'Fecha', width: 20 },
        { key: 'merchantAlias', header: 'Alias MALI', width: 20 },
        { key: 'merchantCode', header: 'Comercio', width: 14 },
        { key: 'merchantName', header: 'Nombre Niubiz', width: 28 },
        { key: 'orderNumber', header: 'Pedido', width: 14 },
        { key: 'transactionCode', header: 'Código de transacción', width: 22 },
        { key: 'customerName', header: 'Cliente', width: 28 },
        { key: 'customerEmail', header: 'Email', width: 32 },
        { key: 'currency', header: 'Moneda', width: 10 },
        { key: 'amount', header: 'Importe', width: 12 },
        { key: 'status', header: 'Estado', width: 14 },
        { key: 'settledOn', header: 'Liquidación', width: 14 },
        { key: 'cardBrand', header: 'Marca', width: 12 },
        { key: 'cardType', header: 'Tipo tarjeta', width: 14 },
        { key: 'cardLastDigits', header: 'Tarjeta', width: 10 },
        { key: 'wallet', header: 'Billetera', width: 12 },
      ],
      payments.map((p) => ({
        transactedAt: limaStamp(p.transactedAt),
        merchantAlias: p.target.name || aliasByCode.get(p.merchantCode) || '',
        merchantCode: p.merchantCode,
        merchantName: p.merchantName,
        orderNumber: p.orderNumber,
        transactionCode: p.transactionCode,
        customerName: p.customerName,
        customerEmail: this.paymentEmail(p),
        currency: p.currency,
        amount: p.amount.toFixed(2),
        status: p.status,
        settledOn: limaDateOnly(p.settledOn),
        cardBrand: p.cardBrand,
        cardType: p.cardType,
        cardLastDigits: p.cardLastDigits,
        wallet: p.wallet,
      })),
    );
    return { buffer, filename: exportFilename('niubiz-ventas', query.from, query.to) };
  }
}
