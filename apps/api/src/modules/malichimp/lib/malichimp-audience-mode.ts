import type { MalichimpAudienceMode } from '@mali-one/shared';
import { MALICHIMP_AUDIENCE_MODE } from '@mali-one/shared';

export { MALICHIMP_AUDIENCE_MODE, MALICHIMP_RESOLVE_EMAILS_MAX } from '@mali-one/shared';

const MODES = new Set<string>(Object.values(MALICHIMP_AUDIENCE_MODE));

/** Resolve request/persisted mode; omitted/null/unknown → groups. */
export function resolveMalichimpAudienceMode(
  value: string | null | undefined,
): MalichimpAudienceMode {
  if (value && MODES.has(value)) return value as MalichimpAudienceMode;
  return MALICHIMP_AUDIENCE_MODE.groups;
}

export function isMalichimpAudienceMode(value: unknown): value is MalichimpAudienceMode {
  return typeof value === 'string' && MODES.has(value);
}
