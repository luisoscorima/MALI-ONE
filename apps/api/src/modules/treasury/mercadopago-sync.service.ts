import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { MercadoPagoPaymentQueryDto } from './dto/treasury.dto';
import { sanitizePaymentPayload } from './payment-payload';

const apiBase = 'https://api.mercadopago.com';
const limaDay = (now = new Date()) => new Date(now.getTime() - 5 * 3600000).toISOString().slice(0, 10);
type Credentials = { accessToken?: string | null; clientId?: string; clientSecret?: string };
type MpPayment = Record<string, any>;

@Injectable()
export class MercadoPagoSyncService {
  constructor(private readonly prisma: PrismaService) {}

  private async source(sourceId: string) {
    const source = await this.prisma.treasurySource.findFirst({
      where: { id: sourceId, provider: 'mercadopago', active: true },
    });
    if (!source) throw new BadRequestException('Fuente Mercado Pago activa no encontrada.');
    return source;
  }

  async status(sourceId: string) {
    const [source, lastRun] = await Promise.all([
      this.source(sourceId),
      this.prisma.mercadoPagoSyncState.findUnique({ where: { sourceId } }),
    ]);
    const runtimeReady = ['FINANCE_VAULT_URL', 'FINANCE_VAULT_CLIENT_ID', 'FINANCE_VAULT_CLIENT_SECRET',
      'FINANCE_VAULT_MASTER_PASSWORD', 'FINANCE_RUNTIME_NODE', 'MERCADOPAGO_CREDENTIALS_SCRIPT']
      .every(key => !!process.env[key]);
    return { configured: runtimeReady && !!source.vaultItemId, lastRun };
  }

  async start(sourceId: string, range: { from?: string; to?: string }, actor: Pick<User, 'id' | 'email'>) {
    const source = await this.source(sourceId);
    if (!source.vaultItemId) throw new ServiceUnavailableException('Configura el elemento de Vaultwarden de esta fuente.');
    const to = range.to ?? limaDay();
    const from = range.from ?? limaDay(new Date(Date.now() - 31 * 86400000));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || to > limaDay()) {
      throw new BadRequestException('Rango de fechas inválido.');
    }
    await this.prisma.mercadoPagoSyncState.upsert({ where: { sourceId }, create: { sourceId }, update: {} });
    const now = new Date();
    const runId = randomUUID();
    const locked = await this.prisma.mercadoPagoSyncState.updateMany({
      where: { sourceId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { runId, status: 'running', startedAt: now, finishedAt: null,
        leaseUntil: new Date(now.getTime() + 30 * 60000), fromDate: from, toDate: to, errorCode: null, rowCount: 0 },
    });
    if (!locked.count) throw new ConflictException('Ya existe una sincronización en curso.');
    void this.run(sourceId, source.vaultItemId, runId, from, to, actor);
    return { runId };
  }

  private credentials(itemId: string): Promise<Credentials> {
    return new Promise((resolve, reject) => execFile(process.env.FINANCE_RUNTIME_NODE!,
      [process.env.MERCADOPAGO_CREDENTIALS_SCRIPT!], { timeout: 90000, maxBuffer: 65536, env: {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME,
        FINANCE_VAULT_URL: process.env.FINANCE_VAULT_URL,
        FINANCE_VAULT_CLIENT_ID: process.env.FINANCE_VAULT_CLIENT_ID,
        FINANCE_VAULT_CLIENT_SECRET: process.env.FINANCE_VAULT_CLIENT_SECRET,
        FINANCE_VAULT_MASTER_PASSWORD: process.env.FINANCE_VAULT_MASTER_PASSWORD,
        FINANCE_VAULT_MP_ITEM_ID: itemId,
      } }, (error, stdout) => {
        try {
          const result = JSON.parse(stdout);
          if (error || result.error || (!result.accessToken && !(result.clientId && result.clientSecret))) throw new Error(result.error || 'MP_CREDENTIALS');
          resolve(result);
        } catch (cause) { reject(cause); }
      }));
  }

