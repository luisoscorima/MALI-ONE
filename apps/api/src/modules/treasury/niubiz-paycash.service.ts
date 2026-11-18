import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TreasuryPaymentQueryDto } from './dto/treasury.dto';
import { NiubizSyncService } from './niubiz-sync.service';
import { parsePayCashExport, PAYCASH_MERCHANT, PayCashRow } from './niubiz-paycash.parser';
import { resolvePayCashMerchant } from './niubiz-merchants';
import {
  assertExportSize,
  buildTreasuryXlsx,
  exportFilename,
  limaStamp,
} from './treasury-xlsx';

const endpoint = 'https://api.niubiz.pe/api.backoffice.merchant/pagoefectivo';
/** Durable sync-state row; merchant code comes from catalog paycashEnabled. */
const stateId = 'niubiz_paycash';

@Injectable()
export class NiubizPayCashService {
  private readonly logger = new Logger(NiubizPayCashService.name);
  constructor(private readonly prisma: PrismaService, private readonly niubiz: NiubizSyncService) {}

  private async merchant() {
    const target = await resolvePayCashMerchant(this.prisma);
    if (!target) {
      throw new ServiceUnavailableException(
        'Marca un comercio Niubiz activo con PagoEfectivo (CIP) en el catálogo.',
      );
    }
    return target;
  }

  async status() {
    const [connection, lastRun, paycash] = await Promise.all([
      this.niubiz.status(),
      this.prisma.niubizPayCashSyncState.findUnique({ where: { id: stateId } }),
      resolvePayCashMerchant(this.prisma),
    ]);
    if (lastRun?.status === 'running' && (!lastRun.leaseUntil || lastRun.leaseUntil < new Date())) {
      lastRun.status = 'interrupted';
    }
    return {
      configured: connection.configured && !!paycash,
      scheduled: process.env.NIUBIZ_SYNC_ENABLED === 'true',
      merchantCode: paycash?.reference ?? PAYCASH_MERCHANT,
      merchantAlias: paycash?.name ?? null,
      lastRun,
      lastSuccessful: lastRun?.lastSuccessfulAt && lastRun.lastSuccessfulRowCount != null
        ? { finishedAt: lastRun.lastSuccessfulAt, rowCount: lastRun.lastSuccessfulRowCount }
        : null,
    };
  }

  // Offset +7 min from Ventas so both do not open Vault/login at the same second.
  @Cron('0 7,22,37,52 * * * *', { timeZone: 'America/Lima' })
  async scheduled() {
    if (process.env.NIUBIZ_SYNC_ENABLED !== 'true') return;
    try {
      await this.start();
    } catch (error) {
      if (!(error instanceof ConflictException)) this.logger.warn('PAYCASH_SCHEDULE_NOT_STARTED');
    }
  }

