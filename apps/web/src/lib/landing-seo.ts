import type { LandingDocument } from '@mali-one/shared';

const VISIBLE_TEXT_KEYS = new Set([
  'eyebrow', 'title', 'body', 'intro', 'note', 'description',
  'question', 'answer', 'name', 'role', 'caption', 'subtitle',
  'finalTitle', 'finalDescription', 'label', 'value',
  'date', 'location', 'schedule',
]);

function normalize(value: string): string {
  return value.normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es-PE')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function containsPhrase(value: string, phrase: string): boolean {
  const normalized = normalize(value);
  return normalized !== '' && (` ${normalized} `).includes(` ${phrase} `);
}

function visibleBlockText(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(visibleBlockText);

  return Object.entries(value).flatMap(([key, entry]) => {
    if (key === 'items' || key === 'facts' || key === 'links') {
      return visibleBlockText(entry);
    }
    return VISIBLE_TEXT_KEYS.has(key) && typeof entry === 'string'
      ? [entry]
      : [];
  });
}

export function analyzeLandingSeo(
  keyphrase: string,
  publishedTitle: string,
  description: string,
  content: LandingDocument,
) {
  const phrase = normalize(keyphrase);
  if (!phrase) return null;

  const contentTexts = content.blocks
    .filter((block) => block.enabled)
    .flatMap((block) => visibleBlockText(block.data));

  return {
    title: containsPhrase(publishedTitle, phrase),
    description: containsPhrase(description, phrase),
    content: contentTexts.some((entry) => containsPhrase(entry, phrase)),
  };
}