  private async token(itemId: string) {
    const credentials = await this.credentials(itemId);
    if (credentials.accessToken) return credentials.accessToken;
    const response = await fetch(`${apiBase}/oauth/token`, { method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        grant_type: 'client_credentials', client_id: credentials.clientId, client_secret: credentials.clientSecret,
      }) });
    const body = await response.json() as { access_token?: string };
    if (!response.ok || !body.access_token) throw new Error('MP_AUTH');
    return body.access_token;
  }

  private async run(sourceId: string, itemId: string, runId: string, from: string, to: string, actor: Pick<User, 'id' | 'email'>) {
    let errorCode: string | null = null;
    let rowCount = 0;
    try {
      const token = await this.token(itemId);
      for (let offset = 0;; offset += 100) {
        const url = new URL(`${apiBase}/v1/payments/search`);
        Object.entries({ sort: 'date_last_updated', criteria: 'asc', range: 'date_last_updated',
          begin_date: `${from}T00:00:00.000-05:00`, end_date: `${to}T23:59:59.999-05:00`, limit: '100', offset: String(offset) })
          .forEach(([key, value]) => url.searchParams.set(key, value));
        const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401 || response.status === 403) throw new Error('MP_AUTH');
        if (response.status === 429) throw new Error('RATE_LIMITED');
        if (!response.ok) throw new Error('MP_API');
        const payload = await response.json() as { results?: MpPayment[]; paging?: { total?: number } };
        if (!Array.isArray(payload.results)) throw new Error('MP_SCHEMA');
        for (const payment of payload.results) {
          if (!['PEN', 'USD'].includes(payment.currency_id) || !payment.id || !payment.date_created || !payment.date_last_updated) continue;
          const fee = Array.isArray(payment.fee_details)
            ? payment.fee_details.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) : null;
          const payerName = [payment.payer?.first_name, payment.payer?.last_name].filter(Boolean).join(' ') || null;
          await this.prisma.mercadoPagoPayment.upsert({
            where: { sourceId_paymentId: { sourceId, paymentId: String(payment.id) } },
            create: this.mapPayment(sourceId, payment, fee, payerName),
            update: this.mapPayment(sourceId, payment, fee, payerName),
          });
          rowCount++;
        }
        if (offset + payload.results.length >= Number(payload.paging?.total ?? payload.results.length) || payload.results.length === 0) break;
      }
      await this.prisma.adminAuditLog.create({ data: { actorId: actor.id, actorEmail: actor.email,
        action: 'TREASURY_MERCADOPAGO_SYNCED', payload: { sourceId, from, to, rowCount } } });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      errorCode = ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'MP_AUTH', 'RATE_LIMITED', 'MP_API', 'MP_SCHEMA'].includes(code) ? code : 'SYNC_FAILED';
    } finally {
      await this.prisma.mercadoPagoSyncState.updateMany({ where: { sourceId, runId }, data: {
        status: errorCode ? 'failed' : 'completed', errorCode, rowCount, finishedAt: new Date(), leaseUntil: null,
      } });
    }
  }

  private mapPayment(sourceId: string, payment: MpPayment, fee: number | null, payerName: string | null) {
    const net = payment.transaction_details?.net_received_amount;
    return { sourceId, paymentId: String(payment.id), merchantOrderId: payment.order?.id ? String(payment.order.id) : null,
      externalReference: payment.external_reference || null, description: payment.description || null,
      status: String(payment.status || 'unknown'), statusDetail: payment.status_detail || null,
      currency: payment.currency_id as 'PEN' | 'USD', grossAmount: new Prisma.Decimal(payment.transaction_amount),
      netAmount: net == null ? null : new Prisma.Decimal(net), feeAmount: fee == null ? null : new Prisma.Decimal(fee),
      paymentMethodId: payment.payment_method_id || null, paymentTypeId: payment.payment_type_id || null,
      issuerName: payment.issuer_id ? String(payment.issuer_id) : null, cardLastDigits: payment.card?.last_four_digits || null,
      installments: Number.isInteger(payment.installments) ? payment.installments : null, payerName,
      payerEmail: payment.payer?.email || null, createdAtMp: new Date(payment.date_created),
      approvedAt: payment.date_approved ? new Date(payment.date_approved) : null,
      releasedAt: payment.money_release_date ? new Date(payment.money_release_date) : null,
      lastUpdatedAtMp: new Date(payment.date_last_updated), payload: sanitizePaymentPayload(payment) };
  }

  async list(sourceId: string, query: MercadoPagoPaymentQueryDto) {
    await this.source(sourceId);
    const page = query.page ?? 1;
    const search = query.q?.trim();
    const where: Prisma.MercadoPagoPaymentWhereInput = { sourceId,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ paymentId: { contains: search } }, { description: { contains: search, mode: 'insensitive' } },
        { payerName: { contains: search, mode: 'insensitive' } }, { payerEmail: { contains: search, mode: 'insensitive' } },
        { externalReference: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(query.from || query.to ? { createdAtMp: {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00-05:00`) } : {}),
        ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000) } : {}),
      } } : {}) };
    const [total, payments, states] = await this.prisma.$transaction([
      this.prisma.mercadoPagoPayment.count({ where }),
      this.prisma.mercadoPagoPayment.findMany({ where, orderBy: [{ createdAtMp: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50 }),
      this.prisma.mercadoPagoPayment.findMany({ where: { sourceId }, distinct: ['status'], select: { status: true }, orderBy: { status: 'asc' } }),
    ]);
    return { total, page, pageSize: 50, states: states.map(s => s.status), payments: payments.map(p => ({ ...p,
      grossAmount: p.grossAmount.toFixed(2), netAmount: p.netAmount?.toFixed(2) ?? null, feeAmount: p.feeAmount?.toFixed(2) ?? null })) };
  }
}