  async start(actor?: { id: string; email: string }) {
    if (!(await this.niubiz.status()).configured) {
      throw new ServiceUnavailableException('Configura el acceso de Niubiz Comercio en el servidor.');
    }
    const paycash = await this.merchant();
    await this.prisma.niubizPayCashSyncState.upsert({
      where: { id: stateId }, create: { id: stateId }, update: {},
    });
    const now = new Date();
    const runId = randomUUID();
    const locked = await this.prisma.niubizPayCashSyncState.updateMany({
      where: { id: stateId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { runId, status: 'running', startedAt: now, finishedAt: null,
        leaseUntil: new Date(now.getTime() + 15 * 60000), errorCode: null,
        rowCount: 0, createdCount: 0, updatedCount: 0 },
    });
    if (!locked.count) throw new ConflictException('Ya existe una actualización de PagoEfectivo en curso.');
    void this.run(runId, paycash.reference, actor).catch(() => this.logger.error('PAYCASH_RUN_STATE_WRITE_FAILED'));
    return { runId };
  }

  private async request(exportAll: boolean, token: string, merchantCode: string) {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: merchantCode, cip: '', purchaseDate: '', paymentDate: '',
        page: 1, size: 10, export: exportAll }),
    });
    if (response.status === 401) throw new Error('SESSION_EXPIRED');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (!response.ok) throw new Error('API_HTTP_ERROR');
    const payload = await response.json() as {
      header?: { errorCode?: number }; data?: { count?: number; list?: unknown };
    };
    if (payload.header?.errorCode !== 0 || !Array.isArray(payload.data?.list)) {
      throw new Error('API_SCHEMA_ERROR');
    }
    return payload.data;
  }

  private async run(runId: string, merchantCode: string, actor?: { id: string; email: string }) {
    let errorCode: string | null = null;
    let result = { rowCount: 0, createdCount: 0, updatedCount: 0 };
    try {
      let token = await this.niubiz.loginForPayCash();
      const request = async (exportAll: boolean) => {
        try { return await this.request(exportAll, token, merchantCode); }
        catch (error) {
          if (!(error instanceof Error) || error.message !== 'SESSION_EXPIRED') throw error;
          token = await this.niubiz.loginForPayCash();
          return this.request(exportAll, token, merchantCode);
        }
      };
      const page = await request(false);
      if (!Number.isSafeInteger(page.count) || page.count! < 0 || page.count! > 50000 ||
          !Array.isArray(page.list) || page.list.length !== Math.min(10, page.count!)) {
        throw new Error('API_SCHEMA_ERROR');
      }
      const exported = await request(true);
      const rows = parsePayCashExport(exported.list, page.count!, merchantCode);
      result = await this.save(rows, merchantCode, actor);
      token = '';
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      errorCode = ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'NIUBIZ_LOGIN_REQUIRED',
        'LOGIN_WORKER_FAILED', 'RATE_LIMITED', 'API_HTTP_ERROR', 'API_SCHEMA_ERROR',
        'API_DATA_MISMATCH', 'EXPORT_INCOMPLETE', 'SESSION_EXPIRED'].includes(code) ? code : 'SYNC_FAILED';
    } finally {
      const finishedAt = new Date();
      await this.prisma.niubizPayCashSyncState.updateMany({
        where: { id: stateId, runId },
        data: { status: errorCode ? 'failed' : 'completed', errorCode, finishedAt,
          leaseUntil: null, ...result,
          ...(!errorCode ? { lastSuccessfulAt: finishedAt, lastSuccessfulRowCount: result.rowCount } : {}),
        },
      });
    }
  }

  private async save(rows: PayCashRow[], merchantCode: string, actor?: { id: string; email: string }) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.niubizPayCashPayment.findMany({
        where: { merchantCode },
      });
      const byCip = new Map(existing.map(row => [row.cip, row]));
      const fresh = rows.filter(row => !byCip.has(row.cip));
      let updatedCount = 0;
      for (const row of rows) {
        const old = byCip.get(row.cip);
        if (!old) continue;
        if (old.status === row.status && old.customerEmail === row.customerEmail &&
            old.currency === row.currency && old.amount.equals(row.amount) &&
            old.brand === row.brand && old.purchasedAt.getTime() === row.purchasedAt.getTime() &&
            old.paidAt?.getTime() === row.paidAt?.getTime()) continue;
        await tx.niubizPayCashPayment.update({
          where: { merchantCode_cip: { merchantCode, cip: row.cip } },
          data: { customerEmail: row.customerEmail, currency: row.currency, amount: row.amount,
            brand: row.brand, purchasedAt: row.purchasedAt, paidAt: row.paidAt, status: row.status },
        });
        updatedCount++;
      }
      for (let index = 0; index < fresh.length; index += 500) {
        await tx.niubizPayCashPayment.createMany({ data: fresh.slice(index, index + 500) });
      }
      if (actor) {
        await tx.adminAuditLog.create({ data: { actorId: actor.id, actorEmail: actor.email,
          action: 'TREASURY_NIUBIZ_PAYCASH_SYNCED', payload: { merchantCode,
            rowCount: rows.length, createdCount: fresh.length, updatedCount } } });
      }
      return { rowCount: rows.length, createdCount: fresh.length, updatedCount };
    }, { maxWait: 10000, timeout: 300000 });
  }

  private async listWhere(query: TreasuryPaymentQueryDto): Promise<Prisma.NiubizPayCashPaymentWhereInput> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('Rango de fechas inválido.');
    }
    const paycash = await this.merchant();
    const search = query.q?.trim().replace(/[\\%_]/g, '\\$&');
    return {
      merchantCode: paycash.reference,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { cip: { contains: search } },
              { customerEmail: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            purchasedAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00-05:00`) } : {}),
              ...(query.to
                ? { lt: new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000) }
                : {}),
            },
          }
        : {}),
    };
  }

  async list(query: TreasuryPaymentQueryDto) {
    const page = query.page ?? 1;
    const where = await this.listWhere(query);
    const merchantCode = where.merchantCode as string;
    const [total, payments, states] = await this.prisma.$transaction([
      this.prisma.niubizPayCashPayment.count({ where }),
      this.prisma.niubizPayCashPayment.findMany({
        where,
        orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      this.prisma.niubizPayCashPayment.findMany({
        where: { merchantCode },
        distinct: ['status'],
        select: { status: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    return {
      total,
      page,
      pageSize: 50,
      states: states.map((row) => row.status),
      payments: payments.map((row) => ({ ...row, amount: row.amount.toFixed(2) })),
    };
  }

  async exportXlsx(query: TreasuryPaymentQueryDto) {
    const where = await this.listWhere(query);
    const total = await this.prisma.niubizPayCashPayment.count({ where });
    assertExportSize(total);
    const payments = await this.prisma.niubizPayCashPayment.findMany({
      where,
      orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
    });
    const buffer = await buildTreasuryXlsx(
      'PagoEfectivo',
      [
        { key: 'purchasedAt', header: 'Fecha de compra', width: 20 },
        { key: 'paidAt', header: 'Fecha de pago', width: 20 },
        { key: 'cip', header: 'Código CIP', width: 16 },
        { key: 'customerEmail', header: 'Cliente', width: 32 },
        { key: 'currency', header: 'Moneda', width: 10 },
        { key: 'amount', header: 'Importe', width: 12 },
        { key: 'brand', header: 'Marca', width: 16 },
        { key: 'status', header: 'Estado', width: 14 },
        { key: 'merchantCode', header: 'Comercio', width: 14 },
      ],
      payments.map((row) => ({
        purchasedAt: limaStamp(row.purchasedAt),
        paidAt: limaStamp(row.paidAt),
        cip: row.cip,
        customerEmail: row.customerEmail,
        currency: row.currency,
        amount: row.amount.toFixed(2),
        brand: row.brand,
        status: row.status,
        merchantCode: row.merchantCode,
      })),
    );
    return { buffer, filename: exportFilename('niubiz-pagoefectivo', query.from, query.to) };
  }
}
