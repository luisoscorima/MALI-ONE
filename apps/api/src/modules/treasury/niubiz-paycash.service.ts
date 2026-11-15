import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TreasuryPaymentQueryDto } from './dto/treasury.dto';
import { NiubizSyncService } from './niubiz-sync.service';
import { parsePayCashExport, PAYCASH_MERCHANT, PayCashRow } from './niubiz-paycash.parser';

const endpoint = 'https://api.niubiz.pe/api.backoffice.merchant/pagoefectivo';
const stateId = PAYCASH_MERCHANT;

@Injectable()
export class NiubizPayCashService {
  private readonly logger = new Logger(NiubizPayCashService.name);
  constructor(private readonly prisma: PrismaService, private readonly niubiz: NiubizSyncService) {}

  async status() {
    const [connection, lastRun] = await Promise.all([
      this.niubiz.status(),
      this.prisma.niubizPayCashSyncState.findUnique({ where: { id: stateId } }),
    ]);
    if (lastRun?.status === 'running' && (!lastRun.leaseUntil || lastRun.leaseUntil < new Date())) {
      lastRun.status = 'interrupted';
    }
    return { configured: connection.configured, merchantCode: PAYCASH_MERCHANT, lastRun };
  }

  async start(actor: { id: string; email: string }) {
    if (!(await this.niubiz.status()).configured) {
      throw new ServiceUnavailableException('Configura el acceso de Niubiz Comercio en el servidor.');
    }
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
    void this.run(runId, actor).catch(() => this.logger.error('PAYCASH_RUN_STATE_WRITE_FAILED'));
    return { runId };
  }

  private async request(exportAll: boolean, token: string) {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: PAYCASH_MERCHANT, cip: '', purchaseDate: '', paymentDate: '',
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

  private async run(runId: string, actor: { id: string; email: string }) {
    let errorCode: string | null = null;
    let result = { rowCount: 0, createdCount: 0, updatedCount: 0 };
    try {
      let token = await this.niubiz.loginForPayCash();
      const request = async (exportAll: boolean) => {
        try { return await this.request(exportAll, token); }
        catch (error) {
          if (!(error instanceof Error) || error.message !== 'SESSION_EXPIRED') throw error;
          token = await this.niubiz.loginForPayCash();
          return this.request(exportAll, token);
        }
      };
      const page = await request(false);
      if (!Number.isSafeInteger(page.count) || page.count! < 0 || page.count! > 50000 ||
          !Array.isArray(page.list) || page.list.length !== Math.min(10, page.count!)) {
        throw new Error('API_SCHEMA_ERROR');
      }
      const exported = await request(true);
      const rows = parsePayCashExport(exported.list, page.count!);
      result = await this.save(rows, actor);
      token = '';
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      errorCode = ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'NIUBIZ_LOGIN_REQUIRED',
        'LOGIN_WORKER_FAILED', 'RATE_LIMITED', 'API_HTTP_ERROR', 'API_SCHEMA_ERROR',
        'API_DATA_MISMATCH', 'EXPORT_INCOMPLETE', 'SESSION_EXPIRED'].includes(code) ? code : 'SYNC_FAILED';
    } finally {
      await this.prisma.niubizPayCashSyncState.updateMany({
        where: { id: stateId, runId },
        data: { status: errorCode ? 'failed' : 'completed', errorCode, finishedAt: new Date(),
          leaseUntil: null, ...result },
      });
    }
  }

  private async save(rows: PayCashRow[], actor: { id: string; email: string }) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.niubizPayCashPayment.findMany({
        where: { merchantCode: PAYCASH_MERCHANT },
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
          where: { merchantCode_cip: { merchantCode: PAYCASH_MERCHANT, cip: row.cip } },
          data: { customerEmail: row.customerEmail, currency: row.currency, amount: row.amount,
            brand: row.brand, purchasedAt: row.purchasedAt, paidAt: row.paidAt, status: row.status },
        });
        updatedCount++;
      }
      for (let index = 0; index < fresh.length; index += 500) {
        await tx.niubizPayCashPayment.createMany({ data: fresh.slice(index, index + 500) });
      }
      await tx.adminAuditLog.create({ data: { actorId: actor.id, actorEmail: actor.email,
        action: 'TREASURY_NIUBIZ_PAYCASH_SYNCED', payload: { merchantCode: PAYCASH_MERCHANT,
          rowCount: rows.length, createdCount: fresh.length, updatedCount } } });
      return { rowCount: rows.length, createdCount: fresh.length, updatedCount };
    }, { maxWait: 10000, timeout: 300000 });
  }

  async list(query: TreasuryPaymentQueryDto) {
    if (query.from && query.to && query.from > query.to) throw new BadRequestException('Rango de fechas inválido.');
    const page = query.page ?? 1;
    const search = query.q?.trim().replace(/[\\%_]/g, '\\$&');
    const where: Prisma.NiubizPayCashPaymentWhereInput = {
      merchantCode: PAYCASH_MERCHANT,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ cip: { contains: search } },
        { customerEmail: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(query.from || query.to ? { purchasedAt: {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00-05:00`) } : {}),
        ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000) } : {}),
      } } : {}),
    };
    const [total, payments, states] = await this.prisma.$transaction([
      this.prisma.niubizPayCashPayment.count({ where }),
      this.prisma.niubizPayCashPayment.findMany({ where,
        orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50 }),
      this.prisma.niubizPayCashPayment.findMany({ where: { merchantCode: PAYCASH_MERCHANT },
        distinct: ['status'], select: { status: true }, orderBy: { status: 'asc' } }),
    ]);
    return { total, page, pageSize: 50, states: states.map(row => row.status),
      payments: payments.map(row => ({ ...row, amount: row.amount.toFixed(2) })) };
  }
}
