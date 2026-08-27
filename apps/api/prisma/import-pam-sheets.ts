/**
 * Importa registros PAM históricos (Google Sheets) al ledger ONE y sincroniza contactos en WhatsApp CRM.
 *
 * Uso:
 *   pnpm --filter @mali-one/api prisma:import:pam-sheets
 *   pnpm --filter @mali-one/api prisma:import:pam-sheets -- --dry-run
 *
 * Requiere DATABASE_URL y, para sync CRM, WHATSAPP_CRM_BASE_URL + WHATSAPP_CRM_SERVICE_TOKEN.
 */
import {
  PamEmailStatus,
  PamMpStatus,
  PamRegistration,
  PrismaClient,
} from '@prisma/client';
import {
  normalizePamCelular,
  normalizePamRegistrationFields,
} from '@mali-one/shared';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

type SheetRow = {
  registrado_en: string;
  nombres: string;
  apellidos: string;
  dni: string;
  celular: string;
  correo: string;
  direccion: string;
  ciudad: string;
  distrito: string;
  genero: string;
  fecha_nacimiento: string;
  como_te_enteraste: string;
  plan: string;
  frecuencia: string;
  checkout_url: string;
  estado_mercado_pago: PamMpStatus;
  mensaje_bienvenida: PamEmailStatus;
  fecha_caducidad: string;
  aviso_caducidad: PamEmailStatus;
};

