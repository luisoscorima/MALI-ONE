import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const BROCHURES = {
  principal:
    'https://drive.google.com/file/d/1EBjwy5tHEZfuroli-e0EubN5eVIEAvH9/view?usp=sharing',
  la_molina:
    'https://drive.google.com/file/d/1HrI5udhX9UD7yk1ohBPEaOeUyEb30Qjx/view?usp=sharing',
  san_miguel:
    'https://drive.google.com/file/d/126G2zJSMaAg5--z9vnUoL4XWxHU48jtU/view?usp=sharing',
  chorrillos:
    'https://drive.google.com/file/d/1uDUGpC78k9lh0q6gdCDZSqWIEl0GniKe/view?usp=sharing',
  los_olivos:
    'https://drive.google.com/file/d/1CQ8xPi89ouQy-onLAVzMFnPUar3z82_W/view?usp=sharing',
  sjl: 'https://drive.google.com/file/d/15qYVLjleAI3h_OYauyGlt-HUlMMXbvJJ/view?usp=sharing',
  pueblo_libre:
    'https://drive.google.com/file/d/139KbCvqhZDOfE5MX_NYP4fNpX3RAtZW3/view?usp=sharing',
  virtual:
    'https://drive.google.com/file/d/1ZF0pwx17aua0I_O0SPD-5yM1mNIhAXOd/view?usp=sharing',
  bellavista:
    'https://drive.google.com/file/d/1id4CMFX_TSsTA8D3wa78eElgpzjTP45l/view?usp=sharing',
};

const HORARIO_PRINCIPAL = `Martes a viernes de 11 a.m. a 8 p.m.<br>
Sábado de 9 a.m. a 8 p.m.<br>
Domingos de 9 a.m. a 5 p.m.`;

const HORARIO_MOLINA = `Martes a viernes de 11 a.m. a 8 p.m.<br>
Sábados y domingos de 9 a.m. a 5 p.m.`;

const HORARIO_DIGITAL =
  'Atención solo por medios digitales o en la sede principal.';

