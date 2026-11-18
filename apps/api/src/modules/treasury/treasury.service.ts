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
      include: { targets: { orderBy: [{ name: 'asc' }, { reference: 'asc' }] } },
    });
    return {
      providers: TREASURY_PROVIDERS,
      syncIntervalMinutes: 15,
      timezone: 'America/Lima',
      collectionEnabled: false,
      sources: sources.map((source) => ({
        ...source,
        connectorStatus: 'pending' as const,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
        targets: source.targets.map((target) => ({
          id: target.id,
          sourceId: target.sourceId,
          kind: target.kind,
          name: target.name,
          reference: target.reference,
          externalName: target.externalName,
          currency: target.currency,
          active: target.active,
          paycashEnabled: target.paycashEnabled,
        })),
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
      const providerMeta = TREASURY_PROVIDERS.find((item) => item.id === input.provider);
      const legalEntity =
        input.legalEntity?.trim() ||
        existing?.legalEntity ||
        providerMeta?.entity ||
        input.name;
      const vaultItemId =
        input.vaultItemId === undefined
          ? existing?.vaultItemId ?? null
          : input.vaultItemId;
      const data = {
        provider: input.provider,
        name: input.name,
        active: input.active,
        legalEntity,
        vaultItemId,
      };
      const source = id
        ? await tx.treasurySource.update({ where: { id }, data })
        : await tx.treasurySource.create({ data });
      await this.audit(tx, actor, id ? 'TREASURY_SOURCE_UPDATED' : 'TREASURY_SOURCE_CREATED', {
        sourceId: source.id,
        provider: source.provider,
        before: existing
          ? {
              name: existing.name,
              legalEntity: existing.legalEntity,
              active: existing.active,
              vaultItemId: existing.vaultItemId,
            }
          : null,
        after: {
          name: source.name,
          legalEntity: source.legalEntity,
          active: source.active,
          vaultItemId: source.vaultItemId,
        },
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
      if (existing && existing.reference !== input.reference) {
        throw new BadRequestException('El código o referencia no se puede cambiar. Crea otro registro.');
      }

      const kind = provider.targetKind;
      if (kind === 'bank_account') {
        if (!input.currency) throw new BadRequestException('La moneda es obligatoria para cuentas bancarias.');
      }
      if (kind === 'merchant' && source.provider === 'niubiz_sales') {
        if (!/^\d{9}$/.test(input.reference)) {
          throw new BadRequestException('El código Niubiz debe tener 9 dígitos.');
        }
      }

      const paycashEnabled = kind === 'merchant' && source.provider === 'niubiz_sales'
        ? !!input.paycashEnabled
        : false;

      if (existing?.active && input.active === false) {
        const activeCount = await tx.treasuryTarget.count({
          where: { sourceId, kind: 'merchant', active: true, NOT: { id: existing.id } },
        });
        if (source.provider === 'niubiz_sales' && kind === 'merchant' && activeCount === 0) {
          throw new BadRequestException('Debe quedar al menos un comercio Niubiz activo.');
        }
        if (existing.paycashEnabled) {
          throw new BadRequestException(
            'Reasigna PagoEfectivo (CIP) a otro comercio antes de desactivar este.',
          );
        }
      }

      if (paycashEnabled) {
        await tx.treasuryTarget.updateMany({
          where: { sourceId, paycashEnabled: true, ...(id ? { NOT: { id } } : {}) },
          data: { paycashEnabled: false },
        });
      }

      // Portal name comes from Niubiz sync/import, never from the form.
      const externalName = existing ? existing.externalName : null;

      const data = {
        name: input.name,
        reference: input.reference,
        externalName,
        currency: kind === 'bank_account' ? input.currency! : null,
        active: input.active,
        paycashEnabled,
        kind,
      };

      const target = id
        ? await tx.treasuryTarget.update({ where: { id }, data })
        : await tx.treasuryTarget.create({ data: { ...data, sourceId } });

      await this.audit(tx, actor, id ? 'TREASURY_TARGET_UPDATED' : 'TREASURY_TARGET_CREATED', {
        sourceId, targetId: target.id, kind: target.kind,
        before: existing
          ? {
              name: existing.name,
              externalName: existing.externalName,
              currency: existing.currency,
              active: existing.active,
              paycashEnabled: existing.paycashEnabled,
            }
          : null,
        after: {
          name: target.name,
          externalName: target.externalName,
          currency: target.currency,
          active: target.active,
          paycashEnabled: target.paycashEnabled,
        },
        referenceChanged: false,
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
        throw new ConflictException('Ya existe una fuente con ese nombre en el portal, o una cuenta/comercio con esa referencia en la fuente.');
      }
      throw error;
    }
  }
}