/** Registros exportados desde Google Sheets (jun–ago 2026). */
const SHEET_ROWS: SheetRow[] = [
  {
    registrado_en: '2026-06-27T00:04:00.364Z',
    nombres: 'Manuel Abelardo',
    apellidos: 'Cardenas Muñoz',
    dni: '7909873',
    celular: '51920765923',
    correo: 'manuelcardenas1@gmail.com',
    direccion: 'Manuel Aguila Durand 323, Primer piso',
    ciudad: 'Lima',
    distrito: 'Santiago de surco',
    genero: 'Masculino',
    fecha_nacimiento: '2026-06-19',
    como_te_enteraste: 'Visita al museo',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-07-26',
    aviso_caducidad: 'ENVIADO',
  },
  {
    registrado_en: '2026-06-27T01:36:50.811Z',
    nombres: 'Alvaro cristobal',
    apellidos: 'Huamani quispe',
    dni: '71300342',
    celular: '953732077',
    correo: 'alvaro.chq@gmail.com',
    direccion: 'CALLE GREGORIO APAZA 181',
    ciudad: 'Lima',
    distrito: 'Comas',
    genero: 'Masculino',
    fecha_nacimiento: '1993-01-01',
    como_te_enteraste: 'Redes sociales',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-08-13',
    aviso_caducidad: 'ENVIADO',
  },
  {
    registrado_en: '2026-07-02T16:22:48.129Z',
    nombres: 'Teresa',
    apellidos: 'Casabone',
    dni: '7816317',
    celular: '993576481',
    correo: 'teresapinillos@hotmail.com',
    direccion: 'Calle las 3 marías 440 - B, Santiago de Surco',
    ciudad: 'Lima',
    distrito: 'Surco',
    genero: 'Femenino',
    fecha_nacimiento: '1946-11-24',
    como_te_enteraste: 'Visita al museo',
    plan: 'Amigo',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bcc15a100c0',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-07-13',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-07-02T21:51:19.213Z',
    nombres: 'Lucila',
    apellidos: 'Castro de Trelles',
    dni: '7803532',
    celular: '51999389192',
    correo: 'lucilacastromendivil@gmail.com',
    direccion: 'Malecón Paul Harris 284, Barranco',
    ciudad: 'Lima',
    distrito: 'Barranco',
    genero: 'Femenino',
    fecha_nacimiento: '1948-08-24',
    como_te_enteraste: 'Recomendación de un amigo',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-08-13',
    aviso_caducidad: 'ENVIADO',
  },
  {
    registrado_en: '2026-07-12T16:06:55.210Z',
    nombres: 'LUCIA',
    apellidos: 'MORGADO',
    dni: '8274135',
    celular: '999163470',
    correo: 'LUCIAMORGADOM@GMAIL.COM',
    direccion: 'CORONEL PORTILLO 270 SAN ISIDRO',
    ciudad: 'LIMA',
    distrito: 'SAN ISIDRO',
    genero: 'Femenino',
    fecha_nacimiento: '1963-04-30',
    como_te_enteraste: 'Visita al museo',
    plan: 'Amigo',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bcc15a100c0',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-07-13',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-07-24T01:34:50.163Z',
    nombres: 'CHRISTIAN',
    apellidos: 'OSORIO',
    dni: '42239692',
    celular: '51908694482',
    correo: '42239692@continental.edu.pe',
    direccion: 'SURCO',
    ciudad: 'LIMA',
    distrito: 'SURCO',
    genero: 'Masculino',
    fecha_nacimiento: '1984-02-12',
    como_te_enteraste: 'Visita al museo',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-09-04',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-07-24T12:47:38.574Z',
    nombres: 'Nataly',
    apellidos: 'Martínez Palomino',
    dni: '46433802',
    celular: '989629452',
    correo: 'natalycmp@gmail.com',
    direccion: 'Av. 17 de noviembre 728 Independencia',
    ciudad: 'Lima',
    distrito: 'Independencia',
    genero: 'Femenino',
    fecha_nacimiento: '1990-06-25',
    como_te_enteraste: 'Cursos MALI',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-09-04',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-03T21:31:58.848Z',
    nombres: 'Allison',
    apellidos: 'Güich Jimenez',
    dni: '46603265',
    celular: '963806530',
    correo: 'allison.guich@gmail.com',
    direccion: 'Av Los Patriotas 228',
    ciudad: 'Lima',
    distrito: 'San Miguel',
    genero: 'Femenino',
    fecha_nacimiento: '1990-11-10',
    como_te_enteraste: 'Visita al museo',
    plan: 'Amigo',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bcc15a100c0',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-08-04',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-03T21:33:18.720Z',
    nombres: 'Qary Gabriel',
    apellidos: 'Huatuco Jimenez',
    dni: '73105526',
    celular: '969701420',
    correo: 'contacto.qary@gmail.com',
    direccion: 'Pedro Torres Malarín 290. Dep G',
    ciudad: 'Lima',
    distrito: 'Pueblo Libre',
    genero: 'Masculino',
    fecha_nacimiento: '1994-07-28',
    como_te_enteraste: 'Redes sociales',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-09-04',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-06T20:54:47.290Z',
    nombres: 'MAFALDA',
    apellidos: 'ARIAS',
    dni: '8798684',
    celular: '997857823',
    correo: 'mafi@uniserve.com',
    direccion: 'Calle C #330, Monterrico',
    ciudad: 'Lima',
    distrito: 'Surco',
    genero: '',
    fecha_nacimiento: '',
    como_te_enteraste: 'Web mali.pe',
    plan: 'Comunidad',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bd5666e00c9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-08-11',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-16T20:20:12.517Z',
    nombres: 'Yutaro',
    apellidos: 'Funamoto',
    dni: '4306198',
    celular: '973841633',
    correo: 'realosakaultras.yutaro@gmail.com',
    direccion: 'Jirón Carlos Arrieta 1172, Lima 15046, Peru',
    ciudad: 'Lima',
    distrito: '',
    genero: '',
    fecha_nacimiento: '',
    como_te_enteraste: 'Tienda MALI',
    plan: 'Amigo',
    frecuencia: 'mensual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a624901905bc2b30d00b9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2026-09-25',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-22T01:37:56.606Z',
    nombres: 'Alessandra',
    apellidos: 'Gerbolini Rivero',
    dni: '10609765',
    celular: '51994083592',
    correo: 'alessandra@kuskayaperu.com',
    direccion: 'Calle San Fernando 178, dpt 701',
    ciudad: 'Lima',
    distrito: 'Miraflores',
    genero: 'Femenino',
    fecha_nacimiento: '1977-01-28',
    como_te_enteraste: 'Visita al museo',
    plan: 'Comunidad',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bd5666e00c9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-08-25',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-25T18:32:42.182Z',
    nombres: 'Pedro Alfonso',
    apellidos: 'Villar Gálvez',
    dni: '8213812',
    celular: '989168686',
    correo: 'pv@pedrovillar.com',
    direccion: 'Calle Los Pinos 582 Dpto. 502B',
    ciudad: 'Lima 15073',
    distrito: 'San Isidro',
    genero: 'Masculino',
    fecha_nacimiento: '1961-10-30',
    como_te_enteraste: 'Otro: Ya soy miembro del programa desde hace décadas',
    plan: 'Amigo',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bcc15a100c0',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-08-25',
    aviso_caducidad: 'PENDIENTE',
  },
  {
    registrado_en: '2026-08-25T20:09:09.475Z',
    nombres: 'Alika',
    apellidos: 'vilchez vargas',
    dni: '62978995',
    celular: '943816803',
    correo: 'yohide59@gmail.com',
    direccion: 'jr. antonio olivera 440',
    ciudad: 'Lima',
    distrito: 'chorrillos',
    genero: 'Femenino',
    fecha_nacimiento: '2012-01-14',
    como_te_enteraste: 'Web mali.pe',
    plan: 'Comunidad',
    frecuencia: 'anual',
    checkout_url:
      'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_plan_id=2c938084905a61d301905bd5666e00c9',
    estado_mercado_pago: 'approved',
    mensaje_bienvenida: 'ENVIADO',
    fecha_caducidad: '2027-08-26',
    aviso_caducidad: 'PENDIENTE',
  },
];