async function seedEducacion() {
  await prisma.educacionWidgetSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      whatsapp: '961 505 576',
      telefono: '(01) 204 0000 (Anexo 1)',
      email: 'cursosdearte@mali.pe',
      emailVirtual: 'cursosvirtuales@mali.pe',
      soporteVirtual: '946 216 569',
      imageRectangulo:
        'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/Rectangulo.png',
      imageWhatsapp:
        'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/WhatsApp.png',
      imageCorreo:
        'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/correo.png',
      mapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? null,
    },
    update: {},
  });

  const districts = [
    { slug: 'lima', name: 'Sede Principal - Lima', sortOrder: 0 },
    { slug: 'chorrillos', name: 'Chorrillos', sortOrder: 1 },
    { slug: 'la-molina', name: 'La Molina', sortOrder: 2 },
    { slug: 'los-olivos', name: 'Los Olivos', sortOrder: 3 },
    { slug: 'sjl', name: 'San Juan de Lurigancho', sortOrder: 4 },
    { slug: 'san-miguel', name: 'San Miguel', sortOrder: 5 },
    { slug: 'sede-virtual', name: 'Sede Virtual', sortOrder: 6 },
  ];

  const districtIds: Record<string, string> = {};
  for (const d of districts) {
    const row = await prisma.educacionDistrict.upsert({
      where: { slug: d.slug },
      create: d,
      update: { name: d.name, sortOrder: d.sortOrder },
    });
    districtIds[d.slug] = row.id;
  }

  const sedes = [
    {
      slug: 'principal',
      nombre: 'Museo de Arte de Lima',
      direccion: 'Paseo Colón 125 - Cercado - Museo de Arte de Lima',
      lat: -12.060064822464469,
      lng: -77.03735101905501,
      horarioHtml: HORARIO_PRINCIPAL,
      brochureUrl: BROCHURES.principal,
      districtSlug: 'lima',
      sortOrder: 0,
    },
    {
      slug: 'faisanes',
      nombre: 'Innova Schools Faisanes',
      direccion:
        'Av. Los Faisanes cdra. 9 s/n - Innova Schools Chorrillos - Los Faisanes',
      lat: -12.170613221909935,
      lng: -76.99343750655301,
      horarioHtml: HORARIO_DIGITAL,
      brochureUrl: BROCHURES.chorrillos,
      districtSlug: 'chorrillos',
      sortOrder: 0,
    },
    {
      slug: 'camacho',
      nombre: 'Sede La Molina',
      direccion: 'Av. Javier Prado Este 5193 - C.C. Plaza Camacho. Local 2B',
      lat: -12.0799717137281,
      lng: -76.96669571212993,
      horarioHtml: HORARIO_MOLINA,
      brochureUrl: BROCHURES.la_molina,
      districtSlug: 'la-molina',
      sortOrder: 0,
    },
    {
      slug: 'villasol',
      nombre: 'Innova Schools Villa Sol',
      direccion:
        'Calle Justo Arias Aranguez Mz. G Lote 23 - Innova Schools Los Olivos - Villa Sol',
      lat: -11.962331579668724,
      lng: -77.07110542189972,
      horarioHtml: HORARIO_DIGITAL,
      brochureUrl: BROCHURES.los_olivos,
      districtSlug: 'los-olivos',
      sortOrder: 0,
    },
    {
      slug: 'arabiscos',
      nombre: 'Innova Schools Arabiscos',
      direccion:
        'Calle Los Hinojos 1237 Urb. Los Jardines de San Juan - Innova Schools SJL - Arabiscos',
      lat: -12.0148263,
      lng: -77.0054427,
      horarioHtml: HORARIO_DIGITAL,
      brochureUrl: BROCHURES.sjl,
      districtSlug: 'sjl',
      sortOrder: 0,
    },
    {
      slug: 'sanmiguel',
      nombre: 'Innova Schools San Miguel 1',
      direccion: 'Av. Libertad 860, San Miguel - Innova Schools San Miguel 1',
      lat: -12.085071193836322,
      lng: -77.09042677772025,
      horarioHtml: HORARIO_DIGITAL,
      brochureUrl: BROCHURES.san_miguel,
      districtSlug: 'san-miguel',
      sortOrder: 0,
    },
    {
      slug: 'virtual',
      nombre: 'Sede Virtual',
      direccion: 'Plataforma digital del MALI',
      lat: -12.060064822464469,
      lng: -77.03735101905501,
      horarioHtml: HORARIO_DIGITAL,
      brochureUrl: BROCHURES.virtual,
      districtSlug: 'sede-virtual',
      sortOrder: 0,
      showOnSelector: true,
    },
    {
      slug: 'pueblo-libre',
      nombre: 'MALI Pueblo Libre',
      brochureUrl: BROCHURES.pueblo_libre,
      showOnMap: false,
      showOnSelector: true,
      sortOrder: 8,
    },
    {
      slug: 'bellavista',
      nombre: 'MALI Bellavista',
      brochureUrl: BROCHURES.bellavista,
      showOnMap: false,
      showOnSelector: true,
      sortOrder: 9,
    },
  ] as const;

  for (const s of sedes) {
    const districtSlug = 'districtSlug' in s ? s.districtSlug : undefined;
    await prisma.educacionSede.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        nombre: s.nombre,
        direccion: 'direccion' in s ? s.direccion : null,
        lat: 'lat' in s ? s.lat : null,
        lng: 'lng' in s ? s.lng : null,
        horarioHtml: 'horarioHtml' in s ? s.horarioHtml : null,
        brochureUrl: s.brochureUrl,
        districtId: districtSlug ? districtIds[districtSlug] : null,
        showOnMap: 'showOnMap' in s ? s.showOnMap : true,
        showOnSelector: 'showOnSelector' in s ? s.showOnSelector : true,
        sortOrder: s.sortOrder,
      },
      update: {
        nombre: s.nombre,
        brochureUrl: s.brochureUrl,
      },
    });
  }
}

