import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PagoEfectivoPaymentQueryDto } from './dto/treasury.dto';

const vaultRuntime = ['FINANCE_VAULT_URL', 'FINANCE_VAULT_CLIENT_ID', 'FINANCE_VAULT_CLIENT_SECRET',
  'FINANCE_VAULT_MASTER_PASSWORD', 'FINANCE_RUNTIME_NODE', 'FINANCE_CREDENTIALS_SCRIPT'];
type Credentials = { accessKey: string; secretKey: string; serviceId: string };

@Injectable()
export class PagoEfectivoSyncService {
  constructor(private readonly prisma: PrismaService) {}

  private async source(sourceId: string) {
    const source = await this.prisma.treasurySource.findFirst({ where: { id: sourceId, provider: 'pagoefectivo', active: true } });
    if (!source) throw new BadRequestException('Fuente PagoEfectivo activa no encontrada.');
    return source;
  }

  async status(sourceId: string) {
    const [source, lastRun] = await Promise.all([this.source(sourceId),
      this.prisma.pagoEfectivoSyncState.findUnique({ where: { sourceId } })]);
    if (lastRun?.status === 'running' && (!lastRun.leaseUntil || lastRun.leaseUntil < new Date())) lastRun.status = 'interrupted';
    return {
      configured: vaultRuntime.every(key => !!process.env[key]) && !!source.vaultItemId,
      connected: false,
      lastRun,
    };
  }

  async start(sourceId: string) {
    const source = await this.source(sourceId);
    if (!vaultRuntime.every(key => !!process.env[key])) {
      throw new ServiceUnavailableException('Configura el acceso a Vaultwarden y el runtime en el servidor.');
    }
    if (!source.vaultItemId) throw new ServiceUnavailableException('Configura el elemento de Vaultwarden de esta fuente.');
    try {
      await this.credentials(source.vaultItemId);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'VAULT_ITEM' || code === 'PE_CREDENTIALS') {
        throw new ServiceUnavailableException('El ítem de Vaultwarden debe incluir accessKey, secretKey e idService.');
      }
      if (code === 'VAULT_AUTH' || code === 'VAULT_UNLOCK') throw new ServiceUnavailableException('No se pudo abrir Vaultwarden.');
      throw new ServiceUnavailableException('No se pudieron leer las credenciales de PagoEfectivo.');
    }
    return { ready: true as const };
  }

  private credentials(itemId: string): Promise<Credentials> {
    return new Promise((resolve, reject) => execFile(process.env.FINANCE_RUNTIME_NODE!,
      [process.env.FINANCE_CREDENTIALS_SCRIPT!], { timeout: 90000, maxBuffer: 65536, env: {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME,
        FINANCE_VAULT_URL: process.env.FINANCE_VAULT_URL,
        FINANCE_VAULT_CLIENT_ID: process.env.FINANCE_VAULT_CLIENT_ID,
        FINANCE_VAULT_CLIENT_SECRET: process.env.FINANCE_VAULT_CLIENT_SECRET,
        FINANCE_VAULT_MASTER_PASSWORD: process.env.FINANCE_VAULT_MASTER_PASSWORD,
        FINANCE_VAULT_ITEM_ID: itemId, FINANCE_PROVIDER: 'pagoefectivo',
      } }, (error, stdout) => {
        try {
          const result = JSON.parse(stdout);
          const safe = ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM'];
          if (error || result.error || !result.accessKey || !result.secretKey || !result.serviceId) {
            throw new Error(safe.includes(result.error) ? result.error : 'PE_CREDENTIALS');
          }
          resolve(result);
        } catch (cause) {
          reject(cause instanceof Error && ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'PE_CREDENTIALS'].includes(cause.message)
            ? cause : new Error('PE_CREDENTIALS'));
        }
      }));
  }

  async listPayments(sourceId: string, query: PagoEfectivoPaymentQueryDto) {
    await this.source(sourceId);
    const page = query.page ?? 1;
    const search = query.q?.trim();
    const where: Prisma.PagoEfectivoPaymentWhereInput = { sourceId,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ transactionId: { contains: search } }, { cip: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } }, { payerName: { contains: search, mode: 'insensitive' } },
        { payerEmail: { contains: search, mode: 'insensitive' } }, { externalReference: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(query.from || query.to ? { createdAtPe: {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00-05:00`) } : {}),
        ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000) } : {}),
      } } : {}) };
    const [total, payments, states] = await this.prisma.$transaction([
      this.prisma.pagoEfectivoPayment.count({ where }),
      this.prisma.pagoEfectivoPayment.findMany({ where, orderBy: [{ createdAtPe: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50 }),
      this.prisma.pagoEfectivoPayment.findMany({ where: { sourceId }, distinct: ['status'], select: { status: true }, orderBy: { status: 'asc' } }),
    ]);
    return { total, page, pageSize: 50, states: states.map(item => item.status), payments: payments.map(payment => ({ ...payment,
      amount: payment.amount.toFixed(2), feeAmount: payment.feeAmount?.toFixed(2) ?? null, netAmount: payment.netAmount?.toFixed(2) ?? null })) };
  }
}
