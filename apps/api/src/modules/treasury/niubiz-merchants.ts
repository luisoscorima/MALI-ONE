import { Prisma } from '@prisma/client';

type Db = Pick<Prisma.TransactionClient, 'treasurySource' | 'treasuryTarget'>;

export type NiubizMerchantTarget = {
  id: string;
  reference: string;
  name: string;
  externalName: string | null;
  active: boolean;
  paycashEnabled: boolean;
  sourceId: string;
};

/** Active Niubiz Comercio source (most recently updated). */
export async function resolveNiubizSource(db: Db) {
  return db.treasurySource.findFirst({
    where: { provider: 'niubiz_sales', active: true },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Catalog merchants for sync (active only) or admin listing (all). */
export async function listNiubizMerchants(db: Db, opts?: { activeOnly?: boolean }) {
  const source = await resolveNiubizSource(db);
  if (!source) return { source: null, merchants: [] as NiubizMerchantTarget[] };
  const merchants = await db.treasuryTarget.findMany({
    where: {
      sourceId: source.id,
      kind: 'merchant',
      ...(opts?.activeOnly ? { active: true } : {}),
    },
    orderBy: [{ reference: 'asc' }],
    select: {
      id: true,
      reference: true,
      name: true,
      externalName: true,
      active: true,
      paycashEnabled: true,
      sourceId: true,
    },
  });
  return { source, merchants };
}

export async function resolvePayCashMerchant(db: Db) {
  const source = await resolveNiubizSource(db);
  if (!source) return null;
  return db.treasuryTarget.findFirst({
    where: { sourceId: source.id, kind: 'merchant', paycashEnabled: true, active: true },
    select: {
      id: true,
      reference: true,
      name: true,
      externalName: true,
      active: true,
      paycashEnabled: true,
      sourceId: true,
    },
  });
}
