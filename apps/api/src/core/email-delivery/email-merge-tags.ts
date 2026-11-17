/** Fallback when the recipient has no usable first name. */
export const EMAIL_MERGE_FIRST_NAME_FALLBACK = 'estimado(a)';

const FIRST_NAME_PATTERNS: RegExp[] = [
  /\{\{\s*first_name\s*\}\}/gi,
  /\{\{\s*fname\s*\}\}/gi,
  /\*\|FNAME\|\*/g,
  /<<\s*(?:Test\s+)?First Name\s*>>/gi,
  /&lt;&lt;\s*(?:Test\s+)?First Name\s*&gt;&gt;/gi,
];

/** First token of a display name, or null if empty. */
export function firstNameFromDisplayName(
  name: string | null | undefined,
): string | null {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim() ?? '';
  return first || null;
}

export function resolveEmailFirstName(
  firstName: string | null | undefined,
): string {
  const trimmed = firstName?.trim() ?? '';
  return trimmed || EMAIL_MERGE_FIRST_NAME_FALLBACK;
}

/** Replace personalization placeholders in subject or HTML for one recipient. */
export function applyEmailMergeTags(
  content: string,
  vars: { firstName?: string | null },
): string {
  const value = resolveEmailFirstName(vars.firstName);
  let result = content;
  for (const pattern of FIRST_NAME_PATTERNS) {
    result = result.replace(pattern, () => value);
  }
  return result;
}
