import { Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_GESTION_CULTURAL_LANDING_CONTENT,
  type LandingBlock,
  type LandingDocument,
} from '@mali-one/shared';

const prisma = new PrismaClient();

const PILOT_VISUAL_BLOCKS = new Set(['docentes', 'experiencia-mali']);

function upgradePilotContent(value: Prisma.JsonValue): LandingDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const current = value as unknown as LandingDocument;
  if (!Array.isArray(current.blocks)) return null;

  const blocks = [...current.blocks];
  const defaultBlocks = DEFAULT_GESTION_CULTURAL_LANDING_CONTENT.blocks.filter(
    (block) => PILOT_VISUAL_BLOCKS.has(block.id),
  );
  let changed = false;

  for (const block of defaultBlocks) {
    if (blocks.some((item) => item.id === block.id)) continue;
    const anchorId = block.id === 'docentes' ? 'metodologia' : 'docentes';
    const anchorIndex = blocks.findIndex((item) => item.id === anchorId);
    const insertionIndex = anchorIndex >= 0 ? anchorIndex + 1 : blocks.length;
    blocks.splice(insertionIndex, 0, block as LandingBlock);
    changed = true;
  }

  return changed ? { ...current, blocks } : null;
}

async function main() {
  const slug = 'gestion-cultural';
  const existing = await prisma.landingPage.findUnique({ where: { slug } });
  if (!existing) {
    await prisma.landingPage.create({
      data: {
        slug,
        name: 'Gestión Cultural',
        seoTitle:
          'Programa de Especialización en Gestión Cultural | MALI Educación',
        seoDescription:
          'Estudia Gestión Cultural en el Museo de Arte de Lima. Fórmate para diseñar y liderar proyectos culturales de gran impacto.',
        ogImageUrl:
          'https://educacion.mali.pe/wp-content/uploads/2025/11/Gestion-Cultural.webp',
        content:
          DEFAULT_GESTION_CULTURAL_LANDING_CONTENT as unknown as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const upgradedContent = upgradePilotContent(existing.content);
  if (upgradedContent) {
    await prisma.landingPage.update({
      where: { slug },
      data: {
        content: upgradedContent as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
