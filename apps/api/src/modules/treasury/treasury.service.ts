import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TREASURY_PROVIDERS, TreasuryOverviewDto } from '@mali-one/shared';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TreasurySourceInputDto, TreasuryTargetInputDto } from './dto/treasury.dto';

type Actor = Pick<User, 'id' | 'email'>;

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<TreasuryOverviewDto> {
    const sources = await this.prisma.treasurySource.findMany({
      orderBy: [{ provider: 'asc' }, { name: 'asc' }],
      include: { targets: { orderBy: [{ name: 'asc' }, { currency: 'asc' }] } },
    });
    return {
      providers: TREASURY_PROVIDERS,
      syncIntervalMinutes: 60,
      timezone: 'America/Lima',
      collectionEnabled: false,
      sources: sources.map((source) => ({
        ...source,
        connectorStatus: 'pending',
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
        targets: source.targets.map(({ id, sourceId, kind, name, reference, currency, active }) =>
          ({ id, sourceId, kind, name, reference, currency, active })),
      })),
    };
  }

  async saveSource(actor: Actor, input: TreasurySourceInputDto, id?: string) {
    return this.handleConflict(() => this.prisma.$transaction(async (tx) => {
      const existing = id ? await tx.treasurySource.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new NotFoundException('Fuente no encontrada');
      // A source identifies one portal for its lifetime; changing it would reassign its accounts.
      if (existing && existing.provider !== input.provider) {
        throw new BadRequestException('La entidad y el portal no se pueden cambiar. Registra otra fuente.');
      }
      const source = id
        ? await tx.treasurySource.update({ where: { id }, data: input })
        : await tx.treasurySource.create({ data: input });
      await this.audit(tx, actor, id ? 'TREASURY_SOURCE_UPDATED' : 'TREASURY_SOURCE_CREATED', {
        sourceId: source.id,
        provider: source.provider,
        before: existing ? { name: existing.name, legalEntity: existing.legalEntity, active: existing.active } : null,
        after: { name: source.name, legalEntity: source.legalEntity, active: source.active },
      });
      return { id: source.id };
    }));
  }

  async saveTarget(actor: Actor, sourceId: string, input: TreasuryTargetInputDto, id?: string) {
    return this.handleConflict(() => this.prisma.$transaction(async (tx) => {
      const source = await tx.treasurySource.findUnique({ where: { id: sourceId } });
      if (!source) throw new NotFoundException('Fuente no encontrada');
      const provider = TREASURY_PROVIDERS.find((item) => item.id === source.provider)!;
      const existing = id ? await tx.treasuryTarget.findFirst({ where: { id, sourceId } }) : null;
      if (id && !existing) throw new NotFoundException('Cuenta o comercio no encontrado en esta fuente');
      const data = { ...input, kind: provider.targetKind };
      const target = id
        ? await tx.treasuryTarget.update({ where: { id }, data })
        : await tx.treasuryTarget.create({ data: { ...data, sourceId } });
      // Account references stay out of the general admin audit log.
      await this.audit(tx, actor, id ? 'TREASURY_TARGET_UPDATED' : 'TREASURY_TARGET_CREATED', {
        sourceId, targetId: target.id, kind: target.kind,
        before: existing ? { name: existing.name, currency: existing.currency, active: existing.active } : null,
        after: { name: target.name, currency: target.currency, active: target.active },
        referenceChanged: existing ? existing.reference !== target.reference : false,
      });
      return { id: target.id };
    }));
  }

  private audit(tx: Prisma.TransactionClient, actor: Actor, action: string, payload: Prisma.InputJsonObject) {
    return tx.adminAuditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action, payload } });
  }

  private async handleConflict<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una fuente con ese nombre en el portal, o una cuenta/comercio con esa referencia y moneda en la fuente.');
      }
      throw error;
    }
  }
}
