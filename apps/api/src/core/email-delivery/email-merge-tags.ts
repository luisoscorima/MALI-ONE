/** Fallback when the recipient has no usable first name. */
export const EMAIL_MERGE_FIRST_NAME_FALLBACK = 'estimado(a)';

const FIRST_NAME_PATTERNS: RegExp[] = [
  /\{\{\s*first_?name\s*\}\}/gi,
  /\{\{\s*fname\s*\}\}/gi,
  /\*\|FNAME\|\*/g,
  /<<\s*(?:Test\s+)?First Name\s*>>/gi,
  /&lt;&lt;\s*(?:Test\s+)?First Name\s*&gt;&gt;/gi,
];
const FIRST_NAME_TAG = `(?:${FIRST_NAME_PATTERNS.map((pattern) => pattern.source).join('|')})`;
const LAST_NAME_TAG = /(?:\{\{\s*last_?name\s*\}\}|\*\|LNAME\|\*)/.source;
const NAME_TAGS = new RegExp(
  `(${FIRST_NAME_TAG}\\s+${LAST_NAME_TAG})|(${FIRST_NAME_TAG})|${LAST_NAME_TAG}`,
  'gi',
);

type RecipientNames = { firstName?: string | null; lastName?: string | null };

export function emailSendNames(send: RecipientNames & { name?: string | null }): RecipientNames {
  if (send.firstName != null || send.lastName != null) {
    return { firstName: send.firstName, lastName: send.lastName };
  }
  return { firstName: firstNameFromDisplayName(send.name) };
}

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
  vars: RecipientNames,
  options?: { html?: boolean },
): string {
  const first = vars.firstName?.trim() ?? '';
  const last = vars.lastName?.trim() ?? '';
  const escape = (value: string) => options?.html
    ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    : value;
  const fullName = [first, last].filter(Boolean).join(' ') || EMAIL_MERGE_FIRST_NAME_FALLBACK;
  return content.replace(NAME_TAGS, (_tag, full: string | undefined, given: string | undefined) =>
    escape(full ? fullName : given ? resolveEmailFirstName(first) : last),
  );
}
