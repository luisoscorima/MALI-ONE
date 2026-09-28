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

const REF_TOKEN = String.raw`ref:[a-zA-Z0-9_-]+`;
const WHATSAPP_REF_PREFIX_RE = new RegExp(
  String.raw`^\s*${REF_TOKEN}(?:\s*[·•\-–—]\s*|\s+)?`,
  'i',
);
const WHATSAPP_REF_SUFFIX_RE = new RegExp(
  String.raw`\s*[·•\-–—]?\s*${REF_TOKEN}\s*$`,
  'i',
);

function stripWhatsappRef(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(WHATSAPP_REF_PREFIX_RE, '')
    .replace(WHATSAPP_REF_SUFFIX_RE, '')
    .trim();
}

const prisma = new PrismaClient();

type AreaSeed = {
  slug: string;
  nombre: string;
  parentSlug?: string;
  whatsappArea?: string | null;
  sortOrder: number;
  cursos: string[];
};

type ProgramaSeed = {
  nombre: string;
  reemplazaCurso?: string;
  cursos: string[];
};

type MatchTarget = {
  kind: 'curso' | 'programa';
  id: string;
  phrase: string;
  normalized: string;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function prefillText(targetUrl: string) {
  try {
    return stripWhatsappRef(new URL(targetUrl).searchParams.get('text'));
  } catch {
    return '';
  }
}

function containsPhrase(text: string, phrase: string) {
  if (!phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

async function main() {
  const { areas, programas } = JSON.parse(
    readFileSync(join(__dirname, 'seed-data', 'educacion-catalog-areas.json'), 'utf8'),
  ) as { areas: AreaSeed[]; programas?: ProgramaSeed[] };

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

  let programasNuevos = 0;
  for (const programa of programas ?? []) {
    const existing = await prisma.educacionCatalogPrograma.findFirst({
      where: { nombre: programa.nombre },
      select: { id: true },
    });
    const row = existing
      ? await prisma.educacionCatalogPrograma.update({
          where: { id: existing.id },
          data: { activo: true },
        })
      : await prisma.educacionCatalogPrograma.create({
          data: { nombre: programa.nombre, sortOrder: programasNuevos, activo: true },
        });
    if (!existing) programasNuevos += 1;

    if (programa.reemplazaCurso) {
      const curso = await prisma.educacionCatalogCurso.findFirst({
        where: { nombre: programa.reemplazaCurso },
        select: { id: true },
      });
      if (curso) {
        await prisma.shortLink.updateMany({
          where: { catalogCursoId: curso.id, catalogProgramaId: null },
          data: { catalogProgramaId: row.id },
        });
        await prisma.shortLink.updateMany({
          where: { catalogCursoId: curso.id },
          data: { catalogCursoId: null },
        });
        await prisma.educacionCatalogCurso.delete({ where: { id: curso.id } });
      }
    }

    if (programa.cursos.length > 0) {
      const cursoIds: string[] = [];
      for (const nombre of programa.cursos) {
        const curso = await prisma.educacionCatalogCurso.findFirst({
          where: { nombre },
          select: { id: true },
        });
        if (!curso) throw new Error(`Curso no encontrado para el programa «${programa.nombre}»: ${nombre}`);
        cursoIds.push(curso.id);
      }
      await prisma.educacionCatalogProgramaCurso.deleteMany({ where: { programaId: row.id } });
      await prisma.educacionCatalogProgramaCurso.createMany({
        data: cursoIds.map((cursoId, sortOrder) => ({ programaId: row.id, cursoId, sortOrder })),
      });
    }
  }

  const whatsapp = await linkWhatsappCatalog(programas ?? []);

  console.log(
    `Catálogo educación: ${areas.length} áreas/líneas, ${created} cursos nuevos, ${linked} cursos actualizados, ${programasNuevos} programas nuevos.`,
  );
  console.log(
    `Enlaces WhatsApp: ${whatsapp.matched} vinculados, ${whatsapp.skipped} ya tenían curso o programa, ${whatsapp.ambiguous} ambiguos.`,
  );
  for (const line of whatsapp.ambiguousLines) {
    console.log(`  ambiguo ${line}`);
  }
}

async function linkWhatsappCatalog(programas: ProgramaSeed[]) {
  const [cursos, programasDb, links] = await Promise.all([
    prisma.educacionCatalogCurso.findMany({ select: { id: true, nombre: true } }),
    prisma.educacionCatalogPrograma.findMany({ select: { id: true, nombre: true } }),
    prisma.shortLink.findMany({
      where: { type: 'WHATSAPP' },
      select: { id: true, slug: true, targetUrl: true, catalogCursoId: true, catalogProgramaId: true },
    }),
  ]);

  const targets: MatchTarget[] = [];
  for (const curso of cursos) {
    const normalized = normalizeName(curso.nombre);
    if (normalized) targets.push({ kind: 'curso', id: curso.id, phrase: curso.nombre, normalized });
  }
  for (const programa of programasDb) {
    const normalized = normalizeName(programa.nombre);
    if (normalized) targets.push({ kind: 'programa', id: programa.id, phrase: programa.nombre, normalized });
  }
  for (const programa of programas) {
    if (!programa.reemplazaCurso) continue;
    const row = programasDb.find((item) => item.nombre === programa.nombre);
    const normalized = normalizeName(programa.reemplazaCurso);
    if (!row || !normalized) continue;
    targets.push({ kind: 'programa', id: row.id, phrase: programa.reemplazaCurso, normalized });
  }
  targets.sort((a, b) => b.normalized.length - a.normalized.length);

  let matched = 0;
  let skipped = 0;
  const ambiguousLines: string[] = [];

  for (const link of links) {
    if (link.catalogCursoId || link.catalogProgramaId) {
      skipped += 1;
      continue;
    }
    const text = normalizeName(prefillText(link.targetUrl));
    if (!text) continue;
    const hits = targets.filter((target) => containsPhrase(text, target.normalized));
    if (hits.length === 0) continue;
    const bestLength = hits[0].normalized.length;
    const winners = new Map<string, MatchTarget>();
    for (const hit of hits) {
      if (hit.normalized.length !== bestLength) continue;
      winners.set(`${hit.kind}:${hit.id}`, hit);
    }
    if (winners.size !== 1) {
      ambiguousLines.push(
        `${link.slug}: ${[...winners.values()].map((item) => item.phrase).join(' | ')}`,
      );
      continue;
    }
    const winner = [...winners.values()][0];
    await prisma.shortLink.update({
      where: { id: link.id },
      data: winner.kind === 'curso'
        ? { catalogCursoId: winner.id }
        : { catalogProgramaId: winner.id },
    });
    matched += 1;
  }

  return { matched, skipped, ambiguous: ambiguousLines.length, ambiguousLines };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
