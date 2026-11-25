import type { MalichimpAudienceMode } from '@mali-one/shared';
import { MALICHIMP_AUDIENCE_MODE } from './malichimp-audience-mode';

function recipientCountLabel(count: number) {
  const safe = Number.isFinite(count) && count > 0 ? count : 0;
  return `${safe} ${safe === 1 ? 'destinatario' : 'destinatarios'}`;
}

/**
 * Short "Para" line: the chosen groups or tags, or the recipient count
 * when the send was a direct email list or no longer has those names.
 */
export function formatMalichimpAudienceLabel(input: {
  audienceMode: MalichimpAudienceMode;
  included: string[];
  recipientCount: number;
}): string {
  const names = input.included.map((name) => name.trim()).filter(Boolean);
  if (input.audienceMode === MALICHIMP_AUDIENCE_MODE.emails || names.length === 0) {
    return recipientCountLabel(input.recipientCount);
  }
  return names.join(', ');
}
