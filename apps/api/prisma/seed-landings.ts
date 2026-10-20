import { Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_GESTION_CULTURAL_LANDING_CONTENT,
  upgradeGestionCulturalLanding,
  type LandingDocument,
} from '@mali-one/shared';

const prisma = new PrismaClient();

function upgradePilotContent(value: Prisma.JsonValue): LandingDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const current = value as unknown as LandingDocument;
  if (!Array.isArray(current.blocks)) return null;
  const upgraded = upgradeGestionCulturalLanding(current);
  return JSON.stringify(current) === JSON.stringify(upgraded) ? null : upgraded;
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
