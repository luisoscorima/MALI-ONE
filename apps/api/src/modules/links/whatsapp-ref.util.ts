/** Prefijo automático en textos prellenados de links WHATSAPP (tracking → mali-whatsapp). */

const REF_TOKEN = String.raw`ref:[a-zA-Z0-9_-]+`;

/** `ref:{slug}` al inicio, con separador opcional. */
export const WHATSAPP_REF_PREFIX_RE = new RegExp(
  String.raw`^\s*${REF_TOKEN}(?:\s*[·•\-–—]\s*|\s+)?`,
  'i',
);

/** Históricos: ` · ref:{slug}` al final. */
export const WHATSAPP_REF_SUFFIX_RE = new RegExp(
  String.raw`\s*[·•\-–—]?\s*${REF_TOKEN}\s*$`,
  'i',
);

export function stripWhatsappRef(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(WHATSAPP_REF_PREFIX_RE, '')
    .replace(WHATSAPP_REF_SUFFIX_RE, '')
    .trim();
}

/**
 * Quita cualquier `ref:` previo y deja un único `ref:{slug} ·` al inicio.
 * El operador solo escribe el mensaje comercial; el sistema añade el marcador.
 */
export function ensureWhatsappRef(
  text: string | undefined | null,
  slug: string,
): string {
  const safeSlug = String(slug ?? '').trim();
  const base = stripWhatsappRef(text);
  if (!safeSlug) return base;
  if (!base) return `ref:${safeSlug}`;
  return `ref:${safeSlug} · ${base}`;
}

/** Primer `ref:{slug}` en cualquier parte del mensaje. */
export function extractWhatsappRefSlug(
  text: string | undefined | null,
): string | null {
  const match = String(text ?? '').match(/\bref:([a-zA-Z0-9_-]+)/i);
  return match?.[1] ? String(match[1]) : null;
}