async function seedBiblioteca() {
  const count = await prisma.bibliotecaCarouselItem.count();
  if (count > 0) return;

  const path = join(__dirname, 'seed-data', 'carousel-items.json');
  const items = JSON.parse(readFileSync(path, 'utf8')) as {
    title: string;
    subtitle?: string;
    descriptionHtml: string;
    link: string;
    imageSrc: string;
    imageAlt: string;
    backgroundSrc: string;
  }[];

  await prisma.bibliotecaCarouselItem.createMany({
    data: items.map((item, index) => ({
      title: item.title,
      subtitle: item.subtitle ?? null,
      descriptionHtml: item.descriptionHtml,
      link: item.link,
      imageSrc: item.imageSrc,
      imageAlt: item.imageAlt,
      backgroundSrc: item.backgroundSrc,
      sortOrder: index,
    })),
  });
}

async function seedPam() {
  await prisma.pamWidgetSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      benefits: [
        'Acceso gratuito a exposiciones',
        'Invitación a inauguraciones de exposiciones',
        'Acceso gratuito a Noche MALI',
        'Invitación para visitas guiadas especiales',
        'Visita guiada por el mes de tu cumpleaños*',
        'Descuento en actividades especiales',
        'Acceso al carnet de biblioteca**',
        '15% de descuento en cursos y talleres, y 20% en e. profesional***',
        'Descuento en productos y publicaciones MALI',
        'Beneficios por participación en actividades de fin de semana***',
        '10% de descuento en consumos en el restaurante del MALI',
      ],
      notes: [
        '* Acceso a salón prado previa coordinación.',
        '** Incluye integración en el Club de lectura MALI.',
        '*** +1 Noche MALI, por completar Tarjeta de Actividades PAM con los 4 sellos.',
        'El tiempo mínimo de permanencia es de un (1) año.',
      ],
    },
    update: {},
  });

  const plans = [
    {
      slug: 'amigo',
      name: 'Amigo',
      color: 'green',
      exclusive: false,
      sortOrder: 0,
      monthlyPrice: '19.90',
      monthlyDuration: 'mes',
      monthlyCheckout:
        'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
      monthlyValues: [
        'Titular',
        'Titular',
        '+2',
        'Titular',
        '+5',
        '10%',
        '×',
        '✓',
        '5%',
        '✓',
        '✓',
      ],
      yearlyPrice: '220',
      yearlyDuration: 'año',
      yearlyCheckout:
        'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bcc15a100c0',
      yearlyValues: [
        'Titular',
        'Titular',
        '+2',
        'Titular',
        '+5',
        '10%',
        '×',
        '✓',
        '5%',
        '✓',
        '✓',
      ],
    },
    {
      slug: 'comunidad',
      name: 'Comunidad',
      color: 'pink',
      exclusive: true,
      sortOrder: 1,
      monthlyPrice: '39.90',
      monthlyDuration: 'mes',
      monthlyCheckout:
        'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bc47b7600b3',
      monthlyValues: ['1', 'Doble', '+3', '+2', '+7', '15%', '×', '✓', '10%', '✓', '✓'],
      yearlyPrice: '440',
      yearlyDuration: 'año',
      yearlyCheckout:
        'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bd5666e00c9',
      yearlyValues: ['1', 'Doble', '+3', '+2', '+7', '15%', '×', '✓', '10%', '✓', '✓'],
    },
    {
      slug: 'circulo',
      name: 'Círculo',
      color: 'blue',
      exclusive: false,
      sortOrder: 2,
      monthlyPrice: '99.90',
      monthlyDuration: 'mes',
      monthlyCheckout:
        'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bc8d8c000bb',
      monthlyValues: ['3', 'Doble', '+5', '+3', '+10', '20%', '✓', '✓', '15%', '✓', '✓'],
      yearlyPrice: '1,100',
      yearlyDuration: 'año',
      yearlyCheckout:
        'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61e001905bda518d00bd',
      yearlyValues: ['3', 'Doble', '+5', '+3', '+10', '20%', '✓', '✓', '15%', '✓', '✓'],
    },
  ];

  for (const plan of plans) {
    await prisma.pamPlan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: plan,
    });
  }
}

async function main() {
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
