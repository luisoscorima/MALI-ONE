/**
 * Seed de catálogos TODO (tipos y estados).
 * Uso: pnpm --filter @mali-one/api prisma:seed:todos
 * También se auto-siembra al primer GET /api/todos/meta si faltan filas.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TYPES = [
  { name: 'General', color: '#64748b', sortOrder: 0 },
  { name: 'Operaciones', color: '#2563eb', sortOrder: 1 },
  { name: 'Contenido', color: '#7c3aed', sortOrder: 2 },
  { name: 'Sistemas', color: '#059669', sortOrder: 3 },
];

const DEFAULT_STATUSES = [
  { key: 'pending', name: 'Pendiente', color: '#94a3b8', isDone: false, sortOrder: 0 },
  { key: 'doing', name: 'En curso', color: '#3b82f6', isDone: false, sortOrder: 1 },
  { key: 'blocked', name: 'Bloqueado', color: '#f59e0b', isDone: false, sortOrder: 2 },
  { key: 'done', name: 'Hecho', color: '#22c55e', isDone: true, sortOrder: 3 },
];

async function main() {
  for (const type of DEFAULT_TYPES) {
    await prisma.todoType.upsert({
      where: { name: type.name },
      create: type,
      update: {},
    });
  }
  console.log(`Upserted ${DEFAULT_TYPES.length} todo types`);

  for (const status of DEFAULT_STATUSES) {
    await prisma.todoStatus.upsert({
      where: { key: status.key },
      create: status,
      update: {},
    });
  }
  console.log(`Upserted ${DEFAULT_STATUSES.length} todo statuses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
