/**
 * Áreas, líneas y cursos del catálogo de Educación.
 * Idempotente: vuelve a ejecutar sin duplicar. No borra cursos creados a mano.
 * Manual: pnpm --filter @mali-one/api prisma:seed:catalog
 *
 * La lista de Extensión Profesional no separa MALI Diseño, así que esos cursos
 * quedan en la línea Arte y Cultura. Diseño y Comunicaciones se crea vacía.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type AreaSeed = {
  slug: string;
  nombre: string;
  parentSlug?: string;
  whatsappArea?: string | null;
  sortOrder: number;
  cursos: string[];
};

async function main() {
  const { areas } = JSON.parse(
    readFileSync(join(__dirname, 'seed-data', 'educacion-catalog-areas.json'), 'utf8'),
  ) as { areas: AreaSeed[] };

  const ids = new Map<string, string>();

  for (const area of areas) {
    const row = await prisma.educacionCatalogArea.upsert({
      where: { slug: area.slug },
      create: {
        slug: area.slug,
        nombre: area.nombre,
        whatsappArea: area.parentSlug ? null : area.whatsappArea ?? null,
        sortOrder: area.sortOrder,
        activo: true,
      },
      update: {
        nombre: area.nombre,
        whatsappArea: area.parentSlug ? null : area.whatsappArea ?? null,
        sortOrder: area.sortOrder,
        activo: true,
      },
    });
    ids.set(area.slug, row.id);
  }

  for (const area of areas) {
    const parentId = area.parentSlug ? ids.get(area.parentSlug) ?? null : null;
    if (area.parentSlug && !parentId) {
      throw new Error(`Área padre desconocida: ${area.parentSlug}`);
    }
    await prisma.educacionCatalogArea.update({
      where: { slug: area.slug },
      data: { parentId },
    });
  }

  let created = 0;
  let linked = 0;
  for (const area of areas) {
    const areaId = ids.get(area.slug);
    if (!areaId) continue;
    for (const [index, nombre] of area.cursos.entries()) {
      const existing = await prisma.educacionCatalogCurso.findFirst({
        where: { nombre },
        select: { id: true },
      });
      if (existing) {
        await prisma.educacionCatalogCurso.update({
          where: { id: existing.id },
          data: { areaId, sortOrder: index, activo: true },
        });
        linked += 1;
      } else {
        await prisma.educacionCatalogCurso.create({
          data: { nombre, areaId, sortOrder: index, activo: true },
        });
        created += 1;
      }
    }
  }

  console.log(
    `Catálogo educación: ${areas.length} áreas/líneas, ${created} cursos nuevos, ${linked} cursos actualizados.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
