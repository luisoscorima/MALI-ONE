/**
 * Seed de catálogos Portafolio (tipos/estados de tarea + estados de proyecto).
 * Uso: pnpm --filter @mali-one/api prisma:seed:todos
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TYPES = [
  { name: 'Proyecto', color: '#22c55e', sortOrder: 0 },
  { name: 'Mejora', color: '#3b82f6', sortOrder: 1 },
  { name: 'Soporte', color: '#eab308', sortOrder: 2 },
  { name: 'Incidente', color: '#ef4444', sortOrder: 3 },
  { name: 'Investigación', color: '#a855f7', sortOrder: 4 },
  { name: 'Reunión', color: '#94a3b8', sortOrder: 5 },
];

const LEGACY_TYPES = ['General', 'Operaciones', 'Contenido', 'Sistemas'];

const DEFAULT_STATUSES = [
  { key: 'pending', name: 'Pendiente', color: '#dc2626', isDone: false, sortOrder: 0 },
  { key: 'doing', name: 'En curso', color: '#ca8a04', isDone: false, sortOrder: 1 },
  { key: 'blocked', name: 'Bloqueado', color: '#9333ea', isDone: false, sortOrder: 2 },
  { key: 'done', name: 'Hecho', color: '#16a34a', isDone: true, sortOrder: 3 },
];

const DEFAULT_PROJECT_STATUSES = [
  { key: 'backlog', name: 'Backlog', color: '#dc2626', isClosed: false, sortOrder: 0 },
  { key: 'planned', name: 'Planificado', color: '#dc2626', isClosed: false, sortOrder: 1 },
  { key: 'active', name: 'En ejecución', color: '#ca8a04', isClosed: false, sortOrder: 2 },
  { key: 'blocked', name: 'Bloqueado', color: '#9333ea', isClosed: false, sortOrder: 3 },
  { key: 'closed', name: 'Cerrado', color: '#16a34a', isClosed: true, sortOrder: 4 },
];

async function main() {
  for (const type of DEFAULT_TYPES) {
    await prisma.todoType.upsert({
      where: { name: type.name },
      create: type,
      update: { color: type.color, sortOrder: type.sortOrder, active: true },
    });
  }
  for (const name of LEGACY_TYPES) {
    await prisma.todoType.updateMany({
      where: { name },
      data: { active: false },
    });
  }
  console.log(`Upserted ${DEFAULT_TYPES.length} todo types`);

  for (const status of DEFAULT_STATUSES) {
    await prisma.todoStatus.upsert({
      where: { key: status.key },
      create: status,
      update: { color: status.color },
    });
  }
  console.log(`Upserted ${DEFAULT_STATUSES.length} todo statuses`);

  for (const status of DEFAULT_PROJECT_STATUSES) {
    await prisma.portfolioProjectStatus.upsert({
      where: { key: status.key },
      create: status,
      update: { color: status.color },
    });
  }
  console.log(`Upserted ${DEFAULT_PROJECT_STATUSES.length} project statuses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