function crmConfig() {
  const base = String(process.env.WHATSAPP_CRM_BASE_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  const token = String(process.env.WHATSAPP_CRM_SERVICE_TOKEN ?? '').trim();
  return { base, token, configured: Boolean(base && token) };
}

function phoneCandidates(e164: string): string[] {
  const out = new Set<string>([e164]);
  if (e164.startsWith('51') && e164.length > 2) {
    out.add(e164.slice(2));
  }
  return [...out];
}

function rowToRegistrationData(row: SheetRow) {
  const normalized = normalizePamRegistrationFields({
    nombres: row.nombres,
    apellidos: row.apellidos,
    dni: row.dni,
    celular: row.celular,
    correo: row.correo,
    direccion: row.direccion || null,
    ciudad: row.ciudad || null,
    distrito: row.distrito || null,
  });

  return {
    nombres: normalized.nombres!,
    apellidos: normalized.apellidos!,
    dni: normalized.dni!,
    celular: normalized.celular!,
    correo: normalized.correo!,
    direccion: normalized.direccion ?? null,
    ciudad: normalized.ciudad ?? null,
    distrito: normalized.distrito ?? null,
    genero: row.genero.trim() || null,
    fechaNacimiento: row.fecha_nacimiento.trim() || null,
    comoTeEnteraste: row.como_te_enteraste.trim() || null,
    plan: row.plan.trim(),
    frecuencia: row.frecuencia.trim(),
    checkoutUrl: row.checkout_url.trim() || null,
    paymentMethod: 'mercado_pago',
    aceptaPrivacidad: true,
    mpStatus: row.estado_mercado_pago,
    welcomeEmail: row.mensaje_bienvenida,
    expiryNotice: row.aviso_caducidad,
    expiryDate: row.fecha_caducidad
      ? new Date(`${row.fecha_caducidad}T12:00:00.000Z`)
      : null,
    createdAt: new Date(row.registrado_en),
  };
}

async function findByPhone(celular: string) {
  const candidates = phoneCandidates(celular);
  return prisma.pamRegistration.findFirst({
    where: { celular: { in: candidates } },
    orderBy: { createdAt: 'desc' },
  });
}

async function crmRequest(method: string, path: string, body?: unknown) {
  const { base, token } = crmConfig();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Crm-Service-Token': token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    data?: unknown;
  };
  if (!res.ok || json.ok === false) {
    throw new Error(json.message || `CRM HTTP ${res.status} ${method} ${path}`);
  }
  return json.data ?? json;
}

async function ensurePamAttributeDefinitions() {
  await crmRequest('POST', '/api/crm/attribute-definitions/ensure', {
    area: 'pam',
    definitions: [
      { slug: 'payment_id', label: 'ID pago (MALI ONE)', sort_order: 1 },
      { slug: 'medio_pago', label: 'Medio de pago', sort_order: 2 },
      { slug: 'plan', label: 'Plan', sort_order: 3 },
      { slug: 'frecuencia', label: 'Frecuencia', sort_order: 4 },
      { slug: 'mp_status', label: 'Estado MP', sort_order: 5 },
      { slug: 'expiry', label: 'Caducidad', field_type: 'date', sort_order: 6 },
      { slug: 'direccion', label: 'Dirección', sort_order: 10 },
      { slug: 'ciudad', label: 'Ciudad', sort_order: 11 },
      { slug: 'distrito', label: 'Distrito', sort_order: 12 },
      { slug: 'genero', label: 'Género', sort_order: 13 },
      {
        slug: 'fecha_nacimiento',
        label: 'Fecha de nacimiento',
        field_type: 'date',
        sort_order: 14,
      },
      { slug: 'como_te_enteraste', label: 'Cómo te enteraste', sort_order: 15 },
      { slug: 'source', label: 'Origen', sort_order: 20 },
    ],
  });
}

