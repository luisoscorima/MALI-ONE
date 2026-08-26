/** Identificador técnico del widget (CRM attr `source`, columna Sheet). */
export const EDUCACION_LEAD_SOURCE = 'educacion_lead_widget';

/** Canal de negocio por defecto (CRM attr `fuente`, columna Sheet). */
export const EDUCACION_LEAD_FUENTE = 'Web MALI Educación';

const PERSON_NAME_LOCALE = 'es-PE';

/** "  luis   gustavo " → "Luis Gustavo" (cada palabra en Title Case). */
export function normalizePersonName(raw: string): string {
  const collapsed = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!collapsed) return '';
  return collapsed
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase(PERSON_NAME_LOCALE);
      if (!lower) return '';
      return lower.charAt(0).toLocaleUpperCase(PERSON_NAME_LOCALE) + lower.slice(1);
    })
    .join(' ');
}
