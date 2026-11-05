import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { readNiubizXlsx, NiubizPayment } from './niubiz-import';
import { TreasuryPaymentQueryDto } from './dto/treasury.dto';

@Injectable()
export class TreasuryPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async importXlsx(actor: { id: string; email: string }, buffer: Buffer) {
    const rows = await readNiubizXlsx(buffer);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    return this.saveRows(rows, 'niubiz_xlsx', checksum, actor);
  }

  async saveRows(rows: NiubizPayment[], origin: 'niubiz_api' | 'niubiz_xlsx', checksum: string, actor?: { id: string; email: string }) {
    return this.prisma.$transaction(async tx => {
      // Serializes imports across API instances, so counts and upserts cannot race.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(782301)`;
      const batch = await tx.treasuryPaymentImport.create({ data: {
        provider: 'niubiz_sales', origin, checksum, actorId: actor?.id ?? 'niubiz_scheduler',
        rowCount: rows.length, createdCount: 0, updatedCount: 0,
      } });
      let createdCount = 0;
      let updatedCount = 0;
      for (const row of rows) {
        const identity = { provider: 'niubiz_sales' as const, merchantCode: row.merchantCode, transactionCode: row.transactionCode };
        const old = await tx.treasuryPayment.findUnique({ where: { provider_merchantCode_transactionCode: identity } });
        const amount = new Prisma.Decimal(row.amount);
        if (!old) createdCount++;
        else if (
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
        await tx.treasuryPayment.upsert({
          where: { provider_merchantCode_transactionCode: identity },
          create: { ...row, provider: 'niubiz_sales', amount, lastImportId: batch.id },
          update: { ...row, amount, lastImportId: batch.id },
        });
      }
      await tx.treasuryPaymentImport.update({ where: { id: batch.id }, data: { createdCount, updatedCount } });
      if (actor) await tx.adminAuditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: 'TREASURY_PAYMENTS_IMPORTED', payload: { importId: batch.id, rows: rows.length, createdCount, updatedCount } } });
      return { id: batch.id, rows: rows.length, createdCount, updatedCount, unchangedCount: rows.length - createdCount - updatedCount };
    }, { maxWait: 10000, timeout: 90000 });
  }

  async list(query: TreasuryPaymentQueryDto) {
    if (query.from && query.to && query.from > query.to) throw new BadRequestException('La fecha inicial debe ser anterior o igual a la final.');
    const page = query.page ?? 1;
    // Prisma contains uses SQL LIKE: escape wildcards to search literal text.
    const search = query.q?.trim().replace(/[\\%_]/g, '\\$&');
    const where: Prisma.TreasuryPaymentWhereInput = {
      provider: 'niubiz_sales',
      ...(search ? { OR: [
        { orderNumber: { contains: search, mode: 'insensitive' as const } },
        { transactionCode: { contains: search, mode: 'insensitive' as const } },
        { customerName: { contains: search, mode: 'insensitive' as const } },
        { customerEmail: { contains: search, mode: 'insensitive' as const } },
      ] } : {}),
      ...(query.merchant ? { merchantCode: query.merchant } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to ? { transactedAt: {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00-05:00`) } : {}),
        ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00-05:00`).getTime() + 86400000) } : {}),
      } } : {}),
    };
    const [total, payments, lastImport, merchants, states] = await this.prisma.$transaction([
      this.prisma.treasuryPayment.count({ where }),
      this.prisma.treasuryPayment.findMany({ where, orderBy: [{ transactedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50 }),
      this.prisma.treasuryPaymentImport.findFirst({ where: { provider: 'niubiz_sales' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, rowCount: true, origin: true } }),
      this.prisma.treasuryPayment.findMany({ where: { provider: 'niubiz_sales' }, distinct: ['merchantCode'], select: { merchantCode: true, merchantName: true }, orderBy: { merchantCode: 'asc' } }),
      this.prisma.treasuryPayment.findMany({ where: { provider: 'niubiz_sales' }, distinct: ['status'], select: { status: true }, orderBy: { status: 'asc' } }),
    ]);
    return { total, page, pageSize: 50, lastImport, merchants, states: states.map(s => s.status), payments: payments.map(p => ({ ...p, amount: p.amount.toFixed(2) })) };
  }
}
