import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

type LookupHit = {
  provider: 'niubiz' | 'paycash' | 'mercadopago';
  providerPaymentId: string;
  transactionCode: string;
  amount: number;
  currency: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  transactedAt: string | null;
};

@Injectable()
export class EducacionSaleService {
  constructor(private readonly prisma: PrismaService) {}

  getByCycle(waCycleId: number) {
    return this.prisma.educacionSale.findUnique({
      where: { waCycleId },
      include: { items: true, applications: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async upsertSale(input: {
    waCycleId: number;
    waContactId?: number | null;
    advisorEmail?: string;
    amountAgreed: number;
    currency?: string;
    itemLabel: string;
    catalogRef?: string;
    buyerName?: string;
    studentName?: string;
    payerName?: string;
    notes?: string;
  }) {
    if (!(input.amountAgreed > 0)) {
      throw new BadRequestException('amountAgreed debe ser > 0');
    }
    const amount = new Prisma.Decimal(input.amountAgreed);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.educacionSale.findUnique({
        where: { waCycleId: input.waCycleId },
      });
      if (existing) {
        await tx.educacionSaleItem.deleteMany({ where: { saleId: existing.id } });
        return tx.educacionSale.update({
          where: { id: existing.id },
          data: {
            waContactId: input.waContactId ?? existing.waContactId,
            advisorEmail: input.advisorEmail ?? existing.advisorEmail,
            amountAgreed: amount,
            currency: input.currency ?? existing.currency,
            buyerName: input.buyerName ?? existing.buyerName,
            studentName: input.studentName ?? existing.studentName,
            payerName: input.payerName ?? existing.payerName,
            notes: input.notes ?? existing.notes,
            items: {
              create: [{
                label: input.itemLabel.trim() || 'Curso',
                catalogRef: input.catalogRef ?? null,
                amount,
              }],
            },
          },
          include: { items: true, applications: true },
        });
      }
      return tx.educacionSale.create({
        data: {
          waCycleId: input.waCycleId,
          waContactId: input.waContactId ?? null,
          advisorEmail: input.advisorEmail ?? null,
          amountAgreed: amount,
          currency: input.currency ?? 'PEN',
          buyerName: input.buyerName ?? null,
          studentName: input.studentName ?? null,
          payerName: input.payerName ?? null,
          notes: input.notes ?? null,
          items: {
            create: [{
              label: input.itemLabel.trim() || 'Curso',
              catalogRef: input.catalogRef ?? null,
              amount,
            }],
          },
        },
        include: { items: true, applications: true },
      });
    });
  }

  /** Lookup asesor-safe: prefijo/parcial; no lista Treasury completa. */
  async lookupTransaction(
    code: string,
    provider?: 'niubiz' | 'paycash' | 'mercadopago' | 'all',
  ): Promise<{ hits: LookupHit[] }> {
    const q = String(code ?? '').trim();
    if (q.length < 4) throw new BadRequestException('Código demasiado corto');
    const scope = provider && provider !== 'all' ? provider : 'all';

    const [niubiz, paycash, mp] = await Promise.all([
      scope === 'all' || scope === 'niubiz'
        ? this.prisma.treasuryPayment.findMany({
            where: {
              OR: [
                { transactionCode: { startsWith: q, mode: 'insensitive' } },
                { orderNumber: { startsWith: q, mode: 'insensitive' } },
                { transactionCode: { contains: q, mode: 'insensitive' } },
                { orderNumber: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 15,
            orderBy: { transactedAt: 'desc' },
          })
        : Promise.resolve([]),
      scope === 'all' || scope === 'paycash'
        ? this.prisma.niubizPayCashPayment.findMany({
            where: {
              OR: [
                { cip: { startsWith: q, mode: 'insensitive' } },
                { cip: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 15,
            orderBy: { paidAt: 'desc' },
          })
        : Promise.resolve([]),
      scope === 'all' || scope === 'mercadopago'
        ? this.prisma.mercadoPagoPayment.findMany({
            where: {
              OR: [
                { paymentId: { startsWith: q } },
                { paymentId: { contains: q } },
                { externalReference: { startsWith: q, mode: 'insensitive' } },
                { externalReference: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 15,
            orderBy: { createdAtMp: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const hits: LookupHit[] = [
      ...niubiz.map((p) => ({
        provider: 'niubiz' as const,
        providerPaymentId: p.id,
        transactionCode: p.transactionCode,
        amount: Number(p.amount),
        currency: String(p.currency),
        status: p.status,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        transactedAt: p.transactedAt?.toISOString() ?? null,
      })),
      ...paycash.map((p) => ({
        provider: 'paycash' as const,
        providerPaymentId: p.id,
        transactionCode: p.cip,
        amount: Number(p.amount),
        currency: String(p.currency),
        status: p.status,
        customerName: null,
        customerEmail: p.customerEmail,
        transactedAt: (p.paidAt ?? p.purchasedAt)?.toISOString() ?? null,
      })),
      ...mp.map((p) => ({
        provider: 'mercadopago' as const,
        providerPaymentId: p.id,
        transactionCode: p.externalReference || p.paymentId,
        amount: Number(p.grossAmount),
        currency: String(p.currency || 'PEN'),
        status: p.status,
        customerName: p.payerName,
        customerEmail: p.payerEmail,
        transactedAt: p.createdAtMp?.toISOString() ?? null,
      })),
    ];
    return { hits };
  }

  async associateCode(input: {
    waCycleId: number;
    waContactId?: number | null;
    transactionCode: string;
    amountAgreed?: number;
    itemLabel?: string;
    actorEmail: string;
  }) {
    const { hits } = await this.lookupTransaction(input.transactionCode);
    const hit = hits[0];
    if (!hit) {
      throw new NotFoundException('No se encontró la operación en Treasury');
    }
    const amount = input.amountAgreed && input.amountAgreed > 0
      ? input.amountAgreed
      : hit.amount;
    const sale = await this.upsertSale({
      waCycleId: input.waCycleId,
      waContactId: input.waContactId,
      advisorEmail: input.actorEmail,
      amountAgreed: amount,
      itemLabel: input.itemLabel || 'Curso',
    });
    await this.prisma.educacionSale.update({
      where: { id: sale.id },
      data: { reportedTxnCode: hit.transactionCode },
    });
    return { sale: await this.getByCycle(input.waCycleId), candidate: hit };
  }

  async applyPayment(input: {
    saleId: string;
    provider: 'niubiz' | 'paycash' | 'mercadopago';
    providerPaymentId: string;
    transactionCode: string;
    amountApplied: number;
    currency?: string;
    actorEmail: string;
  }) {
    if (!(input.amountApplied > 0)) {
      throw new BadRequestException('amountApplied debe ser > 0');
    }
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.educacionSale.findUnique({
        where: { id: input.saleId },
        include: { applications: { where: { reversedAt: null } } },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');

      const already = sale.applications.find(
        (a) => a.provider === input.provider && a.providerPaymentId === input.providerPaymentId,
      );
      if (already) {
        throw new BadRequestException('Esta operación ya está aplicada a la venta');
      }

      const applied = sale.applications.reduce(
        (sum, row) => sum + Number(row.amountApplied),
        0,
      );
      const next = applied + input.amountApplied;
      const agreed = Number(sale.amountAgreed);
      if (next > agreed + 0.009) {
        throw new BadRequestException('El importe aplicado supera el saldo de la venta');
      }

      await tx.educacionPaymentApplication.create({
        data: {
          saleId: sale.id,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          transactionCode: input.transactionCode,
          amountApplied: new Prisma.Decimal(input.amountApplied),
          currency: input.currency ?? sale.currency,
          validatedByEmail: input.actorEmail,
        },
      });

      const paymentStatus = next >= agreed - 0.009 ? 'pagado' : 'parcial';
      return tx.educacionSale.update({
        where: { id: sale.id },
        data: {
          paymentStatus,
          reportedTxnCode: input.transactionCode,
        },
        include: { items: true, applications: { orderBy: { createdAt: 'desc' } } },
      });
    });
  }

  async reverseApplication(applicationId: string, input: {
    actorEmail: string;
    reason?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.educacionPaymentApplication.findUnique({
        where: { id: applicationId },
        include: { sale: { include: { applications: { where: { reversedAt: null } } } } },
      });
      if (!app) throw new NotFoundException('Aplicación no encontrada');
      if (app.reversedAt) throw new BadRequestException('Ya estaba revertida');
      await tx.educacionPaymentApplication.update({
        where: { id: applicationId },
        data: {
          reversedAt: new Date(),
          reversedByEmail: input.actorEmail,
          reverseReason: input.reason?.trim() || null,
        },
      });
      const remaining = app.sale.applications
        .filter((row) => row.id !== applicationId)
        .reduce((sum, row) => sum + Number(row.amountApplied), 0);
      const agreed = Number(app.sale.amountAgreed);
      const paymentStatus = remaining <= 0.009
        ? 'sin_verificar'
        : remaining >= agreed - 0.009
          ? 'pagado'
          : 'parcial';
      return tx.educacionSale.update({
        where: { id: app.saleId },
        data: { paymentStatus },
        include: { items: true, applications: { orderBy: { createdAt: 'desc' } } },
      });
    });
  }

  /** F5: subflujo boleteo mínimo. */
  async patchBilling(saleId: string, input: {
    billingStatus: 'pending' | 'obs' | 'obs_asesor' | 'boleteado';
    billingNote?: string;
    enrollmentRef?: string;
  }) {
    const sale = await this.prisma.educacionSale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return this.prisma.educacionSale.update({
      where: { id: saleId },
      data: {
        billingStatus: input.billingStatus,
        billingNote: input.billingNote ?? sale.billingNote,
        enrollmentRef: input.enrollmentRef ?? sale.enrollmentRef,
        enrollmentAt: input.billingStatus === 'boleteado' && !sale.enrollmentAt
          ? new Date()
          : sale.enrollmentAt,
      },
    });
  }
}
