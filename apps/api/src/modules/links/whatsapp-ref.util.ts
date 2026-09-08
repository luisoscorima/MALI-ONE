/** Sufijo automático en textos prellenados de links WHATSAPP (tracking → mali-whatsapp). */
export const WHATSAPP_REF_SUFFIX_RE =
  /\s*[·•\-–—]?\s*ref:[a-zA-Z0-9_-]+\s*$/i;

export function stripWhatsappRef(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(WHATSAPP_REF_SUFFIX_RE, '')
    .trim();
}

/**
 * Quita cualquier `ref:` previo y deja un único ` · ref:{slug}`.
 * El operador solo escribe el mensaje comercial; el sistema añade el marcador.
 */
export function ensureWhatsappRef(
  text: string | undefined | null,
  slug: string,
): string {
  const safeSlug = String(slug ?? '').trim();
  if (!safeSlug) {
    return stripWhatsappRef(text);
  }
  const base = stripWhatsappRef(text);
  if (!base) {
    return `ref:${safeSlug}`;
  }
  return `${base} · ref:${safeSlug}`;
}

export function extractWhatsappRefSlug(
  text: string | undefined | null,
): string | null {
  const raw = String(text ?? '');
  const match = raw.match(/\bref:([a-zA-Z0-9_-]+)\s*$/i);
  return match?.[1] ? String(match[1]) : null;
}
