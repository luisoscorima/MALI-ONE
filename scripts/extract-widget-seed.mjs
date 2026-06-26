#!/usr/bin/env node
/**
 * Extrae datos de widgets desde MALI-TI hacia apps/api/prisma/seed-data/
 * Uso: node scripts/extract-widget-seed.mjs [ruta-a-MALI-TI/mali]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MALI_TI = resolve(process.argv[2] ?? join(__dirname, '../../MALI-TI/mali'));
const OUT = join(__dirname, '../apps/api/prisma/seed-data');

mkdirSync(OUT, { recursive: true });

const ASSETS = {
  rectangulo:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/Rectangulo.png',
  whatsapp:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/WhatsApp.png',
  circulo:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/circulo.png',
  correo:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/correo.png',
  marker:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/marker.png',
};

const educacionSettings = {
  whatsapp: '961 505 576',
  telefono: '(01) 204 0000 (Anexo 1)',
  email: 'cursosdearte@mali.pe',
  emailVirtual: 'cursosvirtuales@mali.pe',
  soporteVirtual: '946 216 569',
  imageRectangulo: ASSETS.rectangulo,
  imageWhatsapp: ASSETS.whatsapp,
  imageCirculo: ASSETS.circulo,
  imageCorreo: ASSETS.correo,
  imageMarker: ASSETS.marker,
};

const BROCHURES = {
  principal:
    'https://drive.google.com/file/d/1EBjwy5tHEZfuroli-e0EubN5eVIEAvH9/view?usp=sharing',
  'la-molina':
    'https://drive.google.com/file/d/1HrI5udhX9UD7yk1ohBPEaOeUyEb30Qjx/view?usp=sharing',
  'san-miguel':
    'https://drive.google.com/file/d/126G2zJSMaAg5--z9vnUoL4XWxHU48jtU/view?usp=sharing',
  chorrillos:
    'https://drive.google.com/file/d/1uDUGpC78k9lh0q6gdCDZSqWIEl0GniKe/view?usp=sharing',
  'los-olivos':
    'https://drive.google.com/file/d/1CQ8xPi89ouQy-onLAVzMFnPUar3z82_W/view?usp=sharing',
  sjl: 'https://drive.google.com/file/d/15qYVLjleAI3h_OYauyGlt-HUlMMXbvJJ/view?usp=sharing',
  'pueblo-libre':
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

const districts = [
  { slug: 'lima', name: 'Sede Principal - Lima', sortOrder: 0 },
  { slug: 'chorrillos', name: 'Chorrillos', sortOrder: 1 },
  { slug: 'la-molina', name: 'La Molina', sortOrder: 2 },
  { slug: 'los-olivos', name: 'Los Olivos', sortOrder: 3 },
  { slug: 'sjl', name: 'San Juan de Lurigancho', sortOrder: 4 },
  { slug: 'san-miguel', name: 'San Miguel', sortOrder: 5 },
  { slug: 'sede-virtual', name: 'Sede Virtual', sortOrder: 6 },
];

const mapSedes = [
  {
    slug: 'museo-principal',
    nombre: 'Museo de Arte de Lima',
    direccion: 'Paseo Colón 125 - Cercado - Museo de Arte de Lima',
    lat: -12.060064822464469,
    lng: -77.03735101905501,
    horarioHtml: HORARIO_PRINCIPAL,
    brochureUrl: BROCHURES.principal,
    districtSlug: 'lima',
    showOnMap: true,
    showOnSelector: false,
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
    showOnMap: true,
    showOnSelector: false,
    sortOrder: 0,
  },
  {
    slug: 'camacho',
    nombre: 'Sede La Molina',
    direccion: 'Av. Javier Prado Este 5193 - C.C. Plaza Camacho. Local 2B',
    lat: -12.0799717137281,
    lng: -76.96669571212993,
    horarioHtml: HORARIO_MOLINA,
    brochureUrl: BROCHURES['la-molina'],
    districtSlug: 'la-molina',
    showOnMap: true,
    showOnSelector: false,
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
    brochureUrl: BROCHURES['los-olivos'],
    districtSlug: 'los-olivos',
    showOnMap: true,
    showOnSelector: false,
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
    showOnMap: true,
    showOnSelector: false,
    sortOrder: 0,
  },
  {
    slug: 'sanmiguel',
    nombre: 'Innova Schools San Miguel 1',
    direccion: 'Av. Libertad 860, San Miguel - Innova Schools San Miguel 1',
    lat: -12.085071193836322,
    lng: -77.09042677772025,
    horarioHtml: HORARIO_DIGITAL,
    brochureUrl: BROCHURES['san-miguel'],
    districtSlug: 'san-miguel',
    showOnMap: true,
    showOnSelector: false,
    sortOrder: 0,
  },
  {
    slug: 'virtual-mapa',
    nombre: 'Sede Virtual',
    direccion: 'Plataforma digital del MALI',
    lat: -12.060064822464469,
    lng: -77.03735101905501,
    horarioHtml: HORARIO_DIGITAL,
    brochureUrl: BROCHURES.virtual,
    districtSlug: 'sede-virtual',
    showOnMap: true,
    showOnSelector: false,
    sortOrder: 0,
  },
];

const selectorSedes = [
  { slug: 'principal', nombre: 'MALI Principal', brochureUrl: BROCHURES.principal, showOnMap: false, showOnSelector: true, sortOrder: 0 },
  { slug: 'la-molina', nombre: 'MALI La Molina', brochureUrl: BROCHURES['la-molina'], showOnMap: false, showOnSelector: true, sortOrder: 1 },
  { slug: 'san-miguel', nombre: 'MALI San Miguel', brochureUrl: BROCHURES['san-miguel'], showOnMap: false, showOnSelector: true, sortOrder: 2 },
  { slug: 'chorrillos', nombre: 'MALI Chorrillos', brochureUrl: BROCHURES.chorrillos, showOnMap: false, showOnSelector: true, sortOrder: 3 },
  { slug: 'los-olivos', nombre: 'MALI Los Olivos', brochureUrl: BROCHURES['los-olivos'], showOnMap: false, showOnSelector: true, sortOrder: 4 },
  { slug: 'sjl', nombre: 'MALI San Juan de Lurigancho', brochureUrl: BROCHURES.sjl, showOnMap: false, showOnSelector: true, sortOrder: 5 },
  { slug: 'pueblo-libre', nombre: 'MALI Pueblo Libre', brochureUrl: BROCHURES['pueblo-libre'], showOnMap: false, showOnSelector: true, sortOrder: 6 },
  { slug: 'bellavista', nombre: 'MALI Bellavista', brochureUrl: BROCHURES.bellavista, showOnMap: false, showOnSelector: true, sortOrder: 7 },
  { slug: 'virtual', nombre: 'MALI Virtual', brochureUrl: BROCHURES.virtual, showOnMap: false, showOnSelector: true, sortOrder: 8 },
];

let carouselCode = readFileSync(
  join(MALI_TI, 'biblioteca/carrusel-data.js'),
  'utf8',
);
carouselCode = carouselCode.replace(/window\.MALI_CAROUSEL_ITEMS.*$/m, '');
const carouselItems = new Function(
  carouselCode + '; return MALI_CAROUSEL_ITEMS;',
)();

const pamCode = readFileSync(join(MALI_TI, 'pam/pam-data.js'), 'utf8');
const pamData = new Function(pamCode + '; return PAM_DATA;')();

const pamSettings = { benefits: pamData.benefits, notes: pamData.notes };
const pamPlans = pamData.plans.map((p, i) => ({
  slug: p.id,
  name: p.name,
  color: p.color,
  exclusive: p.exclusive,
  sortOrder: i,
  monthlyPrice: p.monthly.price,
  monthlyDuration: p.monthly.duration,
  monthlyCheckout: p.monthly.checkout,
  monthlyValues: p.monthly.values,
  yearlyPrice: p.yearly.price,
  yearlyDuration: p.yearly.duration,
  yearlyCheckout: p.yearly.checkout,
  yearlyValues: p.yearly.values,
  activo: true,
}));

writeFileSync(join(OUT, 'educacion-settings.json'), JSON.stringify(educacionSettings, null, 2));
writeFileSync(join(OUT, 'educacion-districts.json'), JSON.stringify(districts, null, 2));
writeFileSync(join(OUT, 'educacion-sedes.json'), JSON.stringify({ mapSedes, selectorSedes }, null, 2));
writeFileSync(join(OUT, 'carousel-items.json'), JSON.stringify(carouselItems, null, 2));
writeFileSync(join(OUT, 'pam-settings.json'), JSON.stringify(pamSettings, null, 2));
writeFileSync(join(OUT, 'pam-plans.json'), JSON.stringify(pamPlans, null, 2));

console.log(`Seed data written to ${OUT}`);
console.log(`  carousel: ${carouselItems.length} items`);
console.log(`  sedes mapa: ${mapSedes.length}, selector: ${selectorSedes.length}`);
console.log(`  pam plans: ${pamPlans.length}`);
