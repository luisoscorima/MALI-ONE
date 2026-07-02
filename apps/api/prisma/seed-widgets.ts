/**
 * Seed inicial de widgets (educación, biblioteca, PAM).
 * No se ejecuta al arrancar la API salvo WIDGET_SEED_ON_START=true.
 * Manual: pnpm --filter @mali-one/api prisma:seed:widgets
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DATA_DIR = join(__dirname, 'seed-data');

/** Slugs obsoletos de seeds anteriores — se desactivan al re-sembrar */
const OBSOLETE_SEDE_SLUGS = ['principal', 'virtual'];

type EducacionSettings = {
  whatsapp: string;
  telefono: string;
  email: string;
  emailVirtual: string;
  soporteVirtual: string;
  imageRectangulo: string;
  imageWhatsapp: string;
  imageCirculo: string;
  imageCorreo: string;
  imageMarker: string;
};

type DistrictSeed = { slug: string; name: string; sortOrder: number };

type SedeSeed = {
  slug: string;
  nombre: string;
  direccion?: string;
  lat?: number;
  lng?: number;
  horarioHtml?: string;
  brochureUrl: string;
  districtSlug?: string;
  showOnMap: boolean;
  sortOrder: number;
};

type SelectorSedeSeed = {
  slug: string;
  nombre: string;
  brochureUrl: string;
  sortOrder: number;
};

type CarouselItemSeed = {
  title: string;
  subtitle?: string;
  descriptionHtml: string;
  link: string;
  imageSrc: string;
  imageAlt: string;
  backgroundSrc: string;
};

type PamSettingsSeed = { benefits: string[]; notes: string[] };

type PamPlanSeed = {
  slug: string;
  name: string;
  color: string;
  exclusive: boolean;
  sortOrder: number;
  monthlyPrice: string;
  monthlyDuration: string;
  monthlyCheckout: string;
  monthlyValues: string[];
  yearlyPrice: string;
  yearlyDuration: string;
  yearlyCheckout: string;
  yearlyValues: string[];
  activo: boolean;
};

function loadJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf8')) as T;
}

function sedeRow(
  s: SedeSeed,
  districtIds: Record<string, string>,
) {
  return {
    slug: s.slug,
    nombre: s.nombre,
    direccion: s.direccion ?? null,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    horarioHtml: s.horarioHtml ?? null,
    brochureUrl: s.brochureUrl,
    districtId: s.districtSlug ? districtIds[s.districtSlug] ?? null : null,
    showOnMap: s.showOnMap,
    sortOrder: s.sortOrder,
    activo: true,
  };
}

function selectorSedeRow(s: SelectorSedeSeed) {
  return {
    slug: s.slug,
    nombre: s.nombre,
    brochureUrl: s.brochureUrl,
    sortOrder: s.sortOrder,
    activo: true,
  };
}

async function seedEducacion() {
  const settings = loadJson<EducacionSettings>('educacion-settings.json');
  const districts = loadJson<DistrictSeed[]>('educacion-districts.json');
  const { mapSedes, selectorSedes } = loadJson<{
    mapSedes: SedeSeed[];
    selectorSedes: SedeSeed[];
  }>('educacion-sedes.json');

  const settingsData = {
    ...settings,
    googleCalendarId: 'talleresmali@mali.pe',
    ...(process.env.GOOGLE_MAPS_API_KEY
      ? { mapsApiKey: process.env.GOOGLE_MAPS_API_KEY }
      : {}),
  };

  await prisma.educacionWidgetSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...settingsData },
    update: settingsData,
  });

  const districtIds: Record<string, string> = {};
  for (const d of districts) {
    const row = await prisma.educacionDistrict.upsert({
      where: { slug: d.slug },
      create: d,
      update: { name: d.name, sortOrder: d.sortOrder },
    });
    districtIds[d.slug] = row.id;
  }

  const mapActiveSlugs = new Set(mapSedes.map((s) => s.slug));

  for (const s of mapSedes) {
    const data = sedeRow(s, districtIds);
    await prisma.educacionSede.upsert({
      where: { slug: s.slug },
      create: data,
      update: data,
    });
  }

  await prisma.educacionSede.updateMany({
    where: {
      OR: [
        { slug: { in: OBSOLETE_SEDE_SLUGS } },
        { slug: { notIn: [...mapActiveSlugs] } },
      ],
    },
    data: { activo: false },
  });

  const selectorActiveSlugs = new Set(selectorSedes.map((s) => s.slug));
  for (const s of selectorSedes) {
    const data = selectorSedeRow(s);
    await prisma.educacionSelectorSede.upsert({
      where: { slug: s.slug },
      create: data,
      // No sobrescribir datos editados en producción (nombre, brochure, icon, etc.)
      update: { sortOrder: data.sortOrder, activo: true },
    });
  }

  await prisma.educacionSelectorSede.updateMany({
    where: { slug: { notIn: [...selectorActiveSlugs] } },
    data: { activo: false },
  });

  const popup = loadJson<{
    activo: boolean;
    imagenUrl: string;
    imagenLinkUrl?: string;
    imagenTarget?: string;
    titulo?: string;
    botonTexto: string;
    botonUrl: string;
    botonTarget?: string;
    showOnce?: boolean;
    delayMs?: number;
    animationSpeedMs?: number;
  }>('educacion-popup.json');

  await prisma.educacionPopupSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...popup },
    update: popup,
  });

  console.log(
    `  educacion: ${districts.length} distritos, ${mapSedes.length} sedes mapa, ${selectorSedes.length} sedes selector, popup`,
  );
}

