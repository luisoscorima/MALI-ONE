/** Filtro de listados en la vitrina ONE (categoría, no área). */
export const EDUCATION_CATEGORY_SCOPES = ['all', 'general', 'ca', 'ep'] as const;
export type EducationCategoryScope = (typeof EDUCATION_CATEGORY_SCOPES)[number];

/** Área canónica de ficha / mutaciones. */
export const EDUCATION_WRITE_AREA = 'educacion' as const;

/**
 * WhatsApp aún acepta `area` en query como filtro de categoría (compat).
 * ONE habla en categoría; el proxy traduce solo en lectura.
 */
export function toWhatsAppAreaQuery(scope?: string): string {
  const selected = String(scope ?? 'all').trim().toLowerCase() || 'all';
  if (selected === 'all') return 'all';
  if (selected === 'general' || selected === 'educacion') return 'educacion';
  if (selected === 'ca' || selected === 'educacion_ca') return 'educacion_ca';
  if (selected === 'ep' || selected === 'educacion_ep') return 'educacion_ep';
  return selected;
}

export function isEducationCategoryScope(value: unknown): value is EducationCategoryScope {
  return (EDUCATION_CATEGORY_SCOPES as readonly string[]).includes(String(value ?? ''));
}