function buildCrmAttributes(reg: PamRegistration): Record<string, string> {
  const attributes: Record<string, string> = {
    source: 'pam_sheets_import',
    payment_id: reg.id,
    medio_pago: 'Mercado Pago',
    plan: reg.plan,
    frecuencia: reg.frecuencia,
    mp_status: reg.mpStatus ?? '',
  };
  if (reg.direccion) attributes.direccion = reg.direccion;
  if (reg.ciudad) attributes.ciudad = reg.ciudad;
  if (reg.distrito) attributes.distrito = reg.distrito;
  if (reg.genero) attributes.genero = reg.genero;
  if (reg.fechaNacimiento) attributes.fecha_nacimiento = reg.fechaNacimiento;
  if (reg.comoTeEnteraste) attributes.como_te_enteraste = reg.comoTeEnteraste;
  if (reg.expiryDate) {
    attributes.expiry = reg.expiryDate.toISOString().slice(0, 10);
  }
  return attributes;
}

async function syncRegistrationToCrm(reg: PamRegistration) {
  const { configured } = crmConfig();
  if (!configured) {
    console.warn('  ⚠ CRM no configurado; omitiendo sync WhatsApp');
    return;
  }

  await crmRequest('POST', '/api/crm/sync', {
    area: 'pam',
    name: reg.nombres,
    last_name: reg.apellidos,
    phone: reg.celular,
    email: reg.correo,
    dni: reg.dni,
    opt_in: true,
    opt_in_email: true,
    attributes: buildCrmAttributes(reg),
    external_id: reg.id,
  });
}

async function upsertRow(row: SheetRow, index: number) {
  const data = rowToRegistrationData(row);

  if (dryRun) {
    console.log(
      `[${index + 1}/${SHEET_ROWS.length}] DRY-RUN ${data.nombres} ${data.apellidos} (${data.celular})`,
    );
    return;
  }

  const existing = await findByPhone(data.celular);
  const action = existing ? 'update' : 'create';

  console.log(
    `[${index + 1}/${SHEET_ROWS.length}] ${action.toUpperCase()} ${data.nombres} ${data.apellidos} (${data.celular})`,
  );

  await prisma.pamPaymentMethod.upsert({
    where: { slug: 'mercado_pago' },
    create: {
      slug: 'mercado_pago',
      label: 'Mercado Pago',
      active: true,
      system: true,
      sortOrder: 0,
    },
    update: { system: true },
  });

  let reg: PamRegistration;
  if (existing) {
    reg = await prisma.pamRegistration.update({
      where: { id: existing.id },
      data,
    });
    console.log(`  ✓ Ledger actualizado: ${reg.id}`);
  } else {
    reg = await prisma.pamRegistration.create({ data });
    console.log(`  ✓ Ledger creado: ${reg.id}`);
  }

  try {
    await syncRegistrationToCrm(reg);
    console.log('  ✓ Contacto WhatsApp CRM sincronizado');
  } catch (err) {
    console.error(
      '  ✗ Error sync CRM:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function main() {
  console.log(
    `Importando ${SHEET_ROWS.length} registros PAM${dryRun ? ' (dry-run)' : ''}…`,
  );

  const { configured } = crmConfig();
  if (!configured) {
    console.warn(
      'WHATSAPP_CRM_BASE_URL / WHATSAPP_CRM_SERVICE_TOKEN no definidos; solo ledger ONE.',
    );
  } else if (!dryRun) {
    await ensurePamAttributeDefinitions();
  }

  for (let i = 0; i < SHEET_ROWS.length; i++) {
    await upsertRow(SHEET_ROWS[i], i);
  }

  console.log('Listo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