async function seedBiblioteca() {
  const items = loadJson<CarouselItemSeed[]>('carousel-items.json');
  const seededTitles = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    seededTitles.add(item.title);

    const data = {
      title: item.title,
      subtitle: item.subtitle ?? null,
      descriptionHtml: item.descriptionHtml,
      link: item.link,
      imageSrc: item.imageSrc,
      imageAlt: item.imageAlt,
      backgroundSrc: item.backgroundSrc,
      sortOrder: i,
      activo: true,
    };

    const existing = await prisma.bibliotecaCarouselItem.findFirst({
      where: { title: item.title },
    });

    if (existing) {
      await prisma.bibliotecaCarouselItem.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.bibliotecaCarouselItem.create({ data });
    }
  }

  await prisma.bibliotecaCarouselItem.updateMany({
    where: { title: { notIn: [...seededTitles] } },
    data: { activo: false },
  });

  await prisma.bibliotecaCarouselSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      headerTitle: 'CONOCE NUESTRAS NUEVAS ADQUISICIONES',
      headerColor: '#e82323',
    },
    update: {},
  });

  console.log(`  biblioteca: ${items.length} ítems carrusel`);
}

async function seedPam() {
  const settings = loadJson<PamSettingsSeed>('pam-settings.json');
  const plans = loadJson<PamPlanSeed[]>('pam-plans.json');

  await prisma.pamWidgetSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      benefits: settings.benefits,
      notes: settings.notes,
    },
    update: {
      benefits: settings.benefits,
      notes: settings.notes,
    },
  });

  const activeSlugs = new Set(plans.map((p) => p.slug));
  for (const plan of plans) {
    await prisma.pamPlan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: plan,
    });
  }

  await prisma.pamPlan.updateMany({
    where: { slug: { notIn: [...activeSlugs] } },
    data: { activo: false },
  });

  const museoPopup = loadJson<{
    activo: boolean;
    imagenUrl: string;
    imagenLinkUrl?: string | null;
    imagenTarget?: string;
    titulo?: string | null;
    botonTexto: string;
    botonUrl: string;
    botonTarget?: string;
    showOnce?: boolean;
    delayMs?: number;
    animationSpeedMs?: number;
    scheduleEnabled?: boolean;
    scheduleDateStart?: string | null;
    scheduleDateEnd?: string | null;
    scheduleTimeStart?: string | null;
    scheduleTimeEnd?: string | null;
    scheduleTimezone?: string;
  }>('museo-popup.json');

  await prisma.museoPopupSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...museoPopup },
    update: museoPopup,
  });

  console.log(`  pam: ${plans.length} planes, ${settings.benefits.length} beneficios, popup museo`);
}

async function main() {
  console.log('Widget seed desde seed-data/ (fuente: MALI-TI/mali)');
  await seedEducacion();
  await seedBiblioteca();
  await seedPam();
  console.log('Widget seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
