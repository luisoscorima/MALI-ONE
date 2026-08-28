import { normalizePersonName } from './educacion-leads';

/** Solo dígitos; conserva ceros a la izquierda (documento extranjero). */
export function normalizePamDni(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function normalizePamEmail(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

/** Title case es-PE para dirección, ciudad, distrito. */
export function normalizePamPlaceName(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return '';
  return normalizePersonName(String(raw));
}

/** Celular E.164 sin + (Perú local 9xxxxxxxx → 519xxxxxxxx). */
export function normalizePamCelular(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (/^51[1-9]\d{7,11}$/.test(digits)) return digits;
  if (/^9\d{8}$/.test(digits)) return `51${digits}`;
  if (/^[1-9]\d{7,14}$/.test(digits)) return digits;
  return digits;
}

/** Fecha y hora legible en zona America/Lima. */
export function formatLimaDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export type PamRegistrationNormalizeInput = {
  nombres?: string;
  apellidos?: string;
  dni?: string;
  celular?: string;
  correo?: string;
  direccion?: string | null;
  ciudad?: string | null;
  distrito?: string | null;
};

export function normalizePamRegistrationFields<T extends PamRegistrationNormalizeInput>(
  dto: T,
): T {
  const out = { ...dto };
  if (out.nombres !== undefined) {
    out.nombres = normalizePersonName(out.nombres);
  }
  if (out.apellidos !== undefined) {
    out.apellidos = normalizePersonName(out.apellidos);
  }
  if (out.dni !== undefined) {
    out.dni = normalizePamDni(out.dni);
  }
  if (out.celular !== undefined) {
    out.celular = normalizePamCelular(out.celular);
  }
  if (out.correo !== undefined) {
    out.correo = normalizePamEmail(out.correo);
  }
  if (out.direccion !== undefined) {
    out.direccion = out.direccion
      ? normalizePamPlaceName(out.direccion)
      : out.direccion;
  }
  if (out.ciudad !== undefined) {
    out.ciudad = out.ciudad ? normalizePamPlaceName(out.ciudad) : out.ciudad;
  }
  if (out.distrito !== undefined) {
    out.distrito = out.distrito
      ? normalizePamPlaceName(out.distrito)
      : out.distrito;
  }
  return out;
}

export type PamPlanSegmentSlug = 'amigo' | 'circulo' | 'comunidad';

const PAM_PLAN_SEGMENT_SLUGS: PamPlanSegmentSlug[] = [
  'amigo',
  'circulo',
  'comunidad',
];

/** Mapea nombre/slug de plan PAM → segmento WhatsApp (amigo | circulo | comunidad). */
export function planToPamSegmentSlug(plan: string): PamPlanSegmentSlug | null {
  const key = String(plan ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!key) return null;
  if (PAM_PLAN_SEGMENT_SLUGS.includes(key as PamPlanSegmentSlug)) {
    return key as PamPlanSegmentSlug;
  }
  if (key.includes('circulo')) return 'circulo';
  if (key.includes('comunidad')) return 'comunidad';
  if (key.includes('amigo')) return 'amigo';
  return null;
}
