import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_GESTION_CULTURAL_LANDING_CONTENT } from '@mali-one/shared';

const prisma = new PrismaClient();

async function main() {
  const slug = 'gestion-cultural';
  await prisma.landingPage.upsert({
    where: { slug },
    update: {},
    create: {
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
